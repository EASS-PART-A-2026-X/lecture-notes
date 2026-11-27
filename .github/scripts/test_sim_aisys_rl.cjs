const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {ACTIONS, CASES, nextDecision} = require('../../assets/js/sim-aisys-rl.js');

test('all six synthetic RL rollout receipts map to expected actions without mutating CASES', () => {
  const expected = ['accept', 'reject_stale', 'exclude_infra', 'flush_kv', 'checkpoint', 'wait_group'];
  const snapshot = JSON.stringify(CASES);
  assert.deepEqual(CASES.map(c => nextDecision(c).action), expected);
  assert.equal(JSON.stringify(CASES), snapshot);
  assert.ok(expected.every(id => ACTIONS.some(([a]) => a === id)));
});

test('infra and verifier failures are always excluded even when policy lag is fresh', () => {
  const fresh = CASES.find(c => c.id === 'fresh');
  assert.equal(nextDecision({...fresh, outcome: 'infra_failure'}).action, 'exclude_infra');
  assert.equal(nextDecision({...fresh, outcome: 'verifier_failure'}).action, 'exclude_infra');
  assert.equal(nextDecision({...fresh, status: 'failed_infra'}).action, 'exclude_infra');
});

test('invalid receipt inputs throw RangeError', () => {
  const fresh = CASES.find(c => c.id === 'fresh');
  for (const bad of [{policyLag: -1}, {maxStaleness: 1.5}, {outcome: 'bogus'}, {status: 'unknown'}, {kvConsistent: 'yes'}]) {
    assert.throws(() => nextDecision({...fresh, ...bad}), RangeError);
  }
});

test('rendered Part 2 page keeps static fallback and loads only sim-aisys-rl.js', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'guides/ai-systems-02-rl-and-rollouts.html'), 'utf8');
  assert.match(html, /id="sim-aisys-rl"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /assets\/js\/sim-aisys-rl\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-aisys-capacity\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-aisys-rl\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-aisys-rl.js'), 'utf8'), readFileSync('assets/js/sim-aisys-rl.js', 'utf8'));
});
