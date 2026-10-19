const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {initial, apply, view} = require('../../assets/js/sim-session.js');

const run = (...actions) => actions.reduce((result, action) => apply(result.state, action), {state: initial()});

test('add sends no SQL and leaves the id None', () => {
  const result = run('add');
  assert.deepEqual(result.sql, []);
  assert.equal(result.state.obj.id, null);
  assert.match(view(result.state).other[0], /returns 0/);
});
test('flush assigns id 1 inside an open transaction another connection cannot see', () => {
  const result = run('add', 'flush');
  assert.equal(result.sql[0], 'BEGIN (implicit)');
  assert.match(result.sql[1], /^INSERT INTO recipe \(title, minutes, servings, ingredients, tags\)/);
  assert.equal(result.state.obj.id, 1);
  assert.equal(result.state.txOpen, true);
  assert.equal(result.state.committed, 0);
});
test('commit makes the row visible and durable; commit after add flushes first', () => {
  const result = run('add', 'commit');
  assert.deepEqual(result.sql.map(line => line.split(' ')[0]), ['BEGIN', 'INSERT', "('Falafel',", 'COMMIT']);
  assert.equal(result.state.committed, 1);
  assert.match(view(result.state).restart[0], /^1 row survive/);
});
test('rollback undoes the INSERT but the object keeps its id, and SQLite reuses it', () => {
  let result = run('add', 'flush', 'rollback');
  assert.deepEqual(result.sql, ['ROLLBACK']);
  assert.equal(result.state.obj.id, 1);
  assert.equal(result.state.committed, 0);
  assert.match(view(result.state).object[0], /no row 1 exists/);
  result = apply(apply(result.state, 'add').state, 'commit');
  assert.equal(result.state.obj.id, 1);
});
test('a restart keeps committed rows only', () => {
  const result = run('add', 'commit', 'add', 'flush', 'restart');
  assert.equal(result.state.obj, null);
  assert.equal(result.state.txOpen, false);
  assert.equal(result.state.committed, 1);
  assert.match(result.message, /uncommitted recipe/);
});
test('actions with nothing to do send no SQL; unknown actions are rejected', () => {
  for (const action of ['flush', 'commit', 'rollback']) assert.deepEqual(run(action).sql, []);
  assert.equal(run('add', 'add').state.obj.state, 'pending');
  assert.equal(run('add', 'rollback').state.obj.state, 'discarded');
  assert.throws(() => apply(initial(), 'vacuum'), RangeError);
});
test('rendered lecture keeps the static worked example and loads only its own script', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'lectures/03-persistence-and-first-pr.html'), 'utf8');
  assert.match(html, /<div class="sim" id="sim-session"[^>]*>/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /but no row 1 exists/);
  assert.match(html, /assets\/js\/sim-session\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-(git|status|compose|retry)\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-session.js'), 'utf8'), readFileSync('assets/js/sim-session.js', 'utf8'));
});
