export const PARENT_REPORT_TTL_DAYS = 30;
export const PARENT_REPORT_TTL_MS = PARENT_REPORT_TTL_DAYS * 24 * 60 * 60 * 1000;
export const PARENT_REPORT_DOC_PREFIX = 'pr_';
export const MAX_ACTIVE_REPORT_LINKS_ON_DOC = 200;

const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Converts Google Drive sharing links to direct viewable image URLs for school crests.
 * @param {string} url
 * @returns {string}
 */
export function getDirectImageUrl(url) {
  if (!url) return '';
  let fileId = null;
  const dMatch = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  const idMatch = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) fileId = dMatch[1];
  else if (idMatch && idMatch[1]) fileId = idMatch[1];

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return String(url);
}

/**
 * Generates an unguessable lowercase alphanumeric token suitable for compact SMS URLs.
 * Uses unambiguous characters (omits i/l/o/0/1) for readability if typed manually.
 * @param {number} length
 * @returns {string}
 */
export function generateReportToken(length = 10) {
  const targetLen = Math.max(8, Math.min(24, Math.floor(Number(length) || 10)));
  const bytes = new Uint8Array(targetLen);
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < targetLen; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let out = '';
  for (let i = 0; i < targetLen; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/**
 * Maps a short share token to its Firestore document ID inside the `schools` collection.
 * Returns null if the token format is invalid.
 * @param {string} token
 * @returns {string|null}
 */
export function getParentReportDocId(token) {
  const clean = String(token || '').trim().toLowerCase();
  if (!/^[a-z0-9]{6,24}$/.test(clean)) return null;
  return `${PARENT_REPORT_DOC_PREFIX}${clean}`;
}

/**
 * Extracts a report token from a URL pathname like `/r/k8x2m9pqab`.
 * @param {string} pathname
 * @returns {string|null}
 */
export function parseReportTokenFromPathname(pathname) {
  const path = String(pathname || '').trim();
  const match = path.match(/^\/r\/([a-z0-9]{6,24})\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Builds the canonical parent report URL included in SMS messages.
 * @param {string} token
 * @param {string} [origin]
 * @returns {string}
 */
export function buildParentReportUrl(token, origin) {
  const cleanToken = String(token || '').trim().toLowerCase();
  if (!cleanToken) return '';
  const fallbackOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://sba-portal.vercel.app';
  const cleanOrigin = String(origin || fallbackOrigin).replace(/\/+$/, '');
  return `${cleanOrigin}/r/${cleanToken}`;
}

function roundScore(val) {
  if (val === '' || val === null || val === undefined) return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 10) / 10;
}

function normalizeSubjectEntries(subjectsObj) {
  if (!subjectsObj || typeof subjectsObj !== 'object') return [];
  return Object.entries(subjectsObj)
    .filter(([, details]) => details && typeof details === 'object')
    .map(([subjectName, details]) => ({
      name: String(subjectName || '').trim(),
      scaledSba: roundScore(details.scaledSba),
      scaledExam: roundScore(details.scaledExam),
      total: roundScore(details.total),
      grade: details.grade !== undefined && details.grade !== null ? String(details.grade) : '-',
      remark: String(details.remark || '').trim(),
      rank: details.rank !== undefined && details.rank !== null ? String(details.rank) : '-',
    }))
    .filter((entry) => entry.name.length > 0 && (entry.total !== null || entry.scaledSba !== null || entry.scaledExam !== null));
}

/**
 * Builds a minimal, privacy-conscious mobile report snapshot for a single learner.
 * Omits phone numbers, API keys, and teacher credentials; sets 30-day expiry timestamps.
 * @param {object} params
 * @returns {object}
 */
export function buildParentReportSnapshot({
  learner,
  metadata = {},
  institution = null,
  viewingTerm = '',
  teacherUid = '',
  token,
  nowMs = Date.now(),
}) {
  const issuedMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const expiresAtMs = issuedMs + PARENT_REPORT_TTL_MS;
  const cleanToken = String(token || '').trim().toLowerCase();

  const schoolName = String(
    institution?.schoolName || institution?.name || metadata?.schoolName || 'Our School'
  ).trim() || 'Our School';
  const schoolCrestUrl = String(
    institution?.schoolCrestUrl || metadata?.schoolCrestUrl || ''
  ).trim();
  const resolvedTerm = String(viewingTerm || metadata?.term || 'Term 1').trim() || 'Term 1';
  const subjects = normalizeSubjectEntries(learner?.subjects);

  const avgRaw = learner?.averageScore ?? learner?.average;
  const avgNum =
    avgRaw !== null && avgRaw !== undefined && avgRaw !== ''
      ? roundScore(avgRaw)
      : null;
  const totalNum =
    learner?.overallTotal !== null && learner?.overallTotal !== undefined && learner?.overallTotal !== ''
      ? roundScore(learner.overallTotal)
      : null;

  return {
    isParentReportSnapshot: true,
    version: 1,
    token: cleanToken,
    createdAt: new Date(issuedMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    createdAtMs: issuedMs,
    expiresAtMs,
    teacherUid: String(teacherUid || '').trim(),
    schoolId: String(institution?.id || metadata?.institutionId || '').trim(),
    schoolName,
    schoolCrestUrl,
    className: String(metadata?.classLevel || metadata?.className || learner?.className || '').trim(),
    academicYear: String(metadata?.academicYear || '').trim(),
    term: resolvedTerm,
    timesOpen: metadata?.timesOpen !== undefined && metadata?.timesOpen !== null && metadata?.timesOpen !== ''
      ? String(metadata.timesOpen)
      : '',
    reopeningDate: String(metadata?.nextTermBegins || metadata?.reopeningDate || '').trim(),
    classSize: Number(learner?.classSize || 0) || null,
    studentSn: learner?.sn ?? null,
    studentName: String(learner?.name || 'Learner').trim() || 'Learner',
    gender: String(learner?.gender || '').trim(),
    parentName: String(learner?.parentName || 'Parent/Guardian').trim() || 'Parent/Guardian',
    overallTotal: totalNum,
    average: avgNum,
    overallRank: String(learner?.overallRank || learner?.position || '-').trim() || '-',
    attendance: learner?.attendance !== undefined && learner?.attendance !== null ? String(learner.attendance) : '',
    conduct: String(learner?.conduct || '').trim(),
    interest: String(learner?.interest || '').trim(),
    remarks: String(learner?.remarks || '').trim(),
    promotedTo: String(learner?.promotedTo || '').trim(),
    subjects,
  };
}

/**
 * Determines whether a stored report snapshot should be deactivated / treated as expired.
 * @param {object|null|undefined} snapshot
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isParentReportExpired(snapshot, nowMs = Date.now()) {
  if (!snapshot || typeof snapshot !== 'object') return true;
  if (snapshot.isParentReportSnapshot !== true) return true;
  const expiryMs = Number(snapshot.expiresAtMs);
  if (!Number.isFinite(expiryMs) || expiryMs <= 0) return true;
  return Number(nowMs) > expiryMs;
}

/**
 * Separates active report link tracking entries from expired ones that can be batch-deleted.
 * @param {Array<{token: string, expiresAtMs: number}>} links
 * @param {number} [nowMs]
 * @param {number} [maxActive]
 * @returns {{ activeLinks: Array<object>, expiredTokens: Array<string> }}
 */
export function partitionExpiredReportLinks(
  links = [],
  nowMs = Date.now(),
  maxActive = MAX_ACTIVE_REPORT_LINKS_ON_DOC
) {
  const safeList = Array.isArray(links) ? links : [];
  const activeLinks = [];
  const expiredTokens = [];
  const seenTokens = new Set();

  for (const item of safeList) {
    if (!item || typeof item !== 'object') continue;
    const token = String(item.token || '').trim().toLowerCase();
    if (!token || seenTokens.has(token)) continue;
    seenTokens.add(token);

    const expiryMs = Number(item.expiresAtMs);
    if (!Number.isFinite(expiryMs) || Number(nowMs) > expiryMs) {
      expiredTokens.push(token);
    } else {
      activeLinks.push({
        token,
        expiresAtMs: expiryMs,
        studentSn: item.studentSn ?? null,
        term: String(item.term || '').trim(),
      });
    }
  }

  // Keep newest active links bounded so teacher doc size stays minimal
  if (activeLinks.length > maxActive) {
    activeLinks.sort((a, b) => a.expiresAtMs - b.expiresAtMs);
    const overflow = activeLinks.splice(0, activeLinks.length - maxActive);
    for (const oldItem of overflow) {
      expiredTokens.push(oldItem.token);
    }
  }

  return { activeLinks, expiredTokens };
}
