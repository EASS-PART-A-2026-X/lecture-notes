// Exercise the actual rendered theme handler, without a browser dependency.
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {join} = require('node:path');
const {createHash} = require('node:crypto');

const source = readFileSync(join(process.env.SITE_DIR || '_site', 'assets/js/just-the-docs.js'), 'utf8');
const handlerSource = source.match(/const updateSearchFocus = function\(evt\) \{[\s\S]*?\n  \}/);
assert.ok(handlerSource, 'Built theme search focus handler must be present');

function run(relatedTarget) {
  let hidden = false;
  const handler = runInNewContext(`${handlerSource[0]}; updateSearchFocus`, {
    hideSearch: () => { hidden = true; },
  });
  handler({relatedTarget});
  return hidden;
}

test('leaving the page with no related target hides search without throwing', () => {
  assert.equal(run(null), true);
});

test('moving focus back to the search input keeps results open', () => {
  assert.equal(run({id: 'search-input'}), false);
});

test('moving focus to a search result keeps results open', () => {
  assert.equal(run({id: 'result', classList: {contains: value => value === 'search-result'}}), false);
});

test('moving focus outside search hides the results', () => {
  assert.equal(run({id: 'main-content', classList: {contains: () => false}}), true);
});

test('pages request the corrected theme script using its content fingerprint', () => {
  const home = readFileSync(join(process.env.SITE_DIR || '_site', 'index.html'), 'utf8');
  const version = createHash('sha256').update(source).digest('hex').slice(0, 12);
  assert.ok(home.includes(`/assets/js/just-the-docs.js?v=${version}"`));
});
