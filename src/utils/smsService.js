/**
 * Ghanaian Parent SMS & Contact Service for WebSBA
 * Adapts the mNotify Ghana gateway workflow (Simulation Mode & live mNotify proxy)
 * to class-teacher SBA reporting, attendance, and general parent alerts.
 */
import {
  DEFAULT_MNOTIFY_SENDER_ID,
  calculateSmsUnits,
  evaluateMnotifyResponse,
  getSchoolSmsPackageSummary,
  maskApiKey,
  normalizeSmsSenderId,
} from './mnotifyHelpers.js';

export {
  DEFAULT_MNOTIFY_SENDER_ID,
  calculateSmsUnits,
  getSchoolSmsPackageSummary,
  maskApiKey,
  normalizeSmsSenderId,
};

export const SBA_SMS_TEMPLATES = [
  {
    id: 'term_report',
    label: 'End-of-Term Report Alert',
    body: "Dear {parent_name}, {student_name} {term} ({class}): Score {total_score}, Avg {average}%, Pos {position}. Report: {report_link} - {school_name}",
  },
  {
    id: 'pta_reminder',
    label: 'PTA Meeting Reminder',
    body: 'Dear {parent_name}, kindly be reminded of our PTA meeting on {pta_date} concerning {student_name} ({class}). Your punctual attendance is greatly appreciated. - {school_name}',
  },
  {
    id: 'stem_focus',
    label: 'Maths & Science Focus Alert',
    body: 'Dear {parent_name}, {student_name} ({class}) scored Maths: {maths_score}% and Science: {science_score}% in {term}. Kindly supervise daily home study and revision. - {school_name}',
  },
  {
    id: 'attendance_notice',
    label: 'Attendance & Conduct Notice',
    body: "Dear {parent_name}, {student_name}'s {term} attendance in {class} is {attendance} out of {times_open} days (Conduct: {conduct}). Kindly contact the class teacher if needed. - {school_name}",
  },
  {
    id: 'reopening_notice',
    label: 'Reopening Date Reminder',
    body: 'Dear {parent_name}, kindly take note that next term begins on {reopening_date} for {student_name} ({class}). Thank you. - {school_name}',
  },
  {
    id: 'custom_notice',
    label: 'Custom Parent Message',
    body: 'Dear {parent_name}, kindly be informed regarding {student_name} ({class}): - {school_name}',
  },
];

/**
 * Normalizes a Ghanaian telephone number to international 233XXXXXXXXX format.
 */
export function formatGhanaPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00233') && digits.length === 14) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

/**
 * Validates that a phone string normalizes cleanly to a 12-digit Ghana number (233XXXXXXXXX).
 */
export function isValidGhanaPhone(phone) {
  return /^233\d{9}$/.test(formatGhanaPhone(phone));
}

/**
 * Converts uppercase or inconsistent parent/learner names into clean Title Case
 * so SMS copy reads naturally while preserving broadsheet/roster uppercase records.
 */
export function formatSmsName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-/.(]|'(?!s(?:\s|$)))([a-z])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`);
}

/**
 * Normalizes a parent/guardian contact name for storage.
 */
export function normalizeParentName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes a phone string for clean input display without stripping valid local formatting.
 */
export function normalizePhoneInput(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/[^\d+\s-]/g, '').replace(/\s+/g, ' ');
}

/**
 * Parses multi-line pasted parent contact rows (e.g. from WhatsApp, Notes, or Excel).
 * Supports forms such as:
 *   "1. Mr. Kofi Mensah - 0244123456"
 *   "Mrs. Akua Boateng\t0509876543"
 *   "Abigail Mensah, 0241234567"
 *   "0244123456"
 */
export function parsePastedParentContacts(text) {
  if (typeof text !== 'string') return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const results = [];

  for (const rawLine of lines) {
    // Strip leading serial numbering or bullet markers (e.g., "1.", "12)", "- ", "• ")
    let cleaned = rawLine.replace(/^\s*(?:\d{1,3}[.):\-]\s+|[-•*]+\s+)/, '').trim();
    if (!cleaned) continue;

    // Locate phone-like token at the end (e.g., 0244123456, +233 24 412 3456, 244123456)
    const phoneMatch = cleaned.match(/((?:\+?233|0)[\d\s\-]{8,14}|\b\d{9,12}\b)\s*$/);
    if (phoneMatch) {
      const candidateDigits = phoneMatch[1].replace(/\D/g, '');
      if (candidateDigits.length >= 9) {
        const parentPhone = phoneMatch[1].trim().replace(/\s+/g, '');
        const rawNamePart = cleaned
          .slice(0, phoneMatch.index)
          .trim()
          .replace(/[\t,;:\-–/|]+$/, '')
          .trim();
        results.push({
          parentName: normalizeParentName(rawNamePart),
          parentPhone,
        });
        continue;
      }
    }

    // Fallback: delimited columns where phone might not be matched above
    const parts = cleaned.split(/\t|\s*,\s*|\s+[-–/|]\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const namePart = parts.slice(0, -1).join(' ');
      results.push({
        parentName: normalizeParentName(namePart),
        parentPhone: normalizePhoneInput(last),
      });
    } else {
      results.push({
        parentName: normalizeParentName(cleaned),
        parentPhone: '',
      });
    }
  }

  return results;
}

/**
 * Formats an ISO YYYY-MM-DD date string into a concise readable SMS date (e.g. "12 Jan 2027").
 */
export function formatSmsDateDisplay(dateStr) {
  const raw = String(dateStr || '').trim();
  if (!raw) return 'TBA';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return raw;
  const year = Number(isoMatch[1]);
  const monthIdx = Number(isoMatch[2]) - 1;
  const day = Number(isoMatch[3]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (monthIdx < 0 || monthIdx > 11 || !day) return raw;
  return `${day} ${months[monthIdx]} ${year}`;
}

/**
 * Replaces SBA SMS placeholders with formatted parent, learner, score, and school values.
 */
export function interpolateSmsTemplate(template, context = {}) {
  if (!template) return '';

  const parentDisplay = formatSmsName(context.parentName) || 'Parent/Guardian';
  const studentDisplay = formatSmsName(context.studentName) || 'your ward';
  const cleanScore = (val) =>
    val !== undefined && val !== null && val !== '' ? String(val) : '-';

  const replacements = {
    '{parent_name}': parentDisplay,
    '{student_name}': studentDisplay,
    '{class}': context.className || 'Class',
    '{term}': context.term || 'Term 1',
    '{total_score}': cleanScore(context.totalScore),
    '{average}': cleanScore(context.average),
    '{position}': context.position || '-',
    '{maths_score}': cleanScore(context.mathsScore),
    '{science_score}': cleanScore(context.scienceScore),
    '{english_score}': cleanScore(context.englishScore),
    '{attendance}': cleanScore(context.attendance),
    '{times_open}': cleanScore(context.timesOpen),
    '{conduct}': String(context.conduct || 'Satisfactory').trim() || 'Satisfactory',
    '{remark}': String(context.remark || 'Keep up the good effort').trim() || 'Keep up the good effort',
    '{reopening_date}': formatSmsDateDisplay(context.reopeningDate),
    '{pta_date}': formatSmsDateDisplay(context.ptaDate),
    '{report_link}': String(context.reportLink || '').trim() || 'Link generated on send',
    '{school_name}': String(context.schoolName || 'Our School').trim() || 'Our School',
  };

  let output = template;
  Object.entries(replacements).forEach(([token, value]) => {
    output = output.split(token).join(value);
  });
  return output;
}

/**
 * Checks whether Vercel /api/send-sms school credentials and package quota are active.
 */
export async function checkSmsServerStatus(institutionId = '') {
  try {
    const cleanId = String(institutionId || '').trim();
    const qs = cleanId ? `?institutionId=${encodeURIComponent(cleanId)}` : '';
    const res = await fetch(`/api/send-sms${qs}`, { method: 'GET' });
    if (!res.ok) return null;
    const contentType = res.headers?.get?.('content-type') || '';
    if (contentType && !contentType.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Verifies an mNotify API key, retrieves live wallet balance, and checks Sender ID approval status.
 */
export async function verifySchoolSmsGateway({
  institutionId = '',
  apiKey = '',
  senderId = '',
} = {}) {
  const cleanKey = String(apiKey || '').trim();
  const cleanSender = normalizeSmsSenderId(senderId);

  try {
    const res = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        institutionId: String(institutionId || '').trim(),
        apiKey: cleanKey,
        senderId: cleanSender,
      }),
    });

    if (res.status !== 404 && res.status !== 405) {
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          keyValid: false,
          error: data?.error || `Verification failed (HTTP ${res.status})`,
        };
      }
      return data;
    }
  } catch (err) {
    if (!String(err?.message || '').includes('Failed to fetch') && !cleanKey) {
      return { ok: false, keyValid: false, error: err?.message || 'Verification failed' };
    }
  }

  // Direct mNotify fallback during local Vite dev when /api/send-sms is not running
  if (!cleanKey) {
    return {
      ok: false,
      keyValid: false,
      error: 'Local /api/send-sms proxy unavailable. Provide an mNotify API key to verify.',
    };
  }

  try {
    const balRes = await fetch(
      `https://api.mnotify.com/api/balance/sms?key=${encodeURIComponent(cleanKey)}`
    );
    const balData = await balRes.json().catch(() => ({}));
    if (!balRes.ok || String(balData?.status || '').toLowerCase() !== 'success') {
      return {
        ok: false,
        keyValid: false,
        error: balData?.message || `mNotify rejected key (HTTP ${balRes.status})`,
      };
    }

    let senderStatus = 'unchecked';
    let senderPurpose = '';
    if (cleanSender) {
      try {
        const sndRes = await fetch(
          `https://api.mnotify.com/api/senderid/status/?key=${encodeURIComponent(cleanKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_name: cleanSender }),
          }
        );
        const sndData = await sndRes.json().catch(() => ({}));
        if (sndRes.ok && sndData?.summary) {
          senderStatus = String(sndData.summary.status || 'approved').toLowerCase();
          senderPurpose = String(sndData.summary.purpose || '');
        } else if (sndRes.status === 404) {
          senderStatus = 'not_found';
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
  } catch (err) {
    return { ok: false, keyValid: false, error: err?.message || 'Failed reaching mNotify' };
  }
}

/**
 * Dispatches a personalized SMS batch (single or group) to parents via /api/send-sms proxy
 * (falling back to direct mNotify if proxy route is absent during local Vite dev),
 * or simulates delivery when provider is set to 'simulation'.
 */
export async function dispatchParentSmsBatch({
  recipients = [],
  messageTemplate,
  metadata = {},
  viewingTerm = 'Term 1',
  gatewayConfig = {},
  smsPackage = null,
  institutionId = '',
}) {
  const provider = gatewayConfig?.provider || 'mnotify';
  const apiKey = String(gatewayConfig?.apiKey || '').trim();
  const dispatchSecret = String(gatewayConfig?.dispatchSecret || '').trim();
  const rawSenderId = normalizeSmsSenderId(gatewayConfig?.senderId);
  const resolvedInstId = String(institutionId || gatewayConfig?.institutionId || '').trim();

  const dispatches = recipients.map((rec) => {
    const formattedPhone = formatGhanaPhone(rec.parentPhone);
    const personalizedBody = interpolateSmsTemplate(messageTemplate, {
      parentName: rec.parentName,
      studentName: rec.name,
      className: metadata?.classLevel || rec.className || 'Class',
      term: viewingTerm || metadata?.term || 'Term 1',
      totalScore: rec.overallTotal,
      average: rec.averageScore,
      position: rec.overallRank,
      mathsScore: rec.mathsScore,
      scienceScore: rec.scienceScore,
      englishScore: rec.englishScore,
      attendance: rec.attendance,
      timesOpen: metadata?.timesOpen,
      conduct: rec.conduct,
      remark: rec.remarks || rec.remark,
      reopeningDate: metadata?.nextTermBegins,
      ptaDate: metadata?.ptaDate,
      reportLink: rec.reportLink,
      schoolName: metadata?.schoolName,
    });

    return {
      studentSn: rec.sn,
      studentName: rec.name,
      parentName: rec.parentName,
      phone: formattedPhone,
      rawPhone: rec.parentPhone || '',
      reportToken: rec.reportToken || '',
      reportLink: rec.reportLink || '',
      message: personalizedBody,
      units: Math.max(1, calculateSmsUnits(personalizedBody)),
    };
  });

  if (provider !== 'simulation') {
    const validDispatches = dispatches.filter((d) => /^233\d{9}$/.test(d.phone));
    const invalidDispatches = dispatches.filter((d) => !/^233\d{9}$/.test(d.phone));
    const failures = invalidDispatches.map((d) => ({
      ...d,
      reason: 'Missing or invalid Ghanaian phone number',
    }));

    if (validDispatches.length === 0) {
      return {
        mode: provider,
        total: dispatches.length,
        deliveredCount: 0,
        failedCount: failures.length,
        creditsConsumed: 0,
        totalUnitsEstimated: 0,
        latestMnotifyCreditLeft: null,
        failures,
        dispatches,
      };
    }

    if (!rawSenderId) {
      throw new Error(
        'No approved mNotify Sender ID is configured for this school. Set one (max 11 characters) in school SMS settings.'
      );
    }

    const totalUnitsEstimated = validDispatches.reduce((sum, d) => sum + d.units, 0);

    if (smsPackage && smsPackage.enforceQuota !== false) {
      const remaining = Math.max(
        0,
        Number(smsPackage.creditsRemaining ?? (smsPackage.creditsAllocated || 0) - (smsPackage.creditsUsed || 0))
      );
      if (smsPackage.hasPackage === false) {
        throw new Error(
          'No active SMS package is assigned to this school. Ask Senior Super User to assign SMS package credits.'
        );
      }
      if (remaining < totalUnitsEstimated) {
        throw new Error(
          `Insufficient school SMS credits: ${totalUnitsEstimated} SMS credits required, but only ${remaining} remaining.`
        );
      }
    }

    if (provider === 'mnotify') {
      try {
        const proxyRes = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institutionId: resolvedInstId,
            provider,
            senderId: rawSenderId,
            apiKey,
            dispatchSecret,
            messages: validDispatches.map((d) => ({
              phone: d.phone,
              message: d.message,
            })),
          }),
        });

        // If local Vite dev server returns 404/405 for /api/send-sms, fall back cleanly if apiKey exists
        if (proxyRes.status !== 404 && proxyRes.status !== 405) {
          let proxyData = {};
          try {
            proxyData = await proxyRes.json();
          } catch {
            proxyData = {};
          }
          if (!proxyRes.ok) {
            throw new Error(proxyData.error || `Gateway proxy error (HTTP ${proxyRes.status})`);
          }

          const proxyFailures = Array.isArray(proxyData.failures) ? proxyData.failures : [];
          const delivered = Number(proxyData.deliveredCount ?? proxyData.sentCount ?? 0);
          return {
            mode: provider,
            total: dispatches.length,
            deliveredCount: delivered,
            failedCount: failures.length + proxyFailures.length,
            creditsConsumed: Number(proxyData.creditsConsumed ?? 0),
            totalUnitsEstimated,
            latestMnotifyCreditLeft: proxyData.latestMnotifyCreditLeft ?? null,
            failures: [...failures, ...proxyFailures],
            dispatches,
          };
        }
      } catch (err) {
        if (!String(err?.message || '').includes('Failed to fetch')) {
          throw err;
        }
      }
    }

    if (!apiKey) {
      throw new Error(
        'Server /api/send-sms proxy is unavailable locally and no school mNotify API key was supplied.'
      );
    }

    let deliveredCount = 0;
    let creditsConsumed = 0;
    let latestMnotifyCreditLeft = null;
    for (const item of validDispatches) {
      try {
        const res = await fetch(
          `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              recipient: [item.phone],
              sender: rawSenderId,
              message: item.message,
              is_schedule: false,
              schedule_date: '',
            }),
          }
        );
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        const evalResult = evaluateMnotifyResponse(res.ok, data);
        if (!evalResult.ok) {
          throw new Error(evalResult.errorMessage || evalResult.reason || `HTTP ${res.status}`);
        }
        deliveredCount += 1;
        const used = Number(data?.summary?.credit_used);
        creditsConsumed += Number.isFinite(used) && used > 0 ? used : item.units;
        if (data?.summary?.credit_left !== undefined && data?.summary?.credit_left !== null) {
          latestMnotifyCreditLeft = Number(data.summary.credit_left);
        }
      } catch (err) {
        failures.push({ ...item, reason: err.message });
      }
    }

    return {
      mode: provider,
      total: dispatches.length,
      deliveredCount,
      failedCount: failures.length,
      creditsConsumed,
      totalUnitsEstimated,
      latestMnotifyCreditLeft,
      failures,
      dispatches,
    };
  }

  // Simulation Mode fallback for zero-cost verification (does not consume real credits)
  await new Promise((resolve) => setTimeout(resolve, 400));
  const validDispatches = dispatches.filter((d) => /^233\d{9}$/.test(d.phone));
  const invalidDispatches = dispatches.filter((d) => !/^233\d{9}$/.test(d.phone));

  return {
    mode: 'Simulation Mode',
    total: dispatches.length,
    deliveredCount: validDispatches.length,
    failedCount: invalidDispatches.length,
    creditsConsumed: 0,
    totalUnitsEstimated: validDispatches.reduce((sum, d) => sum + d.units, 0),
    latestMnotifyCreditLeft: null,
    failures: invalidDispatches.map((d) => ({
      ...d,
      reason: 'Invalid or missing Ghanaian phone number',
    })),
    dispatches,
  };
}

/**
 * Dispatches a single quick verification SMS using the configured gateway & Sender ID.
 */
export async function sendSingleTestSms({
  phone,
  metadata = {},
  gatewayConfig = {},
  smsPackage = null,
  institutionId = '',
}) {
  const schoolName = String(metadata?.schoolName || 'SBA Portal').trim() || 'SBA Portal';
  const senderLabel = normalizeSmsSenderId(gatewayConfig?.senderId);
  const senderTag = senderLabel ? ` (${senderLabel})` : '';
  const testBody = `Test SMS from ${schoolName}${senderTag}. Parent SMS alert system is working properly.`;

  return dispatchParentSmsBatch({
    recipients: [
      {
        sn: 0,
        name: 'Test Verification',
        parentName: 'Teacher Test',
        parentPhone: phone,
      },
    ],
    messageTemplate: testBody,
    metadata,
    viewingTerm: metadata?.term || 'Term 1',
    gatewayConfig,
    smsPackage,
    institutionId,
  });
}
