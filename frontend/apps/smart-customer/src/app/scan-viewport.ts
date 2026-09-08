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
  const extent = Math.max(right - left, bottom - top);
  const ratio = extent / crop.size;
  // A broad hold band prevents small corner-estimation changes from reversing zoom.
  // No detection calls this function: the camera remains at its original 1x crop.
  if (ratio >= 0.25 && ratio <= 0.6) return crop;
  const size = Math.min(
    Math.min(width, height),
    Math.max(Math.min(width, height) / 2.5, extent / 0.45),
  );
  return {
    x: Math.max(0, Math.min(width - size, (left + right - size) / 2)),
    y: Math.max(0, Math.min(height - size, (top + bottom - size) / 2)),
    size,
  };
}
