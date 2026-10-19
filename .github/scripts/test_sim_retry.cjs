const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {DEFAULTS, plan} = require('../../assets/js/sim-retry.js');

const run = changes => plan({...DEFAULTS, ...changes});

test('course defaults reproduce the three timelines in the retry figure', () => {
  assert.equal(run({failure: 'refused'}).total, 1.5);
  assert.equal(run({failure: 'gateway'}).total, 76.5);
  assert.equal(run({failure: 'timeout'}).total, 91.5);
  assert.equal(run({}).givesUp, false);
});
test('backoff doubles and attempts alternate with waits', () => {
  const steps = run({failure: 'refused', attempts: 4}).steps;
  assert.deepEqual(steps.map(step => step.kind), ['attempt', 'backoff', 'attempt', 'backoff', 'attempt', 'backoff', 'attempt']);
  assert.deepEqual(steps.filter(step => step.kind === 'backoff').map(step => step.end - step.start), [0.5, 1, 2]);
});
test('a longer read timeout breaks the caller budget and later work continues', () => {
  const result = run({timeout: 40});
  assert.equal(result.total, 121.5);
  assert.equal(result.givesUp, true);
  assert.match(result.summary, /gives up at 100 s/);
  assert.equal(run({timeout: 40, attempts: 4}).steps.at(-1).late, true);
});
test('the 504 cap only wins when it fires before the read timeout', () => {
  assert.equal(run({failure: 'gateway'}).outcome.result, '504 Gateway Timeout');
  assert.equal(run({failure: 'gateway', timeout: 20}).outcome.result, 'ReadTimeout');
});
test('retry safety follows whether the request was sent and whether it changes state', () => {
  assert.equal(run({failure: 'refused', operation: 'save'}).safety.verdict, 'safe');
  assert.equal(run({failure: 'refused'}).paid, 0);
  assert.equal(run({operation: 'extract'}).safety.verdict, 'paid');
  assert.equal(run({operation: 'save'}).safety.verdict, 'unsafe');
  assert.equal(run({operation: 'save-key'}).safety.verdict, 'keyed');
  assert.equal(run({attempts: 1, operation: 'save'}).safety.verdict, 'no-retry');
});
test('invalid numbers and choices are rejected', () => {
  for (const bad of [{timeout: 0}, {timeout: NaN}, {attempts: 1.5}, {attempts: 11}, {backoff: -1}, {deadline: Infinity}, {failure: 'dns'}, {operation: 'get'}]) {
    assert.throws(() => run(bad), RangeError);
  }
});
test('rendered lecture keeps the static worked example and loads only its own script', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'lectures/09-failures-evals-costs.html'), 'utf8');
  assert.match(html, /<div class="sim" id="sim-retry"[^>]*>/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /121\.5 s/);
  assert.match(html, /assets\/js\/sim-retry\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-(git|status|session|compose)\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-retry.js'), 'utf8'), readFileSync('assets/js/sim-retry.js', 'utf8'));
});
