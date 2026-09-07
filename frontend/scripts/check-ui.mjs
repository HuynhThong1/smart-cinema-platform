import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parseTemplate } from '@angular/compiler';
const root = path.resolve(import.meta.dirname, '..');
function load(file) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'require', js)(exports, (relative) =>
    load(path.resolve(path.dirname(file), relative + '.ts')),
  );
  return exports;
}
const { vi, en } = load(path.join(root, 'libs/i18n/src/translations.ts'));
function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([k, v]) =>
    typeof v === 'string'
      ? [[prefix + k, v]]
      : Array.isArray(v)
        ? v.map((x, i) => [prefix + k + '.' + i, x])
        : typeof v === 'object'
          ? flatten(v, prefix + k + '.')
          : [],
  );
}
const left = new Map(flatten(vi)),
  right = new Map(flatten(en));
const errors = [];
for (const key of new Set([...left.keys(), ...right.keys()])) {
  if (!left.has(key) || !right.has(key)) errors.push('Translation missing: ' + key);
  const params = (s) =>
    [...(s || '').matchAll(/{{\s*(\w+)\s*}}/g)]
      .map((m) => m[1])
      .sort()
      .join(',');
  if (params(left.get(key)) !== params(right.get(key)))
    errors.push('Interpolation mismatch: ' + key);
}
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.(ts|html)$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );
}
function checkTemplate(source, file) {
  const parsed = parseTemplate(source, file, { preserveWhitespaces: true });
  if (parsed.errors) {
    errors.push(...parsed.errors.map(String));
    return;
  }
  function walk(nodes) {
    for (const n of nodes || []) {
      const fail = (message) =>
        errors.push(
          path.relative(root, file) + ':' + (n.sourceSpan.start.line + 1) + ' ' + message,
        );
      if (n.constructor.name === 'Text' && /\p{L}/u.test(n.value))
        fail('Hard-coded UI text: ' + n.value.trim());
      if (n.constructor.name === 'BoundText' && n.value.ast.strings?.some((x) => /\p{L}/u.test(x)))
        fail('Hard-coded interpolation text');
      if (['table', 'select', 'textarea', 'button', 'input'].includes(n.name)) {
        const attrs = n.attributes.map((x) => x.name);
        const type = n.attributes.find((x) => x.name === 'type')?.value;
        if (
          n.name === 'table' ||
          n.name === 'select' ||
          (n.name === 'button' && !attrs.includes('cinemaButton')) ||
          (n.name === 'textarea' && !attrs.includes('cinemaTextarea')) ||
          (n.name === 'input' && type !== 'file' && !attrs.includes('cinemaInput'))
        )
          fail('Use a shared control: ' + n.name);
      }
      for (const a of n.attributes || [])
        if (
          ['title', 'aria-label', 'placeholder', 'header'].includes(a.name) &&
          /\p{L}/u.test(a.value)
        )
          fail('Hard-coded ' + a.name);
      walk(n.children);
      walk(n.branches);
      walk(n.groups);
      if (n.empty) walk(n.empty.children);
    }
  }
  walk(parsed.nodes);
}
const sources = [
  ...files(path.join(root, 'libs/feature/src')),
  ...files(path.join(root, 'apps/smart-admin/src/app')),
  ...files(path.join(root, 'apps/smart-customer/src/app')),
];
for (const file of sources) {
  const source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) checkTemplate(source, file);
  else for (const m of source.matchAll(/template:\s*`([\s\S]*?)`/g)) checkTemplate(m[1], file);
  for (const m of source.matchAll(/['"]([a-z_]+\.[a-z_][a-z_0-9.]*)['"]/g))
    if (
      !/\.(csv|json|png|svg)$/.test(m[1]) &&
      Object.hasOwn(vi, m[1].split('.')[0]) &&
      !left.has(m[1]) &&
      !right.has(m[1]) &&
      !m[1].endsWith('.')
    )
      errors.push('Unknown translation key ' + m[1] + ' in ' + path.relative(root, file));
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`UI controls and ${left.size} bilingual translation entries verified.`);
