const test = require('node:test');
const assert = require('node:assert/strict');
const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {
  CASES,
  PROGRESS_TRACKS,
  evaluateCapacity,
  evaluateSpeculativeEncoding,
  getProgressStep,
  buildDecayCurvePoints,
} = require('../../assets/js/sim-aisys-capacity.js');

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

test('progress tracks return valid concept/problem/status steps and reject bad indices', () => {
  assert.equal(PROGRESS_TRACKS.length, 6);
  for (const track of PROGRESS_TRACKS) {
    assert.equal(track.steps.length, 3);
    for (let i = 0; i < 3; i++) {
      const step = getProgressStep(track.id, i);
      assert.ok(step.concept && step.broken && step.solution && step.status);
    }
  }
  const frontier = getProgressStep('frontier-2026', 2);
  assert.match(frontier.concept, /Engram/);
  assert.match(frontier.concept, /Kimi Linear/);
  assert.match(getProgressStep('cross-model', 2).solution, /7 models from 4 families/);
  assert.match(getProgressStep('frontier-2026', 1).solution, /top-2,048/);
  assert.throws(() => getProgressStep('missing-track', 0), RangeError);
  assert.throws(() => getProgressStep('cross-model', -1), RangeError);
  assert.throws(() => getProgressStep('cross-model', 3), RangeError);
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

test('buildDecayCurvePoints computes 0.969^k decay and flips safety flag below 0.85', () => {
  const pts = buildDecayCurvePoints(0.94, 8);
  assert.equal(pts.length, 9);
  assert.deepEqual(pts[0], {hops: 0, acc: 0.94, safe: true});
  assert.deepEqual(pts[3], {hops: 3, acc: 0.8553, safe: true});
  assert.deepEqual(pts[4], {hops: 4, acc: 0.8287, safe: false});
  assert.deepEqual(pts[6], {hops: 6, acc: 0.7782, safe: false});
  assert.deepEqual(pts[8], {hops: 8, acc: 0.7307, safe: false});

  for (const pt of pts) {
    assert.equal(pt.safe, pt.hops <= 3);
  }
  assert.deepEqual(buildDecayCurvePoints(0.94), pts);

  assert.throws(() => buildDecayCurvePoints(0, 8), RangeError);
  assert.throws(() => buildDecayCurvePoints(-0.2, 8), RangeError);
  assert.throws(() => buildDecayCurvePoints(1.01, 8), RangeError);
  assert.throws(() => buildDecayCurvePoints(Number.NaN, 8), RangeError);
  assert.throws(() => buildDecayCurvePoints(Infinity, 8), RangeError);
  assert.throws(() => buildDecayCurvePoints(0.94, -1), RangeError);
  assert.throws(() => buildDecayCurvePoints(0.94, 2.5), RangeError);
  assert.throws(() => buildDecayCurvePoints(0.94, 17), RangeError);
});

test('Part 1 markdown and simulator JS keep required contracts and upgrades', () => {
  const md = readFileSync('guides/ai-systems-01-model-and-serving.md', 'utf8');
  assert.match(md, /class="aisys-hero"/);
  assert.match(md, /class="aisys-story"/);
  assert.match(md, /class="sim aisys-sim" id="sim-aisys-progress"/);
  assert.match(md, /class="sim aisys-sim" id="sim-aisys-capacity"/);
  assert.match(md, /<!-- \{%\s*raw\s*%\} -->/);
  assert.match(md, /<!-- \{%\s*endraw\s*%\} -->/);

  const jsText = readFileSync('assets/js/sim-aisys-capacity.js', 'utf8');
  assert.match(jsText, /aisys-bars/);
  assert.match(jsText, /aisys-bento/);
  assert.match(jsText, /aisys-sparkline/);
  assert.match(jsText, /aisys-lightbox/);
  assert.match(jsText, /aisys-glossary-input/);
  assert.match(jsText, /http:\/\/www\.w3\.org\/2000\/svg/);
});

test('rendered Part 1 page keeps static fallbacks for both simulators and loads sim-aisys-capacity.js', t => {
  const site = process.env.SITE_DIR || '_site';
  const htmlPath = join(site, 'guides/ai-systems-01-model-and-serving.html');
  if (!existsSync(htmlPath)) {
    t.skip(`Skipping rendered site check; ${htmlPath} not built.`);
    return;
  }
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /id="sim-aisys-progress"/);
  assert.match(html, /id="sim-aisys-capacity"/);
  assert.match(html, /class="sim aisys-sim"/);
  assert.match(html, /class="aisys-hero"/);
  assert.match(html, /class="aisys-story"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /assets\/js\/sim-aisys-capacity\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-aisys-rl\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-aisys-capacity\.js/);
  const jsText = readFileSync('assets/js/sim-aisys-capacity.js', 'utf8');
  assert.equal(readFileSync(join(site, 'assets/js/sim-aisys-capacity.js'), 'utf8'), jsText);
});
