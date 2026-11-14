import crypto from 'node:crypto';
import {
  DEFAULT_MNOTIFY_SENDER_ID,
  evaluateMnotifyResponse,
  normalizeSmsSenderId,
} from '../src/utils/mnotifyHelpers.js';

/**
 * Vercel Serverless Function: mNotify Ghana SMS Gateway Proxy
 * Keeps MNOTIFY_API_KEY strictly on the server (never exposed in client JS bundles)
 * and avoids browser CORS restrictions when dispatching SMS from any device.
 */

const MNOTIFY_CONCURRENCY = 5;
const FIRESTORE_PORTAL_DOC_URL =
  'https://firestore.googleapis.com/v1/projects/kpando-anglican-portal/databases/(default)/documents/portal_state/kpando_anglican_basic_school';

async function fetchFirestoreMnotifyKey() {
  try {
    const res = await fetch(FIRESTORE_PORTAL_DOC_URL, { method: 'GET' });
    if (!res.ok) return '';
    const doc = await res.json();
    const serverGwKey =
      doc?.fields?.serverGatewayConfig?.mapValue?.fields?.mnotifyApiKey?.stringValue || '';
    const gwSettingsKey =
      doc?.fields?.gatewaySettings?.mapValue?.fields?.apiKey?.stringValue || '';
    return String(serverGwKey || gwSettingsKey || '').trim();
  } catch {
    return '';
  }
}

function normalizeRecipients(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => ({
      phone: String(m?.phone || '').replace(/\D/g, ''),
      message: String(m?.message || '').trim(),
    }))
    .filter((m) => m.phone.length >= 10 && m.message.length > 0);
}

function constantTimeMatch(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function sendMnotifyBatch(phones, text, sender, apiKey) {
  try {
    const upstream = await fetch(
      `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          recipient: phones,
          sender,
          message: text,
          is_schedule: false,
          schedule_date: '',
        }),
      }
    );

    let data = {};
    try {
      data = await upstream.json();
    } catch {
      data = {};
    }

    const evalResult = evaluateMnotifyResponse(upstream.ok, data);
    if (evalResult.ok) {
      return { deliveredCount: evalResult.acceptedCount ?? phones.length, failures: [] };
    }
    const reason = evalResult.reason || `mNotify HTTP ${upstream.status}`;
    return {
      deliveredCount: 0,
      failures: phones.map((phone) => ({ phone, reason })),
    };
  } catch (err) {
    const reason = err?.message || 'Network error reaching mNotify';
    return {
      deliveredCount: 0,
      failures: phones.map((phone) => ({ phone, reason })),
    };
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const envKey = Boolean(String(process.env.MNOTIFY_API_KEY || '').trim());
    const cloudKey = envKey ? false : Boolean(await fetchFirestoreMnotifyKey());
    return res.status(200).json({
      serverKeyConfigured: envKey || cloudKey,
      cloudKeyConfigured: cloudKey,
      pinConfigured: Boolean(String(process.env.SMS_DISPATCH_SECRET || '').trim()),
      defaultSenderId: normalizeSmsSenderId(
        process.env.MNOTIFY_SENDER_ID || DEFAULT_MNOTIFY_SENDER_ID
      ),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  const {
    provider = 'mnotify',
    senderId = '',
    messages = [],
    apiKey = '',
    dispatchSecret = '',
  } = req.body || {};

  if (provider !== 'mnotify') {
    return res.status(400).json({ error: `Unsupported server proxy provider: ${provider}` });
  }

  const cleanSender = normalizeSmsSenderId(
    senderId || process.env.MNOTIFY_SENDER_ID || DEFAULT_MNOTIFY_SENDER_ID
  );
  if (cleanSender.length < 3 || cleanSender.length > 11) {
    return res.status(400).json({
      error: 'Sender ID must be between 3 and 11 characters.',
    });
  }

  const validMessages = normalizeRecipients(messages);
  if (validMessages.length === 0) {
    return res.status(400).json({
      error: 'No valid recipient phone numbers or message content provided.',
    });
  }

  // Resolve key: explicit request key -> Vercel MNOTIFY_API_KEY -> Firebase Firestore cloud key
  let effectiveKey = String(apiKey || '').trim();
  if (!effectiveKey && process.env.MNOTIFY_API_KEY) {
    const expectedSecret = String(process.env.SMS_DISPATCH_SECRET || '').trim();
    if (expectedSecret && !constantTimeMatch(dispatchSecret.trim(), expectedSecret)) {
      return res.status(401).json({
        error: 'Invalid or missing Server Dispatch PIN. Check your PIN in Gateway Settings.',
      });
    }
    effectiveKey = String(process.env.MNOTIFY_API_KEY).trim();
  }

  if (!effectiveKey) {
    effectiveKey = await fetchFirestoreMnotifyKey();
  }

  if (!effectiveKey) {
    return res.status(400).json({
      error:
        'Missing SMS gateway credentials. Configure MNOTIFY_API_KEY on Vercel or enter your mNotify API key in Gateway Settings.',
    });
  }

  const groupedByText = new Map();
  for (const item of validMessages) {
    if (!groupedByText.has(item.message)) groupedByText.set(item.message, []);
    groupedByText.get(item.message).push(item.phone);
  }

  const batches = Array.from(groupedByText.entries());
  let deliveredCount = 0;
  const failures = [];

  for (let i = 0; i < batches.length; i += MNOTIFY_CONCURRENCY) {
    const slice = batches.slice(i, i + MNOTIFY_CONCURRENCY);
    const results = await Promise.all(
      slice.map(([text, phones]) => sendMnotifyBatch(phones, text, cleanSender, effectiveKey))
    );
    for (const r of results) {
      deliveredCount += r.deliveredCount;
      failures.push(...r.failures);
    }
  }

  return res.status(200).json({
    provider: 'mnotify',
    deliveredCount,
    failedCount: failures.length,
    failures,
  });
}
