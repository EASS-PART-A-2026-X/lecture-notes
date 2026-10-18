const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {estimate} = require('../../assets/js/reliability-lab.js');

test('one dependency preserves the supplied fast probability', () => {
  assert.equal(estimate(99, 1).allFast,0.99);
  assert.ok(Math.abs(estimate(99, 1).anySlow-0.01)<1e-12);
});
test('ten independent 99-percent-fast branches expose a larger tail', () => {
  assert.ok(Math.abs(estimate(99, 10).anySlow - 0.09561792499119559) < 1e-12);
});
test('100 independent branches yield the printed worked result', () => {
  const result = estimate(99, 100);
  assert.equal((100 * result.allFast).toFixed(2), '36.60');
  assert.equal((100 * result.anySlow).toFixed(2), '63.40');
});
test('a guaranteed-fast dependency and a guaranteed-slow dependency bound the model', () => {
  assert.deepEqual(estimate(100, 1000), {allFast:1, anySlow:0});
  assert.deepEqual(estimate(0, 1000), {allFast:0, anySlow:1});
});
test('adding required independent branches never improves all-fast probability', () => {
  assert.ok(estimate(90, 10).allFast < estimate(90, 2).allFast);
  assert.ok(estimate(95, 10).allFast > estimate(90, 10).allFast);
});
test('bad rates, empty values, fractional counts and unbounded fan-out are rejected', () => {
  for (const args of [[NaN,1],[Infinity,1],[-1,1],[101,1],['99',1],[99,0],[99,1.5],[99,1001],[99,Infinity]]) {
    assert.throws(() => estimate(...args), RangeError);
  }
});
test('valid extremes remain finite and probabilities sum to one', () => {
  const result = estimate(0.01,1000);
  assert.ok(Number.isFinite(result.allFast));
  assert.equal(result.allFast + result.anySlow,1);
});
test('rendered lesson retains defaults, a no-script example and the exact tested asset', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site,'guides/systems-reasoning.html'),'utf8');
  assert.match(html, /name="fast"[^>]*value="99"/);
  assert.match(html, /name="branches"[^>]*value="100"/);
  assert.match(html, /<form hidden\b/);
  assert.match(html, /36\.60%/);
  assert.match(html, /63\.40%/);
  assert.match(html, /Controls require JavaScript/);
  assert.equal(readFileSync(join(site,'assets/js/reliability-lab.js'),'utf8'),readFileSync('assets/js/reliability-lab.js','utf8'));
});
