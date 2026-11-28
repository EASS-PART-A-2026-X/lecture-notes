const test = require('node:test');
const assert = require('node:assert/strict');
const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {ACTIONS, CASES, nextDecision, evaluateGrpoGroup} = require('../../assets/js/sim-aisys-rl.js');

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

test('evaluateGrpoGroup computes balanced, zero-variance, rare-win, and crash-excluded advantages', () => {
  const balanced = evaluateGrpoGroup(['pass', 'fail', 'pass', 'fail']);
  assert.equal(balanced.validCount, 4);
  assert.equal(balanced.excludedCount, 0);
  assert.equal(balanced.mean, 0.5);
  assert.equal(balanced.std, 0.5);
  assert.equal(balanced.zeroVariance, false);
  assert.equal(balanced.zeroSignal, false);
  assert.deepEqual(balanced.tries.map(t => t.advantage), [1, -1, 1, -1]);

  const allPass = evaluateGrpoGroup(['pass', 'pass', 'pass', 'pass']);
  assert.equal(allPass.validCount, 4);
  assert.equal(allPass.mean, 1);
  assert.equal(allPass.std, 0);
  assert.equal(allPass.zeroVariance, true);
  assert.equal(allPass.zeroSignal, true);
  assert.deepEqual(allPass.tries.map(t => t.advantage), [0, 0, 0, 0]);

  const rareWin = evaluateGrpoGroup(['pass', 'fail', 'fail', 'fail']);
  assert.equal(rareWin.mean, 0.25);
  assert.equal(rareWin.std, 0.433);
  assert.deepEqual(rareWin.tries.map(t => t.advantage), [1.732, -0.577, -0.577, -0.577]);

  const withCrash = evaluateGrpoGroup(['pass', 'fail', 'crash', 'pass']);
  assert.equal(withCrash.validCount, 3);
  assert.equal(withCrash.excludedCount, 1);
  assert.equal(withCrash.mean, 0.667);
  assert.equal(withCrash.std, 0.471);
  assert.equal(withCrash.zeroSignal, false);
  assert.deepEqual(withCrash.tries.map(t => t.advantage), [0.707, -1.414, null, 0.707]);
  assert.equal(withCrash.tries[2].excluded, true);
  assert.equal(withCrash.tries[2].reward, null);

  const tooFewValid = evaluateGrpoGroup(['crash', 'pass', 'crash', 'crash']);
  assert.equal(tooFewValid.validCount, 1);
  assert.equal(tooFewValid.excludedCount, 3);
  assert.equal(tooFewValid.zeroVariance, true);
  assert.equal(tooFewValid.zeroSignal, true);
  assert.deepEqual(tooFewValid.tries.map(t => t.advantage), [null, 0, null, null]);
});

test('evaluateGrpoGroup rejects invalid lengths or outcome strings with RangeError', () => {
  for (const bad of [
    null,
    'pass',
    [],
    ['pass'],
    ['pass', 'fail', 'pass', 'fail', 'pass', 'fail', 'pass', 'fail', 'pass'],
    ['pass', 'unknown'],
    ['pass', 1]
  ]) {
    assert.throws(() => evaluateGrpoGroup(bad), RangeError);
  }
});

test('Part 2 markdown source includes hero ribbon, story banner, and both lab fallbacks', () => {
  const md = readFileSync('guides/ai-systems-02-rl-and-rollouts.md', 'utf8');
  assert.match(md, /class="aisys-hero"/);
  assert.match(md, /class="aisys-story"/);
  assert.match(md, /id="sim-aisys-grpo"/);
  assert.match(md, /id="sim-aisys-rl"/);
  assert.match(md, /class="sim aisys-sim" id="sim-aisys-rl"/);
});

test('rendered Part 2 page keeps static fallback and loads only sim-aisys-rl.js', {skip: !existsSync(join(process.env.SITE_DIR || '_site', 'guides/ai-systems-02-rl-and-rollouts.html'))}, () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'guides/ai-systems-02-rl-and-rollouts.html'), 'utf8');
  assert.match(html, /class="aisys-hero"/);
  assert.match(html, /class="aisys-story"/);
  assert.match(html, /id="sim-aisys-grpo"/);
  assert.match(html, /id="sim-aisys-rl"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /assets\/js\/sim-aisys-rl\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-aisys-capacity\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-aisys-rl\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-aisys-rl.js'), 'utf8'), readFileSync('assets/js/sim-aisys-rl.js', 'utf8'));
});
