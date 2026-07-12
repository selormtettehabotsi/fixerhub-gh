/**
 * PERF: profile photos are uploaded at full camera resolution (often 3–12 MP).
 * Rendering those into a 40–60 px avatar makes the app decode a huge bitmap
 * per image (tens of MB of RAM each) and slows list scrolling badly.
 *
 * Cloudinary can resize on their servers via URL transforms — this helper
 * injects `w_<px>,h_<px>,c_fill,q_auto,f_auto` into the delivery URL so the
 * device downloads and decodes only the size it actually displays.
 *
 * Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryThumb(url: string | null | undefined, displaySize: number): string | undefined {
  if (!url) return undefined;

  // Local picker URIs (file://) and non-Cloudinary URLs pass through untouched.
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1 || !url.includes('res.cloudinary.com')) return url;

  // 2× the display size for crisp rendering on high-DPI screens.
  const px = Math.round(displaySize * 2);
  const transform = `w_${px},h_${px},c_fill,q_auto,f_auto`;

  // Already transformed? Don't double-inject.
  const afterUpload = url.slice(idx + marker.length);
  if (afterUpload.startsWith('w_') || afterUpload.startsWith('c_')) return url;

  return url.slice(0, idx + marker.length) + transform + '/' + afterUpload;
}
