export const DEFAULT_MNOTIFY_SENDER_ID = 'KpandoAngli';

const LEGACY_SENDER_IDS = new Set(['MADIFOR', 'KPANDO ANG']);

/**
 * Normalizes legacy placeholder or empty sender IDs to the approved KpandoAngli ID
 * and enforces the 11-character mNotify sender ID limit.
 */
export function normalizeSmsSenderId(senderId) {
  const clean = String(senderId || '').trim().slice(0, 11);
  if (!clean || LEGACY_SENDER_IDS.has(clean.toUpperCase())) {
    return DEFAULT_MNOTIFY_SENDER_ID;
  }
  return clean;
}

/**
 * Validates mNotify Quick SMS HTTP & JSON payload responses (code '2000' / status 'success').
 */
export function evaluateMnotifyResponse(upstreamOk, data = {}) {
  const statusStr = String(data?.status || '').trim().toLowerCase();
  const codeStr = data?.code !== undefined && data?.code !== null ? String(data.code).trim() : '';
  const accepted = data?.summary?.accepted;
  const rejected = data?.summary?.rejected;

  const hasFailureStatus = Boolean(statusStr && statusStr !== 'success' && statusStr !== 'ok');
  const hasFailureCode = Boolean(codeStr && codeStr !== '2000');
  const allRejected =
    accepted !== undefined &&
    Number(accepted) === 0 &&
    rejected !== undefined &&
    Number(rejected) > 0;

  const ok = Boolean(upstreamOk) && !hasFailureStatus && !hasFailureCode && !allRejected;
  return {
    ok,
    acceptedCount: accepted !== undefined ? Number(accepted) : null,
    reason: ok
      ? ''
      : data?.message ||
        data?.error ||
        (codeStr ? `mNotify error code ${codeStr}` : 'mNotify rejected SMS dispatch'),
  };
}
