const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {DEFAULTS, simulate} = require('../../assets/js/sim-compose.js');

const sim = changes => simulate({...DEFAULTS, ...changes});

test('the course default starts all three and CRUD works', () => {
  const result = sim({});
  assert.equal(result.waitOk, true);
  assert.deepEqual(Object.values(result.services), ['running (healthy)', 'running (healthy)', 'running (healthy)']);
  assert.equal(result.crudWorks, true);
});
test('a broken ai-service check with service_healthy keeps backend and frontend Created', () => {
  const result = sim({ai: 'unhealthy'});
  assert.equal(result.services.backend, 'Created (never started)');
  assert.equal(result.services.frontend, 'Created (never started)');
  assert.equal(result.wait, 'dependency failed to start: container recipe-box-ai-service-1 is unhealthy');
  assert.equal(result.crudWorks, false);
  assert.match(result.curl, /Failed to connect to localhost port 8000/);
});
test('service_started (the stretch variant) starts CRUD although up --wait still fails', () => {
  const result = sim({ai: 'unhealthy', condition: 'service_started'});
  assert.equal(result.services.backend, 'running (healthy)');
  assert.equal(result.wait, 'container recipe-box-ai-service-1 is unhealthy');
  assert.equal(result.crudWorks, true);
  assert.match(result.paste, /only the check is broken/);
});
test('an unhealthy backend never starts the frontend but still answers curl', () => {
  const result = sim({backend: 'unhealthy'});
  assert.equal(result.services.frontend, 'Created (never started)');
  assert.equal(result.wait, 'dependency failed to start: container recipe-box-backend-1 is unhealthy');
  assert.match(result.curl, /answers 200/);
  assert.equal(sim({frontend: 'unhealthy'}).wait, 'container recipe-box-frontend-1 is unhealthy');
});
test('a later ai-service crash leaves CRUD working and pastes get 503', () => {
  const result = sim({ai: 'crash'});
  assert.equal(result.waitOk, true);
  assert.match(result.services['ai-service'], /^Exited/);
  assert.equal(result.crudWorks, true);
  assert.match(result.paste, /503/);
});
test('the simulator matches the compose.yaml printed in Lecture 8', () => {
  const md = readFileSync('lectures/08-docker-compose.md', 'utf8');
  const yaml = md.match(/```yaml\n(# compose\.yaml \(Compose Specification[\s\S]*?)```/)[1];
  assert.equal((yaml.match(/condition: service_healthy/g) || []).length, 2);
  assert.doesNotMatch(yaml, /^\s+restart:/m);
  assert.throws(() => sim({condition: 'service_completed_successfully'}), RangeError);
});
test('rendered lecture keeps the static worked example and loads only its own script', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'lectures/08-docker-compose.html'), 'utf8');
  assert.match(html, /<div class="sim" id="sim-compose"[^>]*>/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /dependency failed to start: container recipe-box-backend-1 is unhealthy/);
  assert.match(html, /assets\/js\/sim-compose\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-(git|status|session|retry)\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-compose.js'), 'utf8'), readFileSync('assets/js/sim-compose.js', 'utf8'));
});
