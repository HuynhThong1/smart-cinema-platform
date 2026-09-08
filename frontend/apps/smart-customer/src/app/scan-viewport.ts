export interface ScanViewport {
  x: number;
  y: number;
  size: number;
}

// Square crop shared by the preview and decoder: zoom never discards source pixels
// before cropping, so small central codes retain more detail than a full-frame resize.
export function scanViewport(width: number, height: number, zoom: number): ScanViewport {
  const size = Math.min(width, height) / Math.max(1, zoom);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

export function scanZoom(elapsed: number): number {
  // Return to the wide view periodically so an off-centre QR is not lost forever.
  const phase = elapsed % 7000;
  if (phase < 1200) return 1;
  if (phase < 4200) return 1 + ((phase - 1200) / 3000) * 0.8;
  if (phase < 5400) return 1.8;
  return 1.8 - ((phase - 5400) / 1600) * 0.8;
}

export function focusViewport(
  crop: ScanViewport,
  points: { x: number; y: number }[],
  decodedSize: number,
  width: number,
  height: number,
): ScanViewport {
  const xs = points.map((p) => crop.x + (p.x / decodedSize) * crop.size);
  const ys = points.map((p) => crop.y + (p.y / decodedSize) * crop.size);
  const left = Math.min(...xs),
    right = Math.max(...xs);
  const top = Math.min(...ys),
    bottom = Math.max(...ys);
  const size = Math.min(crop.size, Math.max(right - left, bottom - top) / 0.65);
  return {
    x: Math.max(0, Math.min(width - size, (left + right - size) / 2)),
    y: Math.max(0, Math.min(height - size, (top + bottom - size) / 2)),
    size,
  };
}
