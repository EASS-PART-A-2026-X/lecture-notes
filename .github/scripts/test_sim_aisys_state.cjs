const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {SCENARIOS, simulateScenario} = require('../../assets/js/sim-aisys-state.js');

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

test('rendered Part 3 page keeps static fallback and loads only sim-aisys-state.js', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'guides/ai-systems-03-environments-state-roadmap.html'), 'utf8');
  assert.match(html, /id="sim-aisys-state"/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Worked example without JavaScript/);
  assert.match(html, /assets\/js\/sim-aisys-state\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-aisys-(capacity|rl)\.js/);
  assert.doesNotMatch(readFileSync(join(site, 'index.html'), 'utf8'), /sim-aisys-state\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-aisys-state.js'), 'utf8'), readFileSync('assets/js/sim-aisys-state.js', 'utf8'));
});
