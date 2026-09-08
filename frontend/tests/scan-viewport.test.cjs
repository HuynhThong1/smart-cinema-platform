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
test('automatic zoom is bounded and returns to wide view to recover off-centre codes', () => {
  for (let ms = 0; ms < 14000; ms += 50) {
    const zoom = exported.scanZoom(ms);
    assert(zoom >= 1 && zoom <= 1.8);
  }
  assert.equal(exported.scanZoom(0), 1);
  assert.equal(exported.scanZoom(4200), 1.8);
  assert.equal(exported.scanZoom(7000), 1);
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
