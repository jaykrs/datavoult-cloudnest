/** Uploaded-image rules. The file's own bytes decide its type — the browser's claim is ignored. */

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

/** Detect png/jpeg/gif/webp from magic bytes; null for anything else (SVG is deliberately not allowed — it can carry scripts). */
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

const EXT: Record<ImageMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** A safe stored filename: letters/digits/dashes only, extension from the detected type. */
export function safeFilename(original: string, mime: ImageMime): string {
  const base = original.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
  return `${base}.${EXT[mime]}`;
}

/** Public URL of a stored asset. */
export const mediaUrl = (id: string) => `/api/media/${id}`;

/** Where blog/product images may point: our own uploads, or any https URL. */
export const IMAGE_URL_PATTERN = /^(\/api\/media\/[A-Za-z0-9]+|https:\/\/\S+)$/;
