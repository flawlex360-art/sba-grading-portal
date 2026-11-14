/**
 * Helpers for normalizing, resolving, and compressing school crest images
 * so crests remain durable across reports, admin views, and parent links.
 */

export const MAX_CREST_UPLOAD_FILE_BYTES = 10 * 1024 * 1024; // 10 MB raw file safety cap
export const MAX_CREST_DATA_URI_CHARS = 140000; // ~100 KB binary; safe for Firestore 1 MB docs & batches

/**
 * Returns true if the URL is an inline base64/data URI.
 * @param {string} url
 * @returns {boolean}
 */
export function isEmbeddedCrestDataUrl(url) {
  return typeof url === 'string' && /^data:image\//i.test(url.trim());
}

/**
 * Extracts a Google Drive file ID from common sharing, view, thumbnail, or lh3 URLs.
 * Never matches inline `data:` or `blob:` URIs.
 * @param {string} url
 * @returns {string|null}
 */
export function extractGoogleDriveFileId(url) {
  const clean = String(url || '').trim();
  if (!clean || /^data:|^blob:|^\//i.test(clean)) return null;
  if (!/(drive\.google\.com|docs\.google\.com|lh\d+\.googleusercontent\.com)/i.test(clean)) {
    return null;
  }

  const dMatch = clean.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (dMatch && dMatch[1]) return dMatch[1];

  const idMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch && idMatch[1]) return idMatch[1];

  return null;
}

/**
 * Builds an ordered list of image source candidates for a crest value.
 * Embedded data URIs, blob URLs, and same-origin paths are returned as-is;
 * Google Drive URLs try the cookie-free thumbnail endpoint before lh3 and uc fallbacks.
 * @param {string} url
 * @returns {string[]}
 */
export function getCrestUrlCandidates(url) {
  const clean = String(url || '').trim();
  if (!clean) return [];

  if (/^data:|^blob:|^\//i.test(clean)) {
    return [clean];
  }

  const fileId = extractGoogleDriveFileId(clean);
  if (fileId) {
    return Array.from(
      new Set([
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
      ])
    );
  }

  // Prefer HTTPS if someone pasted an http:// link to prevent mixed-content blocking
  if (/^http:\/\//i.test(clean)) {
    return [clean.replace(/^http:\/\//i, 'https://'), clean];
  }

  return [clean];
}

/**
 * Returns the primary direct image URL for a school crest.
 * Preserves inline `data:` / `blob:` / local `/` URLs and resolves Google Drive links.
 * @param {string} url
 * @returns {string}
 */
export function getDirectImageUrl(url) {
  return getCrestUrlCandidates(url)[0] || '';
}

/**
 * Reads an image File in the browser, resizes it cleanly onto a transparent canvas,
 * and encodes a compact WebP/PNG data URL that fits reliably inside Firestore.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function compressCrestImageFile(file) {
  if (!file) {
    throw new Error('No image file selected.');
  }
  const mime = String(file.type || '').toLowerCase();
  const fileName = String(file.name || '').toLowerCase();
  const looksLikeImage =
    mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(fileName);
  if (!looksLikeImage) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP, or SVG).');
  }
  if (file.size > MAX_CREST_UPLOAD_FILE_BYTES) {
    throw new Error('Image file is too large (max 10 MB). Please choose a smaller crest image.');
  }
  if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
    throw new Error('Image upload is only supported in the browser.');
  }

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read the selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode the selected image file.'));
    el.src = rawDataUrl;
  });

  const srcW = Math.max(1, img.naturalWidth || img.width || 240);
  const srcH = Math.max(1, img.naturalHeight || img.height || 240);

  const dimensionSteps = [280, 220, 180, 140];
  let bestCandidate = '';

  for (const maxDim of dimensionSteps) {
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas image processing is unavailable in this browser.');
    }
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const attempts = [
      canvas.toDataURL('image/webp', 0.88),
      canvas.toDataURL('image/webp', 0.74),
      canvas.toDataURL('image/png'),
    ].filter((u) => typeof u === 'string' && u.startsWith('data:image/'));

    // Pick the smallest valid attempt (and prefer crisp WebP/PNG under cap)
    const sorted = [...attempts].sort((a, b) => a.length - b.length);
    if (sorted[0]) {
      bestCandidate = sorted[0];
      if (bestCandidate.length <= MAX_CREST_DATA_URI_CHARS) {
        return bestCandidate;
      }
    }
  }

  if (bestCandidate && bestCandidate.length <= MAX_CREST_DATA_URI_CHARS) {
    return bestCandidate;
  }

  throw new Error('Crest image is still too large after compression. Please choose a simpler PNG or JPG image.');
}
