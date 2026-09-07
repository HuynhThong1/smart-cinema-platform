const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exportsObject = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('libs/i18n/src/locale.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exportsObject);
const { languageFromCookie, localizedLabel, translatedMessage } = exportsObject;
test('locale accepts only supported cookie values', () => {
  assert.equal(languageFromCookie(''), 'vi');
  assert.equal(languageFromCookie('other=en; cinema-language=en; another=x'), 'en');
  assert.equal(languageFromCookie('cinema-language=fr'), 'vi');
  assert.equal(languageFromCookie('cinema-language=english'), 'vi');
  assert.equal(languageFromCookie('not-cinema-language=en'), 'vi');
});
test('legacy snapshot falls back without changing stored labels', () => {
  const legacy = { label: 'Thân thiện' };
  assert.equal(localizedLabel(legacy, 'en'), 'Thân thiện');
  assert.equal(localizedLabel({ ...legacy, english: '  ' }, 'en'), 'Thân thiện');
  assert.equal(localizedLabel({ ...legacy, english: 'Friendly' }, 'en'), 'Friendly');
  assert.equal(localizedLabel({ ...legacy, english: 'Friendly' }, 'vi'), 'Thân thiện');
  assert.deepEqual(legacy, { label: 'Thân thiện' });
});
test('message parameters remain data until presentation', () => {
  const message = translatedMessage('messages.notification_title', {
    name: 'common.close',
    rating: 5,
  });
  assert.deepEqual(JSON.parse(message.slice(6)), {
    key: 'messages.notification_title',
    params: { name: 'common.close', rating: 5 },
  });
});
