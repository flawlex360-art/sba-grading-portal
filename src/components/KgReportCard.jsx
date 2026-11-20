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
import { GHANA_COA_DATA_URI } from '../utils/logoAsset';

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
    <div className="print-page report-card-sheet bg-white text-black p-6 sm:p-7 border border-zinc-200 shadow-lg max-w-[820px] mx-auto">
      {/* PAGE 1: Header, Bio, Learning Areas, Social Habits, Attendance, Conduct/Remarks, Signatures */}
      <div className="report-page-one flex flex-col justify-between gap-5 sm:min-h-[980px]">
        {/* 1. Header Block */}
        <div className="text-center border-b-2 border-black pb-3 relative px-20 min-h-[88px] flex flex-col justify-center">
          <img
            src={GHANA_COA_DATA_URI}
            alt="Ghana Coat of Arms"
            width="68"
            height="68"
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            className="absolute left-0 top-0.5 w-[68px] h-[68px] object-contain"
          />
          {(institution?.schoolCrestUrl || metadata?.schoolCrestUrl) && (
            <SchoolCrestImage
              src={institution?.schoolCrestUrl || metadata?.schoolCrestUrl}
              alt="School Crest"
              className="absolute right-0 top-0.5 w-[68px] h-[68px] object-contain"
            />
          )}
          <h1 className="text-[21px] font-bold uppercase tracking-wide leading-tight text-black">
            Ghana Education Service
          </h1>
          <h2 className="text-[13.5px] font-bold uppercase text-black tracking-wider mt-1">
            {metadata.district}
          </h2>
          <h3 className="text-[18px] font-bold uppercase text-black tracking-wide mt-0.5 leading-snug">
            {metadata.schoolName}
          </h3>
          <h4 className="text-[14px] font-bold text-black uppercase tracking-widest mt-2 border-t border-zinc-300 pt-1.5">
            Kindergarten Developmental Progress Report - {displayTerm}
          </h4>
        </div>

        {/* 2. Learner Bio Grid (Age-appropriate — no competitive rank) */}
        <div className="grid grid-cols-2 gap-x-7 gap-y-3 text-[13.5px] font-semibold pb-3 border-b border-zinc-300">
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Name:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{student.name}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Learner Age:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight text-black">
              {ageYears !== null ? `${ageYears} Years` : 'N/A'}
            </span>
          </div>

          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Class:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{metadata.classLevel}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">No. On Roll:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{rollCount}</span>
          </div>

          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Academic Year:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{metadata.academicYear}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Term:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{displayTerm}</span>
          </div>

          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Date:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{formatDate(metadata.date)}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Next Term Begins:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{formatDate(metadata.nextTermBegins)}</span>
          </div>
        </div>

        {/* 3. 4 Core Learning Areas Assessment Table */}
        <div className="w-full px-[1px]">
          <table className="report-card-table w-full table-fixed border-collapse border-[1.5px] border-black text-[14px]">
            <thead>
              <tr className="bg-zinc-100 font-bold uppercase text-[12.5px] text-left border-b-[1.5px] border-black text-black">
                <th className="border border-black px-3 py-2.5 w-[24%]">Learning Area</th>
                <th className="border border-black px-2 py-2.5 text-center w-[26%] whitespace-nowrap">Proficiency Level</th>
                <th className="border border-black px-2 py-2.5 text-center w-[13%] whitespace-nowrap">Milestones</th>
                <th className="border border-black px-3 py-2.5 w-[37%]">Facilitator&apos;s Observation Note</th>
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
                  <tr key={area.key}>
                    <td className="border border-black px-3 py-3 font-bold text-black text-[14px] leading-snug">
                      {area.name}
                    </td>
                    <td className="border border-black px-2 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-bold uppercase whitespace-nowrap ${badgeStyle}`}
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
                    <td className="border border-black px-2 py-3 text-center text-[13px] font-semibold text-black">
                      {milestoneSummary}
                    </td>
                    <td className="border border-black px-3 py-3 text-[13px] leading-snug text-black">
                      {noteText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Personal & Social Habits Checklist */}
        <div className="border-[1.5px] border-black rounded p-3.5 bg-zinc-50/70 break-inside-avoid">
          <div className="text-[13px] font-bold uppercase text-black tracking-wide mb-2.5">
            Personal &amp; Social Habits Checklist
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            {KG_SOCIAL_HABITS.map((habit) => {
              const habitCode = normalizeKgRatingCode(socialHabits[habit.id]);
              const habitMeta = getKgProficiencyMeta(habitCode);
              const badgeStyle =
                REPORT_BADGE_STYLES[habitCode] || 'bg-zinc-100 text-zinc-500 border-zinc-300';
              return (
                <div
                  key={habit.id}
                  className="flex items-center justify-between gap-2 border-b border-zinc-300 pb-1"
                >
                  <span className="font-medium text-black">{habit.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10.5px] font-bold uppercase whitespace-nowrap shrink-0 ${badgeStyle}`}
                  >
                    {habitCode ? `${habitCode} • ${habitMeta.shortLabel}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5 & 6. Attendance + Facilitator Remarks Block */}
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-4 text-[14.5px]">
            <div className="flex gap-3 items-baseline">
              <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Attendance:</span>
              <span className="font-bold text-[15.5px] border-b border-zinc-500 flex-1 pb-0.5">
                {student.attendance || 0} <span className="font-normal text-[14px] text-black">OUT OF {overallMax}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-y-3.5 text-[14.5px] pt-3 border-t border-zinc-300">
            <div className="flex gap-3 items-baseline">
              <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Conduct:</span>
              <span className="font-semibold text-[15.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-snug">
                {student.conduct || 'N/A'}
              </span>
            </div>
            <div className="flex gap-3 items-baseline">
              <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Interest:</span>
              <span className="font-semibold text-[15.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-snug">
                {student.interest || 'N/A'}
              </span>
            </div>
            <div className="flex gap-3 items-baseline">
              <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Facilitator&apos;s Remarks:</span>
              <span className="font-semibold text-[15.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-snug">
                {student.remarks || 'N/A'}
              </span>
            </div>
            {viewingTerm === 'Term 3' && student.promotedTo && (
              <div className="flex gap-3 items-baseline">
                <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Transition / Promoted To:</span>
                <span className="font-bold text-[15.5px] border-b border-zinc-500 flex-1 pb-1 text-black leading-snug">
                  {student.promotedTo}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 7. Signatures */}
        <div className="break-inside-avoid pt-6">
          <div className="grid grid-cols-2 gap-10 text-center text-[12.5px] font-bold uppercase">
            <div className="space-y-1">
              <div className="border-t border-black pt-1.5 mx-auto max-w-[230px]" />
              <div className="text-black">Class Facilitator&apos;s Signature</div>
              {metadata.teacherName && (
                <div className="text-[13px] text-zinc-700 capitalize font-medium">{metadata.teacherName}</div>
              )}
            </div>
            <div className="space-y-1">
              <div className="border-t border-black pt-1.5 mx-auto max-w-[230px]" />
              <div className="text-black">Headteacher&apos;s Signature</div>
              {resolveHeadTeacherName(institution, metadata) && (
                <div className="text-[13px] text-zinc-700 capitalize font-medium">{resolveHeadTeacherName(institution, metadata)}</div>
              )}
            </div>
          </div>

          <div className="text-center text-[10.5px] text-black mt-4 border-t border-zinc-200 pt-1.5 italic">
            Madifor Technologies (0592664865)
          </div>
        </div>
      </div>

      {/* 8. NaCCA 4-Tier Developmental Scale Key */}
      <div className="print-page-break mt-6 pt-5 border-t border-zinc-300 break-inside-avoid">
        <span className="text-[14px] font-bold uppercase text-black block mb-2.5">
          NaCCA Kindergarten Developmental Proficiency Key
        </span>
        <div className="w-full px-[1px]">
          <table className="report-card-table grading-key-table w-full text-left text-[13px] border-collapse border-[1.5px] border-black">
            <thead className="bg-zinc-100 text-black font-bold">
              <tr>
                <th className="border border-black px-3 py-1.5 w-24 text-center">Code</th>
                <th className="border border-black px-3 py-1.5 w-40">Level</th>
                <th className="border border-black px-3 py-1.5">Descriptor</th>
              </tr>
            </thead>
            <tbody className="text-black font-medium">
              {KG_PROFICIENCY_SCALE.map((tier) => (
                <tr key={tier.code}>
                  <td className="border border-black px-3 py-1.5 text-center font-bold">{tier.code}</td>
                  <td className="border border-black px-3 py-1.5 font-semibold">{tier.label}</td>
                  <td className="border border-black px-3 py-1.5">{tier.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9. Early Learning Home Advisory & Parent Acknowledgment Slip */}
      <div className="mt-6 pt-5 border-t-2 border-black break-inside-avoid space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold uppercase text-black tracking-wide">
            EARLY LEARNING HOME ADVISORY
          </span>
          <span className="text-[11px] font-bold text-zinc-700 uppercase">
            Language &amp; Literacy • Numeracy • Play-Based Support
          </span>
        </div>

        <div className="bg-zinc-50 border border-zinc-400 rounded p-4 text-[13.5px] leading-relaxed text-black">
          <div className="whitespace-pre-line font-normal">{advisoryNote}</div>
        </div>

        <div className="border-[1.5px] border-black rounded p-4 bg-white mt-4 break-inside-avoid">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[13px] font-bold uppercase text-black">
              PARENT / GUARDIAN ACKNOWLEDGMENT
            </span>
            <span className="text-[11px] text-zinc-600 italic">Please sign and return copy to class facilitator</span>
          </div>
          <p className="text-[12.5px] text-zinc-800 italic mb-5">
            &quot;I have reviewed my ward&apos;s Kindergarten developmental report and home play activities above.&quot;
          </p>
          <div className="grid grid-cols-3 gap-6 text-[12px] pt-3">
            <div>
              <div className="border-b border-black pb-0.5" />
              <span className="text-[11px] uppercase font-bold text-black block mt-1.5">Parent/Guardian Name</span>
            </div>
            <div>
              <div className="border-b border-black pb-0.5" />
              <span className="text-[11px] uppercase font-bold text-black block mt-1.5">Signature</span>
            </div>
            <div>
              <div className="border-b border-black pb-0.5" />
              <span className="text-[11px] uppercase font-bold text-black block mt-1.5">Date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
