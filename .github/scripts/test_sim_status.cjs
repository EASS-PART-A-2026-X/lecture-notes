const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {STAGES, REQUESTS, trace} = require('../../assets/js/sim-status.js');

const expected = {
  valid: [5, '201 Created'], missing: [3, '422 Unprocessable Content'], type: [3, '422 Unprocessable Content'],
  'unknown-id': [4, '404 Not Found'], 'unknown-path': [1, '404 Not Found'], 'delete-twice': [4, '404 Not Found']
};

test('each request is answered by the stage the lecture names, with its status', () => {
  assert.equal(STAGES.length, 5);
  assert.deepEqual(REQUESTS.map(request => request.id), Object.keys(expected));
  for (const [id, [stage, status]] of Object.entries(expected)) {
    const result = trace(id);
    assert.equal(result.answeredBy, stage, id);
    assert.equal(result.status, status, id);
  }
});
test('bodies are the exact JSON the Lecture 2 API returns', () => {
  assert.deepEqual(JSON.parse(trace('valid').body), {title: 'Shakshuka', minutes: 25, servings: 2, ingredients: '', tags: '', id: 1});
  assert.deepEqual(JSON.parse(trace('missing').body).detail[0], {type: 'missing', loc: ['body', 'minutes'], msg: 'Field required', input: {title: 'Soup'}});
  assert.deepEqual(JSON.parse(trace('type').body).detail[0].loc, ['body', 'minutes']);
  assert.equal(JSON.parse(trace('type').body).detail[0].type, 'int_parsing');
  assert.equal(trace('unknown-id').body, '{"detail":"Recipe not found"}');
  assert.equal(trace('unknown-path').body, '{"detail":"Not Found"}');
});
test('stages after the answering stage are never reached; skipped body parsing is explicit', () => {
  const steps = trace('unknown-path').steps;
  assert.deepEqual(steps.map(step => step.state), ['stop', 'unreached', 'unreached', 'unreached', 'unreached']);
  assert.equal(trace('unknown-id').steps[1].state, 'skip');
  assert.ok(trace('delete-twice').request.given.includes('204 No Content'));
  assert.throws(() => trace('teapot'), RangeError);
});
test('rendered lecture keeps the static worked example and loads only its own script', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'lectures/02-http-fastapi-pydantic.html'), 'utf8');
  assert.match(html, /<div class="sim" id="sim-status"[^>]*>/);
  assert.match(html, /class="sim-fallback"/);
  assert.ok(html.includes('{&quot;detail&quot;:&quot;Not Found&quot;}') || html.includes('{"detail":"Not Found"}'));
  assert.match(html, /assets\/js\/sim-status\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-(git|session|compose|retry)\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-status.js'), 'utf8'), readFileSync('assets/js/sim-status.js', 'utf8'));
});
