const test = require('node:test');
const assert = require('node:assert/strict');
const {estimate, presets} = require('../../assets/js/inference-lab.js');

test('worked warm example sums queue, prefill and decode', () => {
  assert.deepEqual(estimate(presets.warm), {load:0, queue:0.5, prefill:2, decode:5, total:7.5, firstToken:2.525});
});
test('longer prompt changes prefill in this fixed-rate model', () => {
  const warm=estimate(presets.warm), long=estimate(presets.long);
  assert.equal(long.total,13.5);
  assert.equal(long.prefill-warm.prefill,6);
  assert.equal(long.decode,warm.decode);
});
test('shorter output saves decode time while first token is unchanged', () => {
  const short=estimate({...presets.warm, outputTokens:100});
  assert.equal(short.total,5);
  assert.equal(short.firstToken,estimate(presets.warm).firstToken);
});
test('cold load and queue contribute to both total and first token', () => {
  const cold=estimate(presets.cold);
  assert.equal(cold.total,18);
  assert.equal(cold.firstToken,13.025);
});
test('one output token makes first-token and complete latency equal', () => {
  const one=estimate({...presets.warm, outputTokens:1});
  assert.equal(one.firstToken,one.total);
});
test('faster prefill preserves decode time; faster decode preserves prefill', () => {
  assert.equal(estimate({...presets.warm,prefillRate:4000}).total,6.5);
  assert.equal(estimate({...presets.warm,decodeRate:80}).total,5);
});
test('invalid, non-finite and fractional token counts cannot yield a chart', () => {
  for (const patch of [{inputTokens:0},{outputTokens:1.5},{decodeRate:0},{queueSeconds:-1},{loadSeconds:Infinity},{prefillRate:NaN},{inputTokens:'4000'},{outputTokens:10001}]) {
    assert.throws(()=>estimate({...presets.warm,...patch}),RangeError);
  }
});
test('supported bounds remain finite and first token never exceeds total', () => {
  const edge=estimate({inputTokens:1000000,outputTokens:10000,prefillRate:0.1,decodeRate:0.1,queueSeconds:3600,loadSeconds:3600});
  assert.ok(Number.isFinite(edge.total));
  assert.ok(edge.firstToken <= edge.total);
});

test('rendered no-script example matches input defaults and current calculator asset', () => {
  const {readFileSync} = require('node:fs');
  const {join} = require('node:path');
  const site = process.env.SITE_DIR || '_site';
  const html = readFileSync(join(site, 'guides/local-inference.html'), 'utf8');
  const defaults = {};
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const name = match[0].match(/name="([^"]+)"/);
    const value = match[0].match(/value="([^"]+)"/);
    if (name && value && Object.hasOwn(presets.warm, name[1])) defaults[name[1]] = Number(value[1]);
  }
  assert.deepEqual(defaults, presets.warm);
  const values = estimate(defaults);
  assert.ok(html.includes(`Estimated total ${values.total} s; first token ${values.firstToken} s.`));
  assert.match(html, /<form hidden\b/);
  assert.match(html, /Interactive controls require JavaScript/);
  assert.equal(readFileSync(join(site,'assets/js/inference-lab.js'),'utf8'), readFileSync('assets/js/inference-lab.js','utf8'));
});
