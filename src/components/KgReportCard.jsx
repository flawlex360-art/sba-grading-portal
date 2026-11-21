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
import {
  ReportContinuationHeader,
  ReportConductRemarksSection,
  ReportSignaturesBlock,
  ReportPageFooter,
  ParentAcknowledgmentSlip,
} from './ReportCardPrimitives';

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

  const headTeacherName = resolveHeadTeacherName(institution, metadata);
  const hasPromotionRow = Boolean(viewingTerm === 'Term 3' && student.promotedTo);

  return (
    <div className="print-page report-card-sheet max-w-[820px] mx-auto space-y-6 print:space-y-0 text-black">
      {/* =================================================================== */}
      {/* PAGE 1: Header, Bio, Learning Areas, Habits, Conducts & Signatures  */}
      {/* =================================================================== */}
      <div className="report-page-section bg-white text-black p-6 sm:p-7 border border-zinc-200 shadow-lg sm:min-h-[940px] flex flex-col justify-between gap-2">
        {/* 1. Header Block */}
        <div className="text-center border-b-2 border-black pb-1.5 relative px-20 min-h-[76px] flex flex-col justify-center">
          <img
            src={GHANA_COA_DATA_URI}
            alt="Ghana Coat of Arms"
            width="68"
            height="68"
            decoding="sync"
            loading="eager"
            className="absolute left-0 top-0.5 w-[68px] h-[68px] object-contain"
          />
          {(institution?.schoolCrestUrl || metadata?.schoolCrestUrl) && (
            <SchoolCrestImage
              src={institution?.schoolCrestUrl || metadata?.schoolCrestUrl}
              alt="School Crest"
              className="absolute right-0 top-0.5 w-[68px] h-[68px] object-contain"
            />
          )}
          <h1 className="text-[19.5px] font-bold uppercase tracking-wide leading-tight text-black">
            Ghana Education Service
          </h1>
          <h2 className="text-[12.5px] font-bold uppercase text-black tracking-wider mt-0.5">
            {metadata.district}
          </h2>
          <h3 className="text-[16.5px] font-bold uppercase text-black tracking-wide mt-0.5 leading-snug">
            {metadata.schoolName}
          </h3>
          <h4 className="text-[13px] font-bold text-black uppercase tracking-widest mt-1 border-t border-zinc-300 pt-1">
            Kindergarten Developmental Progress Report
          </h4>
        </div>

        {/* 2. Learner Bio Grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] font-semibold pb-1.5 border-b border-zinc-300">
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[124px] shrink-0 whitespace-nowrap">Name:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{student.name}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[148px] shrink-0 whitespace-nowrap">Learner Age:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight text-black">
              {ageYears !== null ? `${ageYears} Years` : 'N/A'}
            </span>
          </div>

          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[124px] shrink-0 whitespace-nowrap">Class:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{metadata.classLevel}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[148px] shrink-0 whitespace-nowrap">No. On Roll:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{rollCount}</span>
          </div>

          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[124px] shrink-0 whitespace-nowrap">Academic Year:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{metadata.academicYear}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[148px] shrink-0 whitespace-nowrap">Term:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{displayTerm}</span>
          </div>

          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[124px] shrink-0 whitespace-nowrap">Date:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{formatDate(metadata.date)}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[148px] shrink-0 whitespace-nowrap">Next Term Begins:</span>
            <span className="font-bold text-[14px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{formatDate(metadata.nextTermBegins)}</span>
          </div>
        </div>

        {/* 3. 4 Core Learning Areas Assessment Table */}
        <div className="w-full px-[1px]">
          <table className="report-card-table w-full table-fixed border-collapse border-[1.5px] border-black text-[13px]">
            <thead>
              <tr className="bg-zinc-100 font-bold uppercase text-[11.5px] text-left border-b-[1.5px] border-black text-black leading-tight">
                <th className="border border-black px-2 py-1.5 w-[22%]">Learning Area</th>
                <th className="border border-black px-1.5 py-1.5 text-center w-[26%] whitespace-nowrap">Proficiency Level</th>
                <th className="border border-black px-1.5 py-1.5 text-center w-[15%] whitespace-nowrap">Milestones</th>
                <th className="border border-black px-2 py-1.5 w-[37%]">Facilitator&apos;s Observation Note</th>
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
                    <td className="border border-black px-2 py-1.5 font-bold text-black text-[13px] leading-tight">
                      {area.name}
                    </td>
                    <td className="border border-black px-1 py-1.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] font-bold uppercase whitespace-nowrap ${badgeStyle}`}
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
                    <td className="border border-black px-1 py-1.5 text-center text-[12.5px] font-semibold text-black whitespace-nowrap">
                      {milestoneSummary}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-[12.5px] leading-tight text-black">
                      {noteText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Personal & Social Habits Checklist + Attendance */}
        <div className="space-y-1.5">
          <div className="border-[1.5px] border-black rounded px-3 py-1.5 bg-zinc-50/70 break-inside-avoid">
            <div className="text-[11.5px] font-bold uppercase text-black tracking-wide mb-1">
              Personal &amp; Social Habits Checklist
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-0.5 text-[12.5px] leading-tight">
              {KG_SOCIAL_HABITS.map((habit) => {
                const habitCode = normalizeKgRatingCode(socialHabits[habit.id]);
                const habitMeta = getKgProficiencyMeta(habitCode);
                const badgeStyle =
                  REPORT_BADGE_STYLES[habitCode] || 'bg-zinc-100 text-zinc-500 border-zinc-300';
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between gap-1.5 border-b border-zinc-300 py-0.5"
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

          <div className="border-[1.5px] border-black rounded bg-zinc-50 px-3 py-1 text-[13.5px] font-semibold flex items-baseline gap-2.5">
            <span className="text-black font-bold uppercase whitespace-nowrap shrink-0">Attendance:</span>
            <span className="font-bold text-[14.5px] text-black">
              {student.attendance || 0}{' '}
              <span className="font-normal text-[13px] text-black">OUT OF {overallMax}</span>
            </span>
          </div>
        </div>

        {/* 5. Conduct, Interest & Facilitator Remarks (On Page 1) */}
        <ReportConductRemarksSection
          conduct={student.conduct}
          interest={student.interest}
          remarks={student.remarks}
          remarksLabel="Facilitator's Remarks:"
          promotedTo={hasPromotionRow ? student.promotedTo : ''}
          promotedLabel="Transition / Promoted To:"
          compact
        />

        {/* 6. Signatures, Printed Names & Page 1 Footer (Locked on Page 1) */}
        <div className="break-inside-avoid">
          <ReportSignaturesBlock
            teacherLabel="Class Facilitator's Signature"
            teacherName={metadata.teacherName}
            headTeacherName={headTeacherName}
            compact
          />
          <ReportPageFooter pageNum={1} totalPages={2} />
        </div>
      </div>

      {/* =================================================================== */}
      {/* PAGE 2: NaCCA Proficiency Key, Home Advisory & Acknowledgment Slip  */}
      {/* =================================================================== */}
      <div className="print-page-break">
        <div className="report-page-section bg-white text-black p-6 sm:p-7 border border-zinc-200 shadow-lg sm:min-h-[960px] flex flex-col justify-between gap-5">
          <ReportContinuationHeader
            schoolName={metadata.schoolName}
            district={metadata.district}
            sectionTitle="Developmental Proficiency Key & Early Learning Advisory"
            studentName={student.name}
            classLevel={metadata.classLevel}
            displayTerm={displayTerm}
          />

          {/* 7. NaCCA 4-Tier Developmental Scale Key (Starts Page 2 cleanly) */}
          <div className="break-inside-avoid space-y-2.5">
            <span className="text-[14px] font-bold uppercase text-black block tracking-wide">
              NaCCA Kindergarten Developmental Proficiency Key
            </span>
            <div className="w-full px-[1px]">
              <table className="report-card-table grading-key-table w-full table-fixed text-left text-[13.5px] border-collapse border-[1.5px] border-black">
                <thead className="bg-zinc-100 text-black font-bold uppercase text-[11.5px]">
                  <tr>
                    <th className="border border-black px-3 py-2 w-[16%] text-center">Code</th>
                    <th className="border border-black px-3 py-2 w-[26%]">Level</th>
                    <th className="border border-black px-3 py-2 w-[58%]">Descriptor</th>
                  </tr>
                </thead>
                <tbody className="text-black font-medium">
                  {KG_PROFICIENCY_SCALE.map((tier) => (
                    <tr key={tier.code}>
                      <td className="border border-black px-3 py-2 text-center font-bold">{tier.code}</td>
                      <td className="border border-black px-3 py-2 font-semibold">{tier.label}</td>
                      <td className="border border-black px-3 py-2 leading-snug">{tier.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 8. Early Learning Home Advisory */}
          <div className="break-inside-avoid space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black pb-1.5">
              <span className="text-[14px] font-bold uppercase text-black tracking-wide">
                Early Learning Home Advisory
              </span>
              <span className="text-[11.5px] font-bold text-zinc-700 uppercase">
                Language &amp; Literacy &bull; Numeracy &bull; Play-Based Support
              </span>
            </div>

            <div className="bg-zinc-50 border border-zinc-500 rounded p-4 text-[14px] leading-[1.65] text-black">
              <div className="whitespace-pre-line font-normal">{advisoryNote}</div>
            </div>
          </div>

          <ParentAcknowledgmentSlip
            statementText={'"I have reviewed my ward\'s Kindergarten developmental report and home play activities above."'}
            returnToLabel="class facilitator"
          />

          <ReportPageFooter pageNum={2} totalPages={2} />
        </div>
      </div>
    </div>
  );
}
