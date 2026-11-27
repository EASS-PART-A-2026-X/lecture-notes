const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {CASES, evaluateCapacity, evaluateSpeculativeEncoding} = require('../../assets/js/sim-aisys-capacity.js');

test('steady-state goodput equals the minimum fleet rate and adding GPUs cannot fix an env bottleneck', () => {
  const envBound = CASES.find(c => c.id === 'env-bound');
  const before = evaluateCapacity(envBound);
  assert.equal(before.goodput, 15);
  assert.deepEqual(before.bottlenecks, ['environments']);

  const moreGpus = evaluateCapacity({...envBound, inference: envBound.inference + 40});
  assert.equal(moreGpus.goodput, 15);
  assert.deepEqual(moreGpus.bottlenecks, ['environments']);

  const moreEnvs = evaluateCapacity({...envBound, environments: envBound.environments + 20});
  assert.equal(moreEnvs.goodput, 35);
  assert.deepEqual(moreEnvs.bottlenecks, ['environments', 'learner']);
});

test('speculative encoding speedup and compounding multi-hop retention follow synthetic bounds', () => {
  const sweet = CASES.find(c => c.id === 'swarm-sweet-spot');
  const rSweet = evaluateSpeculativeEncoding(sweet);
  assert.ok(rSweet.speedup > 3);
  assert.ok(rSweet.translatedMs < rSweet.rawTotalMs);
  assert.ok(rSweet.effectiveAcc > 0.85);

  const deep = CASES.find(c => c.id === 'multihop-drift');
  const rDeep = evaluateSpeculativeEncoding(deep);
  assert.ok(rDeep.effectiveAcc < 0.80, 'six hops compound 0.969^6 below 80%');
});

test('invalid negative, zero, or non-integer inputs throw RangeError', () => {
  const base = CASES[0];
  assert.throws(() => evaluateCapacity({...base, inference: 0}), RangeError);
  assert.throws(() => evaluateCapacity({...base, learner: -5}), RangeError);
  assert.throws(() => evaluateCapacity({...base, environments: Infinity}), RangeError);
  assert.throws(() => evaluateSpeculativeEncoding({...base, contextK: 0}), RangeError);
  assert.throws(() => evaluateSpeculativeEncoding({...base, swarmSize: 1.5}), RangeError);
  assert.throws(() => evaluateSpeculativeEncoding({...base, hops: -1}), RangeError);
});

test('rendered Part 1 page keeps static fallback and loads only sim-aisys-capacity.js', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'guides/ai-systems-01-model-and-serving.html'), 'utf8');
  assert.match(html, /id="sim-aisys-capacity"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /assets\/js\/sim-aisys-capacity\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-aisys-rl\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-aisys-capacity\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-aisys-capacity.js'), 'utf8'), readFileSync('assets/js/sim-aisys-capacity.js', 'utf8'));
});
