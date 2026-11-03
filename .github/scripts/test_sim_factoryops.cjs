const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {ACTIONS, CASES, nextStep} = require('../../assets/js/sim-factoryops.js');
const receipt = CASES.find(item => item.id === 'approval');

test('stale or absent checks require verification even with approval', () => {
  assert.equal(nextStep({...receipt, checked: 'c1', approved: 'c2'}).action, 'check');
  assert.equal(nextStep({...receipt, result: 'not run'}).action, 'check');
  assert.equal(nextStep({...receipt, checked: null}).action, 'check');
});
test('failures and review findings spend only a remaining repair attempt', () => {
  for (const bad of [{result: 'fail'}, {review: 'gap'}]) {
    assert.equal(nextStep({...receipt, ...bad, approved: 'c2'}).action, 'repair');
    assert.equal(nextStep({...receipt, ...bad, repairs: 0, approved: 'c2'}).action, 'stop');
  }
});
test('green evidence does not supply approval, and old approval cannot authorize a new candidate', () => {
  assert.equal(nextStep(receipt).action, 'approve');
  assert.equal(nextStep({...receipt, approved: 'c1'}).action, 'approve');
});
test('approval permits delivery but cannot establish a deployed milestone', () => {
  assert.equal(nextStep({...receipt, approved: 'c2'}).action, 'deliver');
  assert.equal(nextStep({...receipt, approved: 'c2', deployed: 'c1'}).action, 'deliver');
  assert.equal(nextStep({...receipt, approved: 'c2', deployed: 'c2'}).action, 'report');
});
test('all seven classroom receipts have the intended next step without changing their evidence', () => {
  const expected = ['check', 'repair', 'stop', 'repair', 'approve', 'deliver', 'report'];
  const before = JSON.stringify(CASES);
  assert.deepEqual(CASES.map(item => nextStep(item).action), expected);
  assert.equal(JSON.stringify(CASES), before);
  assert.ok(expected.every(action => ACTIONS.some(([id]) => id === action)));
});
test('ambiguous evidence and unbounded repair values are rejected', () => {
  for (const patch of [{candidate: ''}, {result: 'greenish'}, {review: 'unknown'}, {repairs: -1}, {repairs: Infinity}, {repairs: 1.5}]) {
    assert.throws(() => nextStep({...receipt, ...patch}), RangeError);
  }
});
test('rendered guide retains the no-script example and loads the exact tested asset only here', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'guides/factoryops-metamachine.html'), 'utf8');
  assert.match(html, /id="sim-factoryops"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /Run checks on <code[^>]*>c2<\/code> next/);
  assert.match(html, /assets\/js\/sim-factoryops\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-(git|status|session|compose|retry)\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-factoryops\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-factoryops.js'), 'utf8'), readFileSync('assets/js/sim-factoryops.js', 'utf8'));
});
