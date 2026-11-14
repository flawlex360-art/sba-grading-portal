export const DEFAULT_MNOTIFY_SENDER_ID = '';

const LEGACY_PLACEHOLDER_SENDER_IDS = new Set(['MADIFOR', 'KPANDO ANG']);

const GSM7_REGEX =
  /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

export const SMS_PACKAGE_PRESETS = [
  {
    id: 'starter_250',
    label: 'Starter 250',
    credits: 250,
    description: 'Single-class alerts & parent reminders',
  },
  {
    id: 'standard_500',
    label: 'Standard 500',
    credits: 500,
    description: 'Single-term JHS broadcast bundle',
  },
  {
    id: 'term_1000',
    label: 'Term Bundle 1,000',
    credits: 1000,
    description: 'School-wide PTA & report notifications',
  },
  {
    id: 'pro_2500',
    label: 'School Pro 2,500',
    credits: 2500,
    description: 'High-volume multi-class school',
  },
  {
    id: 'custom',
    label: 'Custom Package',
    credits: null,
    description: 'Custom credit limit or live wallet cap',
  },
];

/**
 * Normalizes an mNotify Sender ID to at most 11 characters and clears legacy single-tenant placeholders.
 */
export function normalizeSmsSenderId(senderId) {
  const clean = String(senderId ?? '').trim().slice(0, 11);
  if (!clean || LEGACY_PLACEHOLDER_SENDER_IDS.has(clean.toUpperCase())) {
    return '';
  }
  return clean;
}

/**
 * Calculates how many SMS credits (segments) a message consumes under GSM-7 / UCS-2 rules.
 */
export function calculateSmsUnits(messageText = '') {
  const text = String(messageText ?? '');
  if (!text.trim()) return 0;
  const isGsm7 = GSM7_REGEX.test(text);
  const singleLimit = isGsm7 ? 160 : 70;
  const multiLimit = isGsm7 ? 153 : 67;
  if (text.length <= singleLimit) return 1;
  return Math.ceil(text.length / multiLimit);
}

/**
 * Masks an API key for safe display in admin tables and status summaries.
 */
export function maskApiKey(apiKey = '') {
  const clean = String(apiKey ?? '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••`;
  return `${clean.slice(0, 4)}••••••${clean.slice(-4)}`;
}

/**
 * Extracts normalized per-school mNotify gateway configuration from an institution document.
 */
export function normalizeSchoolSmsConfig(institution = {}) {
  const raw = institution?.smsConfig && typeof institution.smsConfig === 'object' ? institution.smsConfig : {};
  return {
    provider: String(raw.provider || 'mnotify').trim() || 'mnotify',
    apiKey: String(raw.apiKey || '').trim(),
    senderId: normalizeSmsSenderId(raw.senderId || ''),
    updatedAt: raw.updatedAt || null,
  };
}

/**
 * Extracts normalized per-school SMS package quota fields from an institution document.
 */
export function normalizeSchoolSmsPackage(institution = {}) {
  const raw = institution?.smsPackage && typeof institution.smsPackage === 'object' ? institution.smsPackage : null;
  if (!raw) {
    return {
      hasPackage: false,
      packageId: 'custom',
      packageName: 'Unassigned',
      creditsAllocated: 0,
      creditsUsed: 0,
      enforceQuota: true,
      lastTopUpAt: null,
      lastUsedAt: null,
      lastMnotifyBalance: null,
      updatedAt: null,
    };
  }

  const creditsAllocated = Math.max(0, Math.round(Number(raw.creditsAllocated) || 0));
  const creditsUsed = Math.max(0, Math.round(Number(raw.creditsUsed) || 0));
  return {
    hasPackage: true,
    packageId: String(raw.packageId || 'custom').trim() || 'custom',
    packageName: String(raw.packageName || 'Custom Package').trim() || 'Custom Package',
    creditsAllocated,
    creditsUsed,
    enforceQuota: raw.enforceQuota !== false,
    lastTopUpAt: raw.lastTopUpAt || null,
    lastUsedAt: raw.lastUsedAt || null,
    lastMnotifyBalance:
      raw.lastMnotifyBalance === null || raw.lastMnotifyBalance === undefined
        ? null
        : Number(raw.lastMnotifyBalance),
    updatedAt: raw.updatedAt || null,
  };
}

/**
 * Computes live SMS balance, quota status, and readiness flags for a school institution.
 */
export function getSchoolSmsPackageSummary(institution = {}) {
  const config = normalizeSchoolSmsConfig(institution);
  const pkg = normalizeSchoolSmsPackage(institution);
  const creditsRemaining = Math.max(0, pkg.creditsAllocated - pkg.creditsUsed);
  const usagePercent =
    pkg.creditsAllocated > 0
      ? Math.min(100, Math.round((pkg.creditsUsed / pkg.creditsAllocated) * 100))
      : pkg.creditsUsed > 0
        ? 100
        : 0;
  const hasApiKey = Boolean(config.apiKey);
  const hasSenderId = Boolean(config.senderId);
  const isGatewayReady = hasApiKey && hasSenderId;
  const isExhausted = pkg.enforceQuota && (!pkg.hasPackage || creditsRemaining <= 0);
  const isLowBalance =
    pkg.enforceQuota &&
    pkg.hasPackage &&
    creditsRemaining > 0 &&
    creditsRemaining <= Math.max(20, Math.round(pkg.creditsAllocated * 0.1));
  const canSend = isGatewayReady && !isExhausted;

  return {
    ...config,
    ...pkg,
    hasApiKey,
    hasSenderId,
    isGatewayReady,
    creditsRemaining,
    usagePercent,
    isLowBalance,
    isExhausted,
    canSend,
    maskedApiKey: maskApiKey(config.apiKey),
  };
}

/**
 * Evaluates an mNotify HTTP + JSON response uniformly, catching logical error statuses inside HTTP 200 payloads.
 */
export function evaluateMnotifyResponse(upstreamOk, data = {}) {
  const status = String(data?.status ?? '').toLowerCase().trim();
  const code = String(data?.code ?? '').trim();
  const hasErrorStatus =
    status === 'error' ||
    status === 'failed' ||
    (status && status !== 'success' && status !== 'ok') ||
    (code && code !== '2000' && code !== '1000');

  const ok = Boolean(upstreamOk) && !hasErrorStatus;
  let errorMessage = '';
  if (!ok) {
    errorMessage =
      data?.message ||
      data?.error ||
      (status ? `mNotify rejected request (status: ${status}${code ? `, code: ${code}` : ''})` : 'mNotify gateway rejected request');
  }

  return {
    ok,
    status: status || (ok ? 'success' : 'error'),
    code,
    reason: errorMessage,
    errorMessage,
  };
}
