import React, { useEffect, useState } from 'react';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Printer,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { db } from '../utils/firebase';
import {
  PARENT_REPORT_TTL_DAYS,
  getDirectImageUrl,
  getParentReportDocId,
  isParentReportExpired,
} from '../utils/parentReportHelpers';

function formatReadableDate(rawValue) {
  if (!rawValue) return '';
  const str = String(rawValue).trim();
  if (!str) return '';
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getGradeBadgeClass(grade) {
  const g = String(grade || '').trim().toUpperCase();
  if (!g || g === '-') return 'bg-slate-100 text-slate-600 border-slate-200';
  const num = Number(g);
  if (!Number.isNaN(num)) {
    if (num <= 2) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (num <= 4) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (num <= 6) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (['A1', 'A', '1', 'HP', 'P'].includes(g)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['B2', 'B3', 'B', 'AP'].includes(g)) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (['C4', 'C5', 'C6', 'C', 'D'].includes(g)) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

export default function PublicParentReportView({ token }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'expired' | 'error'
  const [report, setReport] = useState(null);
  const [expiredDateStr, setExpiredDateStr] = useState('');
  const [crestFailed, setCrestFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setReport(null);
    setExpiredDateStr('');
    setCrestFailed(false);

    async function loadSnapshot() {
      const docId = getParentReportDocId(token);
      if (!docId || !db) {
        if (active) setStatus('expired');
        return;
      }

      try {
        const ref = doc(db, 'schools', docId);
        let snap;
        try {
          snap = await getDocFromServer(ref);
        } catch {
          snap = await getDoc(ref);
        }

        if (!active) return;

        if (!snap.exists()) {
          setStatus('expired');
          return;
        }

        const data = snap.data();
        if (isParentReportExpired(data, Date.now())) {
          if (data?.expiresAt) {
            setExpiredDateStr(formatReadableDate(data.expiresAt));
          }
          setStatus('expired');
          return;
        }

        setReport(data);
        setStatus('ready');
      } catch (err) {
        console.error('Failed to load parent report snapshot:', err);
        if (active) setStatus('error');
      }
    }

    loadSnapshot();
    return () => {
      active = false;
    };
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-700">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center mb-4 animate-pulse">
          <GraduationCap className="w-6 h-6 text-emerald-700" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Opening Terminal Report...</p>
        <p className="text-xs text-slate-500 mt-1">Please wait a moment</p>
      </div>
    );
  }

  if (status === 'expired' || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-5">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            {status === 'error' ? 'Unable to Open Report' : 'Report Link Expired or Unavailable'}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {status === 'error'
              ? 'We could not reach the school server right now. Please check your internet connection and tap the link again.'
              : `For student data privacy and light system storage, parent SMS report links remain active for ${PARENT_REPORT_TTL_DAYS} days after sending and are then deactivated.`}
          </p>
          {expiredDateStr && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <Clock className="w-3.5 h-3.5" />
              Expired on {expiredDateStr}
            </p>
          )}
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Please contact your ward&apos;s school or class teacher if you need a fresh copy of this report.
          </div>
        </div>
      </div>
    );
  }

  const subjects = Array.isArray(report.subjects) ? report.subjects : [];
  const validUntil = formatReadableDate(report.expiresAt);
  const reopeningDisplay = formatReadableDate(report.reopeningDate);
  const attendanceLabel = report.attendance
    ? report.timesOpen
      ? `${report.attendance} / ${report.timesOpen} days`
      : `${report.attendance} days`
    : 'Not recorded';

  return (
    <div className="min-h-screen bg-slate-100/80 py-4 px-3 sm:py-8 sm:px-6 print:bg-white print:p-0">
      <div className="max-w-xl mx-auto space-y-3.5 print:max-w-none print:space-y-3">
        {/* Top utility strip (hidden when printing) */}
        <div className="flex items-center justify-between gap-2 px-1 print:hidden">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Verified Parent Report</span>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Save / Print
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden print:border-slate-300 print:shadow-none">
          {/* School Header */}
          <div className="bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 text-white px-5 py-5">
            <div className="flex items-center gap-3.5">
              {report.schoolCrestUrl && !crestFailed ? (
                <img
                  src={getDirectImageUrl(report.schoolCrestUrl)}
                  referrerPolicy="no-referrer"
                  alt={report.schoolName}
                  onError={() => setCrestFailed(true)}
                  className="w-12 h-12 rounded-xl object-contain bg-white p-1 shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">
                  Terminal Academic Summary
                </p>
                <h1 className="text-base sm:text-lg font-bold leading-snug break-words">
                  {report.schoolName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-emerald-50/90 mt-0.5">
                  {report.academicYear && <span>{report.academicYear}</span>}
                  {report.academicYear && report.term && <span>&bull;</span>}
                  {report.term && <span className="font-semibold">{report.term}</span>}
                  {report.className && (
                    <>
                      <span>&bull;</span>
                      <span>{report.className}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Learner Identity & Parent Greeting */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Learner Name
                </p>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {report.studentName}
                </h2>
              </div>
              {report.className && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {report.className}
                  {report.classSize ? ` • ${report.classSize} Learners` : ''}
                </span>
              )}
            </div>
            {report.parentName && (
              <p className="text-xs text-slate-500 mt-1.5">
                Prepared for: <span className="font-semibold text-slate-700">{report.parentName}</span>
              </p>
            )}
          </div>

          {/* 3 Primary Performance KPI Pills */}
          <div className="grid grid-cols-3 gap-2.5 p-4 border-b border-slate-100">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-center">
              <p className="text-[11px] font-medium text-slate-500">Overall Total</p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 tabular-nums">
                {report.overallTotal !== null && report.overallTotal !== undefined
                  ? report.overallTotal
                  : '-'}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 text-center">
              <p className="text-[11px] font-medium text-emerald-700">Average</p>
              <p className="text-lg sm:text-xl font-extrabold text-emerald-800 mt-0.5 tabular-nums">
                {report.average !== null && report.average !== undefined
                  ? `${report.average}%`
                  : '-'}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-center">
              <p className="text-[11px] font-medium text-amber-800">Position</p>
              <p className="text-lg sm:text-xl font-extrabold text-amber-900 mt-0.5">
                {report.overallRank || '-'}
              </p>
            </div>
          </div>

          {/* Subject Breakdown (Mobile-first Zero-Overflow Rows) */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                Subject Breakdown ({subjects.length})
              </h3>
              <span className="text-[11px] text-slate-400">Class + Exam = 100%</span>
            </div>

            {subjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                No subject scores recorded for this term yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 overflow-hidden">
                {subjects.map((subj) => (
                  <div
                    key={subj.name}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white hover:bg-slate-50/70 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{subj.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        Class: <span className="font-medium text-slate-700">{subj.scaledSba ?? '-'}</span>
                        {' '} &bull; {' '}
                        Exam: <span className="font-medium text-slate-700">{subj.scaledExam ?? '-'}</span>
                        {subj.rank && subj.rank !== '-' && (
                          <>
                            {' '} &bull; Pos: <span className="font-medium text-slate-700">{subj.rank}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                          {subj.total ?? '-'}
                        </p>
                        {subj.remark && (
                          <p className="text-[10px] text-slate-500 max-w-[92px] truncate">
                            {subj.remark}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-lg border text-xs font-bold ${getGradeBadgeClass(
                          subj.grade
                        )}`}
                      >
                        {subj.grade || '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance, Conduct, Remarks & Reopening */}
          <div className="px-4 pb-5 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Attendance
                </p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{attendanceLabel}</p>
              </div>
              {reopeningDisplay && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Next Term Reopens
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{reopeningDisplay}</p>
                </div>
              )}
            </div>

            {report.conduct && (
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Conduct &amp; Attitude
                </p>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">{report.conduct}</p>
              </div>
            )}

            {report.remarks && (
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/70 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-700" />
                  Class Teacher&apos;s Remark
                </p>
                <p className="text-xs sm:text-sm text-slate-800 mt-1 leading-relaxed">
                  {report.remarks}
                </p>
              </div>
            )}

            {report.promotedTo && (
              <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2.5 text-xs font-semibold text-sky-900">
                Promotion Status: {report.promotedTo}
              </div>
            )}
          </div>

          {/* Privacy & Auto-Expiry Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {validUntil
                ? `Temporary mobile link valid until ${validUntil}`
                : `Active for ${PARENT_REPORT_TTL_DAYS} days`}
            </span>
            <span>Auto-expires after 30 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
