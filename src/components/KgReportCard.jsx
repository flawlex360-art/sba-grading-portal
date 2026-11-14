import React from 'react';
import {
  KG_LEARNING_AREAS,
  KG_PROFICIENCY_SCALE,
  KG_SOCIAL_HABITS,
  getKgProficiencyMeta,
  normalizeKgRatingCode,
} from '../constants/curriculum';
import { generateKgParentAdvisory } from '../utils/calculations';
import { calculateAgeFromDob } from '../utils/rosterHelpers';
import { resolveHeadTeacherName } from '../utils/schoolDataHandlers';
import SchoolCrestImage from './SchoolCrestImage';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

const REPORT_BADGE_STYLES = {
  IND: 'bg-emerald-100 text-emerald-900 border-emerald-400',
  DEV: 'bg-blue-100 text-blue-900 border-blue-400',
  EMG: 'bg-amber-100 text-amber-900 border-amber-400',
  NYS: 'bg-rose-100 text-rose-900 border-rose-400',
};

export default function KgReportCard({
  student,
  metadata = {},
  calculatedScores = [],
  teacherSubjects,
  viewingTerm,
  institution,
}) {
  if (!student) return null;

  const areas =
    Array.isArray(teacherSubjects) && teacherSubjects.length > 0
      ? teacherSubjects.map((sub) => ({ name: sub.name, key: sub.key || sub.name }))
      : KG_LEARNING_AREAS;

  const rollCount = calculatedScores.length;
  const result = calculatedScores.find((s) => s.sn === student.sn) || {
    subjects: {},
    readinessStatus: 'In Progress',
  };

  const overallMax = metadata.timesOpen || 100;
  const learnerDob = student?.dateOfBirth || student?.dob || '';
  const ageYears = learnerDob ? calculateAgeFromDob(learnerDob) : null;
  const termDisplayMap = { 'Term 1': 'ONE', 'Term 2': 'TWO', 'Term 3': 'THREE' };
  const displayTerm = termDisplayMap[viewingTerm] || viewingTerm || metadata.term || '';

  const litRating =
    result.subjects?.['Language & Literacy']?.rating ||
    Object.values(result.subjects || {})[0]?.rating ||
    '';
  const numRating =
    result.subjects?.['Numeracy']?.rating ||
    Object.values(result.subjects || {})[1]?.rating ||
    '';

  const advisoryNote =
    student.parentAdvisoryNote !== undefined && student.parentAdvisoryNote !== ''
      ? student.parentAdvisoryNote
      : generateKgParentAdvisory(student.name, litRating, numRating);

  const socialHabits = student.socialHabits && typeof student.socialHabits === 'object' ? student.socialHabits : {};

  return (
    <div className="print-page bg-white text-black p-6 border border-zinc-200 shadow-lg max-w-[800px] mx-auto space-y-5 font-sans">
      {/* 1. Header Block */}
      <div className="text-center border-b-2 border-zinc-950 pb-4 relative px-20 min-h-[90px] flex flex-col justify-center">
        <img
          src="/ghana-coa.svg"
          alt="Ghana Coat of Arms"
          className="absolute left-0 top-1 w-16 h-16 object-contain"
        />
        {(institution?.schoolCrestUrl || metadata?.schoolCrestUrl) && (
          <SchoolCrestImage
            src={institution?.schoolCrestUrl || metadata?.schoolCrestUrl}
            alt="School Crest"
            className="absolute right-0 top-1 w-16 h-16 object-contain scale-[1.5] origin-center bg-white p-0.5 rounded"
          />
        )}
        <h1 className="text-xl font-bold uppercase tracking-wide">Ghana Education Service</h1>
        <h2 className="text-sm font-semibold uppercase text-black tracking-wider mt-0.5">
          {metadata.district}
        </h2>
        <h3 className="text-lg font-bold uppercase text-black tracking-wide mt-1">
          {metadata.schoolName}
        </h3>
        <h4 className="text-md font-bold text-black uppercase tracking-widest mt-2 border-t border-zinc-200 pt-2">
          Kindergarten Developmental Progress Report - {displayTerm}
        </h4>
      </div>

      {/* 2. Learner Bio Grid (Age-appropriate — no competitive rank) */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-xs font-semibold pb-3 border-b border-zinc-200">
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-28 flex-shrink-0">Name:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{student.name}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-36 flex-shrink-0">Learner Age:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5 text-black">
            {ageYears !== null ? `${ageYears} Years` : 'N/A'}
          </span>
        </div>

        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-28 flex-shrink-0">Class:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{metadata.classLevel}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-36 flex-shrink-0">No. On Roll:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{rollCount}</span>
        </div>

        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-28 flex-shrink-0">Academic Year:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{metadata.academicYear}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-36 flex-shrink-0">Term:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{displayTerm}</span>
        </div>

        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-28 flex-shrink-0">Date:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{formatDate(metadata.date)}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-36 flex-shrink-0">Next Term Begins:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{formatDate(metadata.nextTermBegins)}</span>
        </div>
      </div>

      {/* 3. 4 Core Learning Areas Assessment Table */}
      <table className="w-full border-collapse border border-zinc-950 text-sm">
        <thead>
          <tr className="bg-zinc-100 font-bold uppercase text-xs text-left border-b border-zinc-950">
            <th className="border border-zinc-950 px-3 py-2 min-w-[155px]">Learning Area</th>
            <th className="border border-zinc-950 px-2 py-2 text-center w-44 whitespace-nowrap">Proficiency Level</th>
            <th className="border border-zinc-950 px-2 py-2 text-center w-24 whitespace-nowrap">Milestones</th>
            <th className="border border-zinc-950 px-3 py-2">Facilitator&apos;s Observation Note</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const subRes = result.subjects?.[area.name] || {};
            const ratingCode = normalizeKgRatingCode(subRes.rating || subRes.grade);
            const meta = getKgProficiencyMeta(ratingCode);
            const badgeStyle =
              REPORT_BADGE_STYLES[ratingCode] || 'bg-zinc-100 text-zinc-600 border-zinc-300';
            const milestoneSummary =
              subRes.indicatorCount > 0
                ? `${subRes.indMasteredCount || 0}/${subRes.indicatorCount} Ind.`
                : 'Overall';
            const noteText =
              subRes.note && subRes.note.trim() !== ''
                ? subRes.note
                : ratingCode
                  ? meta.description
                  : 'Observation pending for this term.';

            return (
              <tr key={area.key} className="border-b border-zinc-300">
                <td className="border border-zinc-950 px-3 py-2.5 font-bold text-black text-xs">
                  {area.name}
                </td>
                <td className="border border-zinc-950 px-2 py-2.5 text-center whitespace-nowrap">
                  <span
                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded border text-[10px] font-extrabold uppercase whitespace-nowrap ${badgeStyle}`}
                  >
                    {ratingCode ? (
                      <>
                        <span>{ratingCode}</span>
                        <span>&bull;</span>
                        <span>{meta.label}</span>
                      </>
                    ) : (
                      <span>Pending</span>
                    )}
                  </span>
                </td>
                <td className="border border-zinc-950 px-2 py-2.5 text-center text-xs font-mono font-semibold text-zinc-700">
                  {milestoneSummary}
                </td>
                <td className="border border-zinc-950 px-3 py-2.5 text-[11px] leading-snug text-zinc-800">
                  {noteText}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 4. Personal & Social Habits Checklist */}
      <div className="border border-zinc-950 rounded p-3 bg-zinc-50/70 break-inside-avoid">
        <div className="text-[11px] font-bold uppercase text-black tracking-wide mb-2">
          Personal &amp; Social Habits Checklist
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
          {KG_SOCIAL_HABITS.map((habit) => {
            const habitCode = normalizeKgRatingCode(socialHabits[habit.id]);
            const habitMeta = getKgProficiencyMeta(habitCode);
            const badgeStyle =
              REPORT_BADGE_STYLES[habitCode] || 'bg-zinc-100 text-zinc-500 border-zinc-300';
            return (
              <div
                key={habit.id}
                className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-1"
              >
                <span className="font-medium text-zinc-800">{habit.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase whitespace-nowrap shrink-0 ${badgeStyle}`}
                >
                  {habitCode ? `${habitCode} • ${habitMeta.shortLabel}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Attendance */}
      <div className="grid grid-cols-1 gap-4 text-xs pt-1">
        <div className="flex gap-2">
          <span className="text-black font-bold uppercase w-32">Attendance:</span>
          <span className="font-bold border-b border-zinc-400 flex-1">
            {student.attendance || 0} <span className="font-normal text-black">OUT OF {overallMax}</span>
          </span>
        </div>
      </div>

      {/* 6. Facilitator Remarks Block */}
      <div className="grid grid-cols-1 gap-y-2.5 text-xs pt-3 border-t border-zinc-200">
        <div className="flex gap-2 items-center">
          <span className="text-black font-bold uppercase w-44">Conduct:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.conduct || 'N/A'}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-black font-bold uppercase w-44">Interest:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.interest || 'N/A'}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-black font-bold uppercase w-44">Facilitator&apos;s Remarks:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.remarks || 'N/A'}</span>
        </div>
        {viewingTerm === 'Term 3' && student.promotedTo && (
          <div className="flex gap-2 items-center">
            <span className="text-black font-bold uppercase w-44">Transition / Promoted To:</span>
            <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5 text-black">
              {student.promotedTo}
            </span>
          </div>
        )}
      </div>

      {/* 7. Signatures */}
      <div className="break-inside-avoid pt-5">
        <div className="grid grid-cols-2 gap-8 text-center text-[10px] font-bold uppercase">
          <div className="space-y-0.5">
            <div className="border-t border-zinc-500 pt-1 mx-auto max-w-[200px]" />
            <div>Class Facilitator&apos;s Signature</div>
            {metadata.teacherName && (
              <div className="text-zinc-600 capitalize font-medium">{metadata.teacherName}</div>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="border-t border-zinc-500 pt-1 mx-auto max-w-[200px]" />
            <div>Headteacher&apos;s Signature</div>
            {resolveHeadTeacherName(institution, metadata) && (
              <div className="text-zinc-600 capitalize font-medium">{resolveHeadTeacherName(institution, metadata)}</div>
            )}
          </div>
        </div>

        <div className="text-center text-[9px] text-black mt-2 border-t border-zinc-100 pt-1 italic">
          Madifor Technologies (0592664865)
        </div>
      </div>

      {/* 8. NaCCA 4-Tier Developmental Scale Key */}
      <div className="print-page-break mt-3 pt-3 border-t border-zinc-200 break-inside-avoid">
        <span className="text-xs font-bold uppercase text-black block mb-2">
          NaCCA Kindergarten Developmental Proficiency Key
        </span>
        <table className="grading-key-table w-full text-left text-[10px] border-collapse border border-zinc-300">
          <thead className="bg-zinc-100 text-black font-bold">
            <tr>
              <th className="border border-zinc-300 px-2 py-1 w-20 text-center">Code</th>
              <th className="border border-zinc-300 px-2 py-1 w-36">Level</th>
              <th className="border border-zinc-300 px-2 py-1">Descriptor</th>
            </tr>
          </thead>
          <tbody className="text-black font-medium">
            {KG_PROFICIENCY_SCALE.map((tier) => (
              <tr key={tier.code}>
                <td className="border border-zinc-300 px-2 py-1 text-center font-bold">{tier.code}</td>
                <td className="border border-zinc-300 px-2 py-1 font-semibold">{tier.label}</td>
                <td className="border border-zinc-300 px-2 py-1">{tier.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 9. Early Learning Home Advisory & Parent Acknowledgment Slip */}
      <div className="mt-5 pt-4 border-t-2 border-zinc-950 break-inside-avoid space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase text-black tracking-wide">
            EARLY LEARNING HOME ADVISORY
          </span>
          <span className="text-[9px] font-bold text-zinc-600 uppercase">
            Language &amp; Literacy • Numeracy • Play-Based Support
          </span>
        </div>

        <div className="bg-zinc-50 border border-zinc-300 rounded p-3 text-[11px] leading-relaxed text-black">
          <div className="whitespace-pre-line font-normal">{advisoryNote}</div>
        </div>

        <div className="border border-zinc-950 rounded p-3 bg-white mt-3 break-inside-avoid">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase text-black">
              PARENT / GUARDIAN ACKNOWLEDGMENT
            </span>
            <span className="text-[9px] text-zinc-500 italic">Please sign and return copy to class facilitator</span>
          </div>
          <p className="text-[10px] text-zinc-700 italic mb-4">
            &quot;I have reviewed my ward&apos;s Kindergarten developmental report and home play activities above.&quot;
          </p>
          <div className="grid grid-cols-3 gap-6 text-[10px] pt-2">
            <div>
              <div className="border-b border-zinc-400 pb-0.5" />
              <span className="text-[9px] uppercase font-bold text-zinc-600 block mt-1">Parent/Guardian Name</span>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-0.5" />
              <span className="text-[9px] uppercase font-bold text-zinc-600 block mt-1">Signature</span>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-0.5" />
              <span className="text-[9px] uppercase font-bold text-zinc-600 block mt-1">Date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
