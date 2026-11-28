const test = require('node:test');
const assert = require('node:assert/strict');
const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {SCENARIOS, simulateScenario, evaluateTrajectoryTape} = require('../../assets/js/sim-aisys-state.js');

test('all six Rewind Wall & Verifier scenarios behave as documented', () => {
  assert.equal(SCENARIOS.length, 6);
  const slack = simulateScenario('slack-webhook', true);
  assert.equal(slack.rewindClearsAll, false);
  assert.match(slack.externalAfter, /STILL PRESENT/);

  const local = simulateScenario('local-only', true);
  assert.equal(local.rewindClearsAll, true);
  assert.match(local.localAfter, /Rewound/);

  const twoHop = simulateScenario('two-hop-kv', false);
  assert.equal(twoHop.passesAccFloor, true);

  const sixHop = simulateScenario('six-hop-kv', false);
  assert.equal(sixHop.passesAccFloor, false);
});

test('invalid scenario id or rewind argument throws RangeError', () => {
  assert.throws(() => simulateScenario('nope', false), RangeError);
  assert.throws(() => simulateScenario('local-only', 'yes'), RangeError);
});

test('evaluateTrajectoryTape computes gradient counts, parity status, and receipt JSON', () => {
  const tokens = [
    { text: 'User prompt', isModel: false },
    { text: 'patch line 1', isModel: true },
    { text: 'pytest output', isModel: false },
    { text: 'final reply', isModel: true }
  ];

  const fresh = evaluateTrajectoryTape(tokens, 1, 2);
  assert.equal(fresh.totalTokens, 4);
  assert.equal(fresh.trainedTokens, 2);
  assert.equal(fresh.maskedTokens, 2);
  assert.equal(fresh.trainedPct, 50);
  assert.equal(fresh.policyLag, 1);
  assert.equal(fresh.maxStaleness, 2);
  assert.equal(fresh.isStale, false);
  assert.equal(fresh.parityStatus, 'parity_ok');

  const parsedFresh = JSON.parse(fresh.receiptJson);
  assert.equal(parsedFresh.policy_version, 'v11');
  assert.equal(parsedFresh.max_staleness, 2);
  assert.equal(parsedFresh.token_count, 4);
  assert.equal(parsedFresh.trained_tokens, 2);
  assert.deepEqual(parsedFresh.action_mask, [0, 1, 0, 1]);
  assert.equal(parsedFresh.behavior_logprobs[0], null);
  assert.equal(typeof parsedFresh.behavior_logprobs[1], 'number');
  assert.equal(parsedFresh.behavior_logprobs[2], null);
  assert.equal(typeof parsedFresh.behavior_logprobs[3], 'number');

  const zeroLag = evaluateTrajectoryTape(tokens, 0);
  assert.equal(zeroLag.isStale, false);
  assert.equal(JSON.parse(zeroLag.receiptJson).policy_version, 'v12');

  const stale = evaluateTrajectoryTape(tokens, 4, 2);
  assert.equal(stale.isStale, true);
  assert.equal(stale.parityStatus, 'stale_drift');
  assert.equal(JSON.parse(stale.receiptJson).policy_version, 'v8');
});

test('evaluateTrajectoryTape throws RangeError on invalid tokens or lag bounds', () => {
  const valid = [
    { text: 'prompt', isModel: false },
    { text: 'patch', isModel: true }
  ];
  assert.throws(() => evaluateTrajectoryTape([], 1), RangeError);
  assert.throws(() => evaluateTrajectoryTape([{ text: 'only one', isModel: true }], 1), RangeError);
  assert.throws(() => evaluateTrajectoryTape([{ text: '   ', isModel: false }, { text: 'ok', isModel: true }], 1), RangeError);
  assert.throws(() => evaluateTrajectoryTape([{ text: 'prompt', isModel: 'yes' }, { text: 'ok', isModel: true }], 1), RangeError);
  assert.throws(() => evaluateTrajectoryTape(valid, -1), RangeError);
  assert.throws(() => evaluateTrajectoryTape(valid, 1.5), RangeError);
  assert.throws(() => evaluateTrajectoryTape(valid, 1, -1), RangeError);
  assert.throws(() => evaluateTrajectoryTape(valid, 1, '2'), RangeError);
});

test('rendered Part 3 page keeps static fallback and loads only sim-aisys-state.js', () => {
  const site = process.env.SITE_DIR || '_site';
  const htmlPath = join(site, 'guides/ai-systems-03-environments-state-roadmap.html');
  if (!existsSync(htmlPath)) return;
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /id="sim-aisys-state"/);
  assert.match(html, /id="sim-aisys-tape"/);
  assert.match(html, /class="aisys-hero"/);
  assert.match(html, /class="aisys-story"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /assets\/js\/sim-aisys-state\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-aisys-(capacity|rl)\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-aisys-state\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-aisys-state.js'), 'utf8'), readFileSync('assets/js/sim-aisys-state.js', 'utf8'));
});
