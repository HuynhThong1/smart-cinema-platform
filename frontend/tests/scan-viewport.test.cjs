const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exported = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('apps/smart-customer/src/app/scan-viewport.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exported);

test('zoom crops original pixels equally for portrait and landscape cameras', () => {
  assert.deepEqual(exported.scanViewport(1920, 1080, 2), { x: 690, y: 270, size: 540 });
  assert.deepEqual(exported.scanViewport(1080, 1920, 2), { x: 270, y: 690, size: 540 });
});
test('detected QR size controls zoom with a broad hold band and a 2.5x cap', () => {
  const crop = exported.scanViewport(1080, 1080, 1);
  const focus = (ratio, viewport = crop) =>
    exported.focusViewport(
      viewport,
      [
        { x: 320 - 320 * ratio, y: 320 - 320 * ratio },
        { x: 320 + 320 * ratio, y: 320 + 320 * ratio },
      ],
      640,
      1080,
      1080,
    );
  for (const ratio of [0.25, 0.4, 0.5, 0.59, 0.6]) assert.deepEqual(focus(ratio), crop);
  assert(focus(0.24).size < crop.size);
  assert.equal(focus(0.01).size, 1080 / 2.5);
  const zoomed = exported.scanViewport(1080, 1080, 2);
  assert(focus(0.61, zoomed).size > zoomed.size);
  assert.equal(focus(0.9).size, 1080);
});
test('QR focus maps decoder coordinates back to source and keeps crop inside image', () => {
  const crop = exported.scanViewport(1920, 1080, 1);
  const points = [
    { x: 280, y: 280 },
    { x: 360, y: 280 },
    { x: 360, y: 360 },
    { x: 280, y: 360 },
  ];
  const focus = exported.focusViewport(crop, points, 640, 1920, 1080);
  assert(Math.abs(focus.x + focus.size / 2 - 960) < 0.01);
  assert(Math.abs(focus.y + focus.size / 2 - 540) < 0.01);
  assert(focus.size < crop.size);
  const edge = exported.focusViewport(
    crop,
    points.map((p) => ({ x: p.x - 280, y: p.y - 280 })),
    640,
    1920,
    1080,
  );
  assert(edge.x >= 0 && edge.y >= 0);
  assert(edge.x + edge.size <= 1920 && edge.y + edge.size <= 1080);
});
