import dns from 'node:dns';
import { createRequire } from 'node:module';
import {
  calculateSmsUnits,
  evaluateMnotifyResponse,
  getSchoolSmsPackageSummary,
  normalizeSmsSenderId,
} from '../src/utils/mnotifyHelpers.js';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // Ignore on runtimes where dns order is locked.
}

const require = createRequire(import.meta.url);
const { timingSafeEqual } = require('node:crypto');

const MNOTIFY_CONCURRENCY = 5;
const FIREBASE_PROJECT_ID =
  String(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      'sba-portal-flawlex-2026'
  ).trim() || 'sba-portal-flawlex-2026';

function decodeFirestoreValue(val) {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const out = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map(decodeFirestoreValue);
  }
  return undefined;
}

function getEnvSchoolFallback(institutionId) {
  const cleanId = String(institutionId || '').trim();
  if (!cleanId) return null;
  try {
    const rawJson = String(process.env.MNOTIFY_SCHOOL_KEYS_JSON || '').trim();
    if (!rawJson) return null;
    const parsed = JSON.parse(rawJson);
    const entry = parsed?.[cleanId];
    return entry && typeof entry === 'object' ? entry : null;
  } catch {
    return null;
  }
}

async function fetchInstitutionSmsState(institutionId) {
  const cleanId = String(institutionId || '').trim();
  if (!cleanId) return null;

  let docData = {};
  let docFound = false;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/institutions/${encodeURIComponent(cleanId)}`;
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const fields = json?.fields || {};
      for (const [k, v] of Object.entries(fields)) {
        docData[k] = decodeFirestoreValue(v);
      }
      docFound = true;
    }
  } catch {
    // Allow fallback to env-mapped school entry below if Firestore lookup transiently fails.
  }

  const envFallback = getEnvSchoolFallback(cleanId);
  if (!docData?.smsConfig?.apiKey && envFallback?.apiKey) {
    docData = {
      ...docData,
      smsConfig: {
        provider: envFallback.provider || docData?.smsConfig?.provider || 'mnotify',
        apiKey: String(envFallback.apiKey || '').trim(),
        senderId: docData?.smsConfig?.senderId || envFallback.senderId || '',
      },
      smsPackage: docData?.smsPackage || envFallback.smsPackage || null,
    };
  }

  if (!docFound && !envFallback) {
    return null;
  }

  return {
    id: cleanId,
    schoolName: String(docData.schoolName || ''),
    summary: getSchoolSmsPackageSummary(docData),
  };
}

function normalizeRecipients(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => ({
      to: String(m?.to || m?.phone || '').replace(/\D/g, ''),
      text: String(m?.text || m?.message || '').trim(),
    }))
    .filter((m) => m.to.length >= 10 && m.text.length > 0);
}

function constantTimeMatch(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function verifyMnotifyCredentials(apiKey, senderId = '') {
  const balRes = await fetch(
    `https://api.mnotify.com/api/balance/sms?key=${encodeURIComponent(apiKey)}`,
    { method: 'GET', signal: AbortSignal.timeout(10000) }
  );
  let balData = {};
  try {
    balData = await balRes.json();
  } catch {
    balData = {};
  }

  if (!balRes.ok || String(balData?.status || '').toLowerCase() !== 'success') {
    return {
      ok: false,
      keyValid: false,
      error: balData?.message || `mNotify rejected API key (HTTP ${balRes.status}).`,
    };
  }

  const cleanSender = normalizeSmsSenderId(senderId);
  let senderStatus = 'unchecked';
  let senderPurpose = '';

  if (cleanSender) {
    try {
      const sndRes = await fetch(
        `https://api.mnotify.com/api/senderid/status/?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_name: cleanSender }),
          signal: AbortSignal.timeout(10000),
        }
      );
      let sndData = {};
      try {
        sndData = await sndRes.json();
      } catch {
        sndData = {};
      }
      if (sndRes.ok && sndData?.summary) {
        senderStatus = String(sndData.summary.status || 'approved').toLowerCase();
        senderPurpose = String(sndData.summary.purpose || '');
      } else if (sndRes.status === 404) {
        senderStatus = 'not_found';
      } else {
        senderStatus = String(sndData?.message || 'unknown').toLowerCase();
      }
    } catch {
      senderStatus = 'check_failed';
    }
  }

  return {
    ok: true,
    keyValid: true,
    mnotifyBalance: Number(balData.balance ?? 0),
    bonus: Number(balData.bonus ?? 0),
    wallet: String(balData.wallet ?? '0'),
    senderId: cleanSender,
    senderStatus,
    senderPurpose,
  };
}

async function sendMnotifyBatch(phones, text, sender, apiKey) {
  const recipientUnits = phones.length * Math.max(1, calculateSmsUnits(text));
  try {
    const upstream = await fetch(
      `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: phones,
          sender,
          message: text,
          is_schedule: false,
          schedule_date: '',
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    let data = {};
    try {
      data = await upstream.json();
    } catch {
      data = {};
    }

    const evalResult = evaluateMnotifyResponse(upstream.ok, data);
    if (!evalResult.ok) {
      const reason = evalResult.errorMessage || evalResult.reason || `mNotify HTTP ${upstream.status}`;
      return { ok: false, phones, count: phones.length, creditsUsed: 0, mnotifyCreditLeft: null, reason };
    }

    const reportedUsed = Number(data?.summary?.credit_used);
    const creditsUsed =
      Number.isFinite(reportedUsed) && reportedUsed > 0 ? reportedUsed : recipientUnits;
    const rawCreditLeft = data?.summary?.credit_left;
    const mnotifyCreditLeft =
      rawCreditLeft === null || rawCreditLeft === undefined ? null : Number(rawCreditLeft);

    return {
      ok: true,
      phones,
      count: phones.length,
      creditsUsed,
      mnotifyCreditLeft: Number.isFinite(mnotifyCreditLeft) ? mnotifyCreditLeft : null,
      messageId: data?.summary?._id || '',
    };
  } catch (err) {
    const reason = err?.message || 'Network error reaching mNotify';
    return { ok: false, phones, count: phones.length, creditsUsed: 0, mnotifyCreditLeft: null, reason };
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const institutionId = String(req.query?.institutionId || '').trim();
    if (!institutionId) {
      return res.status(200).json({
        ok: true,
        mode: 'mnotify-multi-tenant',
        multiTenant: true,
        configured: false,
      });
    }

    const state = await fetchInstitutionSmsState(institutionId);
    if (!state) {
      return res.status(200).json({
        ok: true,
        mode: 'mnotify-multi-tenant',
        institutionId,
        configured: false,
        hasApiKey: false,
        senderId: '',
        smsPackage: null,
      });
    }

    const { summary } = state;
    return res.status(200).json({
      ok: true,
      mode: 'mnotify-multi-tenant',
      institutionId,
      schoolName: state.schoolName,
      configured: summary.isGatewayReady,
      hasApiKey: summary.hasApiKey,
      maskedApiKey: summary.maskedApiKey,
      provider: summary.provider,
      senderId: summary.senderId,
      smsPackage: {
        hasPackage: summary.hasPackage,
        packageId: summary.packageId,
        packageName: summary.packageName,
        creditsAllocated: summary.creditsAllocated,
        creditsUsed: summary.creditsUsed,
        creditsRemaining: summary.creditsRemaining,
        enforceQuota: summary.enforceQuota,
        isExhausted: summary.isExhausted,
      },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const {
    action = 'send',
    institutionId = '',
    provider = 'mnotify',
    senderId = '',
    messages = [],
    apiKey = '',
    dispatchSecret = '',
  } = req.body || {};

  const expectedSecret = String(process.env.SMS_DISPATCH_SECRET || '').trim();
  if (expectedSecret && !constantTimeMatch(dispatchSecret, expectedSecret)) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: invalid SMS dispatch secret.',
    });
  }

  const cleanInstId = String(institutionId || '').trim();
  const institutionState = cleanInstId ? await fetchInstitutionSmsState(cleanInstId) : null;

  if (action === 'verify') {
    const resolvedKey =
      String(apiKey || '').trim() || institutionState?.summary?.apiKey || '';
    if (!resolvedKey) {
      return res.status(400).json({
        ok: false,
        keyValid: false,
        error: 'Enter an mNotify API key or configure one for this school first.',
      });
    }
    const targetSender = senderId || institutionState?.summary?.senderId || '';
    const verifyResult = await verifyMnotifyCredentials(resolvedKey, targetSender);
    return res.status(verifyResult.ok ? 200 : 400).json(verifyResult);
  }

  if (provider !== 'mnotify') {
    return res.status(400).json({ ok: false, error: `Unsupported SMS provider: ${provider}` });
  }

  const explicitKey = String(apiKey || '').trim();
  const schoolKey = institutionState?.summary?.apiKey || '';
  const standaloneEnvKey = !cleanInstId ? String(process.env.MNOTIFY_API_KEY || '').trim() : '';
  const resolvedKey = explicitKey || schoolKey || standaloneEnvKey;

  if (!resolvedKey) {
    return res.status(400).json({
      ok: false,
      error: cleanInstId
        ? `No mNotify API key is configured for ${institutionState?.schoolName || 'this school'}. Configure the school's API key and SMS package in Senior Super User or School Admin settings.`
        : 'Missing mNotify API key for SMS dispatch.',
    });
  }

  const cleanSender = normalizeSmsSenderId(senderId || institutionState?.summary?.senderId || '');
  if (!cleanSender) {
    return res.status(400).json({
      ok: false,
      error: `No approved mNotify Sender ID is configured for ${institutionState?.schoolName || 'this school'}. Set an 11-character Sender ID in school SMS settings.`,
    });
  }

  const validMessages = normalizeRecipients(messages);
  if (validMessages.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No valid recipient phone numbers or message bodies were provided.',
    });
  }
  if (validMessages.length > 250) {
    return res.status(400).json({
      ok: false,
      error: 'Batch limit exceeded (max 250 recipients per request).',
    });
  }

  const totalUnitsRequired = validMessages.reduce(
    (sum, item) => sum + Math.max(1, calculateSmsUnits(item.text)),
    0
  );

  // Enforce school-level SMS package quota unless explicitly using an unsaved key test without package restrictions
  if (institutionState?.summary?.enforceQuota && !explicitKey) {
    const pkg = institutionState.summary;
    if (!pkg.hasPackage || pkg.creditsRemaining < totalUnitsRequired) {
      return res.status(402).json({
        ok: false,
        error: !pkg.hasPackage
          ? `No active SMS package is assigned to ${institutionState.schoolName || 'this school'}. Ask Senior Super User to assign an SMS package.`
          : `Insufficient SMS package credits for ${institutionState.schoolName || 'this school'}: ${pkg.creditsRemaining} left, ${totalUnitsRequired} required.`,
        creditsRemaining: pkg.creditsRemaining,
        creditsRequired: totalUnitsRequired,
      });
    }
  }

  const groupedByText = new Map();
  for (const item of validMessages) {
    if (!groupedByText.has(item.text)) groupedByText.set(item.text, []);
    groupedByText.get(item.text).push(item.to);
  }

  const batches = Array.from(groupedByText.entries());
  const failures = [];
  let sentCount = 0;
  let failedCount = 0;
  let creditsConsumed = 0;
  let latestMnotifyCreditLeft = null;

  for (let i = 0; i < batches.length; i += MNOTIFY_CONCURRENCY) {
    const slice = batches.slice(i, i + MNOTIFY_CONCURRENCY);
    const results = await Promise.all(
      slice.map(([text, phones]) => sendMnotifyBatch(phones, text, cleanSender, resolvedKey))
    );
    for (const r of results) {
      if (r.ok) {
        sentCount += r.count;
        creditsConsumed += Number(r.creditsUsed) || 0;
        if (r.mnotifyCreditLeft !== null && r.mnotifyCreditLeft !== undefined) {
          latestMnotifyCreditLeft = r.mnotifyCreditLeft;
        }
      } else {
        failedCount += r.count;
        for (const p of r.phones) {
          failures.push({ to: p, phone: p, reason: r.reason });
        }
      }
    }
  }

  const httpStatus = sentCount > 0 ? 200 : 502;
  return res.status(httpStatus).json({
    ok: sentCount > 0,
    provider: 'mnotify',
    institutionId: cleanInstId || null,
    senderId: cleanSender,
    sentCount,
    deliveredCount: sentCount,
    failedCount,
    creditsConsumed,
    totalUnitsRequired,
    latestMnotifyCreditLeft,
    failures,
  });
}
