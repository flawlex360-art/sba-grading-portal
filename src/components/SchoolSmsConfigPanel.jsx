import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { db } from '../utils/firebase';
import {
  SMS_PACKAGE_PRESETS,
  getSchoolSmsPackageSummary,
  normalizeSmsSenderId,
} from '../utils/mnotifyHelpers';
import {
  formatGhanaPhone,
  isValidGhanaPhone,
  sendSingleTestSms,
  verifySchoolSmsGateway,
} from '../utils/smsService';

export default function SchoolSmsConfigPanel({
  institution,
  canManagePackage = false,
  onSaved,
  onClose,
}) {
  const summary = getSchoolSmsPackageSummary(institution || {});

  const [apiKey, setApiKey] = useState(summary.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [senderId, setSenderId] = useState(summary.senderId);

  const [packageId, setPackageId] = useState(summary.packageId);
  const [packageName, setPackageName] = useState(
    summary.hasPackage ? summary.packageName : 'Standard 500'
  );
  const [creditsAllocated, setCreditsAllocated] = useState(
    summary.hasPackage ? String(summary.creditsAllocated) : '0'
  );
  const [creditsUsed, setCreditsUsed] = useState(String(summary.creditsUsed));
  const [enforceQuota, setEnforceQuota] = useState(summary.enforceQuota);

  const [verifying, setVerifying] = useState(false);
  const [verifyInfo, setVerifyInfo] = useState(null);

  const [testPhone, setTestPhone] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const next = getSchoolSmsPackageSummary(institution || {});
    setApiKey(next.apiKey);
    setSenderId(next.senderId);
    setPackageId(next.packageId);
    setPackageName(next.hasPackage ? next.packageName : 'Standard 500');
    setCreditsAllocated(next.hasPackage ? String(next.creditsAllocated) : '0');
    setCreditsUsed(String(next.creditsUsed));
    setEnforceQuota(next.enforceQuota);
    setVerifyInfo(null);
    setTestResult(null);
    setFeedback(null);
  }, [institution?.id]);

  if (!institution?.id) return null;

  const parsedAllocated = Math.max(0, Math.round(Number(creditsAllocated) || 0));
  const parsedUsed = Math.max(0, Math.round(Number(creditsUsed) || 0));
  const computedRemaining = Math.max(0, parsedAllocated - parsedUsed);
  const usagePct =
    parsedAllocated > 0
      ? Math.min(100, Math.round((parsedUsed / parsedAllocated) * 100))
      : 0;

  const handleSelectPreset = (preset) => {
    if (!canManagePackage) return;
    setPackageId(preset.id);
    setPackageName(preset.label);
    if (typeof preset.credits === 'number') {
      setCreditsAllocated(String(preset.credits));
    }
  };

  const handleTopUp = (amount) => {
    if (!canManagePackage) return;
    const nextTotal = parsedAllocated + amount;
    setCreditsAllocated(String(nextTotal));
    setPackageId('custom');
    if (packageName === 'Unassigned') {
      setPackageName('Custom Top-Up');
    }
  };

  const handleVerifyKey = async () => {
    setVerifying(true);
    setVerifyInfo(null);
    setFeedback(null);
    try {
      const result = await verifySchoolSmsGateway({
        institutionId: institution.id,
        apiKey: apiKey.trim(),
        senderId: normalizeSmsSenderId(senderId),
      });
      setVerifyInfo(result);
    } catch (err) {
      setVerifyInfo({
        ok: false,
        keyValid: false,
        error: err?.message || 'Verification failed',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTest = async () => {
    setTestResult(null);
    if (!isValidGhanaPhone(testPhone)) {
      setTestResult({
        ok: false,
        message: 'Enter a valid 10-digit Ghana mobile number (e.g. 0241234567).',
      });
      return;
    }
    const cleanSender = normalizeSmsSenderId(senderId);
    const cleanKey = apiKey.trim();
    if (!cleanKey || !cleanSender) {
      setTestResult({
        ok: false,
        message: 'Enter both an mNotify API Key and an approved Sender ID first.',
      });
      return;
    }

    setTestingSms(true);
    try {
      const res = await sendSingleTestSms({
        phone: formatGhanaPhone(testPhone),
        metadata: { schoolName: institution.schoolName },
        gatewayConfig: {
          provider: 'mnotify',
          apiKey: cleanKey,
          senderId: cleanSender,
          institutionId: institution.id,
        },
        smsPackage: {
          enforceQuota: false,
        },
        institutionId: institution.id,
      });

      if (res.deliveredCount > 0) {
        const walletNote =
          canManagePackage &&
          res.latestMnotifyCreditLeft !== null &&
          res.latestMnotifyCreditLeft !== undefined
            ? ` • mNotify wallet left: ${res.latestMnotifyCreditLeft}`
            : '';
        setTestResult({
          ok: true,
          message: `Test SMS delivered via ${cleanSender}${walletNote}`,
        });
      } else {
        const reason = res.failures?.[0]?.reason || 'Delivery failed';
        setTestResult({ ok: false, message: reason });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err?.message || 'Failed to dispatch test SMS',
      });
    } finally {
      setTestingSms(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canManagePackage) return;
    setFeedback(null);

    const cleanKey = apiKey.trim();
    const cleanSender = normalizeSmsSenderId(senderId);
    if (cleanKey && !cleanSender) {
      setFeedback({
        type: 'error',
        text: 'Please provide the approved mNotify Sender ID (up to 11 characters) for this school.',
      });
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const nextSmsConfig = {
        provider: 'mnotify',
        apiKey: cleanKey,
        senderId: cleanSender,
        updatedAt: nowIso,
      };

      const payload = {
        smsConfig: nextSmsConfig,
      };

      if (canManagePackage) {
        const prevAllocated = summary.creditsAllocated;
        const topUpChanged = parsedAllocated > prevAllocated;
        payload.smsPackage = {
          packageId,
          packageName: packageName.trim() || 'Custom Package',
          creditsAllocated: parsedAllocated,
          creditsUsed: parsedUsed,
          enforceQuota: Boolean(enforceQuota),
          lastTopUpAt: topUpChanged ? nowIso : summary.lastTopUpAt || nowIso,
          lastMnotifyBalance:
            verifyInfo?.ok && verifyInfo?.mnotifyBalance !== undefined
              ? Number(verifyInfo.mnotifyBalance)
              : summary.lastMnotifyBalance,
          updatedAt: nowIso,
        };
      }

      await setDoc(doc(db, 'institutions', institution.id), payload, { merge: true });

      setFeedback({
        type: 'success',
        text: canManagePackage
          ? `Saved SMS gateway & package (${computedRemaining} credits left) for ${institution.schoolName}.`
          : `Saved SMS gateway settings for ${institution.schoolName}.`,
      });
      if (onSaved) {
        onSaved(payload);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to save school SMS settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {onClose && (
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <MessageSquare className="w-3.5 h-3.5" />
              Per-School SMS Gateway &amp; Package
            </div>
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
              {institution.schoolName}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              ID: {institution.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Package Balance Overview */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-zinc-900 dark:text-white">
              {canManagePackage ? 'Active School SMS Package' : 'School SMS Package Balance'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
              {packageName}
            </span>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              !enforceQuota
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                : computedRemaining <= 0
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                  : computedRemaining <= 25
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}
          >
            {enforceQuota ? `${computedRemaining.toLocaleString()} SMS Left` : 'Unlimited Quota'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase">Allocated</div>
            <div className="text-base font-extrabold text-zinc-900 dark:text-white">
              {parsedAllocated.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase">Used</div>
            <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">
              {parsedUsed.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase">Remaining</div>
            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {computedRemaining.toLocaleString()}
            </div>
          </div>
        </div>

        {enforceQuota && parsedAllocated > 0 && (
          <div>
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  computedRemaining <= 0
                    ? 'bg-rose-500'
                    : usagePct >= 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, 100 - usagePct))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
              <span>{100 - usagePct}% remaining</span>
              <span>{usagePct}% consumed</span>
            </div>
          </div>
        )}

        {!canManagePackage && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[11px]">
            <span className="text-zinc-500 dark:text-zinc-400">
              SMS package credits and gateway settings are managed by the Senior Super User.
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold ${
                summary.isGatewayReady
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              {summary.isGatewayReady ? 'SMS Service: Active' : 'SMS Service: Pending Setup'}
            </span>
          </div>
        )}
      </div>

      {/* mNotify Credentials & Verification (Senior Super User only) */}
      {canManagePackage && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
            mNotify API Key (School Specific)
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste mNotify API key..."
              className="w-full pl-9 pr-10 py-2.5 text-sm font-mono bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title={showKey ? 'Hide API Key' : 'Show API Key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Approved Sender ID
            </label>
            <span className="text-[11px] font-mono text-zinc-400">
              {senderId.trim().length}/11 chars
            </span>
          </div>
          <input
            type="text"
            maxLength={11}
            value={senderId}
            onChange={(e) => setSenderId(e.target.value.slice(0, 11))}
            placeholder="e.g. Ve-KuatiRC"
            className="w-full px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Verify API Key & Sender ID */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleVerifyKey}
          disabled={verifying || !apiKey.trim()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-50 transition-colors"
        >
          {verifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {verifying ? 'Checking mNotify...' : 'Verify Key, Live Balance & Sender ID'}
        </button>
      </div>

      {verifyInfo && (
        <div
          className={`rounded-xl p-3.5 border text-xs space-y-2 ${
            verifyInfo.ok
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200'
          }`}
        >
          {verifyInfo.ok ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  mNotify API Key Valid • Live Balance:{' '}
                  <span className="font-mono text-sm">
                    {Number(verifyInfo.mnotifyBalance ?? 0).toLocaleString()} SMS
                  </span>
                </div>
                {canManagePackage && (
                  <button
                    type="button"
                    onClick={() => {
                      const syncedTotal =
                        parsedUsed + Number(verifyInfo.mnotifyBalance ?? 0);
                      setCreditsAllocated(String(syncedTotal));
                      setPackageId('custom');
                      setPackageName('mNotify Live Balance');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Sync Package Remaining to {verifyInfo.mnotifyBalance} SMS
                  </button>
                )}
              </div>
              {verifyInfo.senderId && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Sender ID ({verifyInfo.senderId}):</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      verifyInfo.senderStatus === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : verifyInfo.senderStatus === 'pending'
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-600 text-white'
                    }`}
                  >
                    {verifyInfo.senderStatus === 'not_found'
                      ? 'Not Registered on mNotify'
                      : verifyInfo.senderStatus}
                  </span>
                  {verifyInfo.senderPurpose && (
                    <span className="text-[11px] opacity-80 truncate max-w-full">
                      — {verifyInfo.senderPurpose}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{verifyInfo.error}</span>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Package Allocation Section (Senior Super User only) */}
      {canManagePackage && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 bg-white dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              SMS Package &amp; Quota Allocation
            </h4>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enforceQuota}
                onChange={(e) => setEnforceQuota(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              Enforce package credit limit
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SMS_PACKAGE_PRESETS.map((preset) => {
              const active = packageId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-2.5 rounded-xl border transition-all ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500/40'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="text-xs font-bold">{preset.label}</div>
                  <div className="text-[10px] opacity-75 leading-tight mt-0.5">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                Package Label
              </label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                Total Credits Allocated
              </label>
              <input
                type="number"
                min={0}
                value={creditsAllocated}
                onChange={(e) => {
                  setPackageId('custom');
                  setCreditsAllocated(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                Credits Used
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={creditsUsed}
                  onChange={(e) => setCreditsUsed(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setCreditsUsed('0')}
                  title="Reset credits used counter to 0"
                  className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-500">Quick Top-Up:</span>
            {[100, 250, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleTopUp(amt)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                <Plus className="w-3 h-3" />
                {amt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Optional Test Dispatch & Save (Senior Super User only) */}
      {canManagePackage && (
      <>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/60 dark:bg-zinc-950/40 space-y-2.5">
        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          Send Quick Test SMS (Verifies Key + {normalizeSmsSenderId(senderId) || 'Sender ID'})
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="024XXXXXXX"
            className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
          />
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testingSms || !testPhone.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
          >
            {testingSms ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send Test SMS
          </button>
        </div>
        {testResult && (
          <div
            className={`text-xs font-medium px-3 py-2 rounded-lg ${
              testResult.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save School SMS Settings'}
        </button>
      </div>
      </>
      )}
    </form>
  );
}
