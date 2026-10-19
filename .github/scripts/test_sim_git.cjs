const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {initial, apply, view} = require('../../assets/js/sim-git.js');

const run = (...commands) => commands.reduce((result, command) => apply(result.state, command), {state: initial()});
const holders = state => view(state).areas.filter(area => area.has).map(area => area.name.split(' ')[0]);

test('an edit lives only in the working tree until git add', () => {
  const {state} = run('edit');
  assert.deepEqual(holders(state), ['Working']);
  assert.equal(view(state).areas[0].output, '+ edit 1 (not staged yet)');
  assert.equal(view(state).areas[1].output, '(no output)');
});
test('add, edit again: git diff shows the second edit and git diff --staged the first', () => {
  const {state} = run('edit', 'add', 'edit');
  const [work, staged] = view(state).areas;
  assert.match(work.output, /edit 2/);
  assert.match(staged.output, /edit 1/);
});
test('commit records only the staged edit; push copies commits to GitHub', () => {
  let result = run('edit', 'add', 'edit', 'commit');
  assert.match(result.output, /\[add-product-sketch \w{7}\] Update README \(edit 1\)/);
  assert.match(view(result.state).status, /ahead of 'origin\/add-product-sketch' by 1 commit\./);
  assert.match(view(result.state).status, /Changes not staged for commit/);
  result = apply(result.state, 'push');
  assert.equal(view(result.state).areas[3].holds, 'edit 1');
  assert.equal(apply(result.state, 'push').output, 'Everything up-to-date');
});
test('git restore --staged keeps the edit; git restore discards it for good', () => {
  let result = run('edit', 'add', 'unstage');
  assert.deepEqual(holders(result.state), ['Working']);
  result = apply(result.state, 'restore');
  assert.deepEqual(holders(result.state), []);
  assert.equal(view(result.state).lost, true);
  assert.match(view(result.state).status, /nothing to commit, working tree clean/);
});
test('commands with nothing to do print what Git prints and change nothing', () => {
  assert.equal(run('commit').output, 'nothing to commit, working tree clean');
  assert.equal(run('edit', 'commit').output, 'no changes added to commit (use "git add" and/or "git commit -a")');
  assert.deepEqual(run('add').state, initial());
  assert.throws(() => apply(initial(), 'rebase'), RangeError);
});
test('rendered lecture keeps the static worked example and loads only its own script', () => {
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'lectures/01-environment-git-docker-ai.html'), 'utf8');
  assert.match(html, /<div class="sim" id="sim-git"[^>]*>/);
  assert.match(html, /class="sim-fallback"/);
  assert.match(html, /Edit 2 is gone for good/);
  assert.match(html, /assets\/js\/sim-git\.js\?v=\d+/);
  assert.doesNotMatch(html, /sim-(status|session|compose|retry)\.js/);
  assert.equal(readFileSync(join(site, 'assets/js/sim-git.js'), 'utf8'), readFileSync('assets/js/sim-git.js', 'utf8'));
});
