const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exported = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('apps/smart-customer/src/app/transaction-parser.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exported);
test('parses Galaxy entry QR and preserves leading zeroes', () => {
  assert.equal(exported.parseTransaction('T001201313035 0002'), '01313035/0002');
  assert.equal(exported.parseTransaction('T999900000001 0001'), '00000001/0001');
  assert.equal(exported.parseTransaction('01313035/0002'), '01313035/0002');
});
test('rejects unrelated QR payloads and ambiguous transaction parameters', () => {
  for (const raw of [
    'T0012013130350002',
    'T1201313035 0002',
    'https://example.test/?tx=01313035/0002',
    '/f/t?tx=01313035/0002&tx=11111111/0001',
    'javascript:01313035/0002',
    '123/456',
    'unknown',
    'https://example.test/f/token?tx=01313035%2F0002',
    '01313035/0002junk',
    'T001201313035 0002x',
    'T001201313035 000',
    'T001201313035 00022',
    'T0012abcdefgh 0002',
    '01313035/0002\u0000',
    '01313035/0002\n',
    'T001201313035 0002\r',
    '01313035/0002\t',
    'x'.repeat(1000),
  ])
    assert.equal(exported.parseTransaction(raw), null, raw);
});

test('transaction ID validation requires the entire value and keeps length bounds', () => {
  for (const value of ['123456/123', '1234567890/12345'])
    assert.equal(exported.validTransaction(value), true);
  for (const value of [
    '',
    '12345/123',
    '12345678901/123',
    '123456/12',
    '123456/123456',
    '01313035/0002\n',
    '01313035/0002 ',
    '01313035/0002extra',
  ])
    assert.equal(exported.validTransaction(value), false, value);
});
