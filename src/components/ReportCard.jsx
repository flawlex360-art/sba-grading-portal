import React from 'react';
import { getOrdinalSuffix, generateParentAdvisory } from '../utils/calculations';
import { resolveSchoolLevel, SCHOOL_LEVELS } from '../constants/curriculum';
import { resolveHeadTeacherName } from '../utils/schoolDataHandlers';
import KgReportCard from './KgReportCard';
import SchoolCrestImage from './SchoolCrestImage';
import { GHANA_COA_DATA_URI } from '../utils/logoAsset';
import {
  ReportContinuationHeader,
  ReportConductRemarksSection,
  ReportSignaturesBlock,
  ReportPageFooter,
  ParentAcknowledgmentSlip,
} from './ReportCardPrimitives';

// Date formatter helper: "2023-12-22" -> "Dec 22, 2023"
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateStr;
  }
}

const DEFAULT_JHS_SUBJECTS = [
  { name: "English Language", key: "English Language" },
  { name: "Mathematics", key: "Mathematics" },
  { name: "Science", key: "Science" },
  { name: "Career Technology", key: "Career Technology" },
  { name: "Social Studies", key: "Social Studies" },
  { name: "Computing", key: "Computing" },
  { name: "Religious and Moral Education", key: "Religious and Moral Education" },
  { name: "Ghanaian Language", key: "Ghanaian Language" },
  { name: "Creative Arts & Design", key: "Creative Arts & Design" }
];

export default function ReportCard({ student, metadata, calculatedScores, teacherSubjects, currentUser, viewingTerm, institution }) {
  if (!student) return null;

  const matchedResult = Array.isArray(calculatedScores)
    ? calculatedScores.find(s => s.sn === student.sn)
    : null;
  const isKgReport =
    resolveSchoolLevel(metadata?.classLevel, metadata?.level) === SCHOOL_LEVELS.KG ||
    Boolean(matchedResult?.isKgResult);

  if (isKgReport) {
    return (
      <KgReportCard
        student={student}
        metadata={metadata}
        calculatedScores={calculatedScores}
        teacherSubjects={teacherSubjects}
        viewingTerm={viewingTerm}
        institution={institution}
      />
    );
  }

  const subjects = teacherSubjects && teacherSubjects.length > 0 
    ? teacherSubjects.map(sub => ({ name: sub.name, key: sub.name }))
    : DEFAULT_JHS_SUBJECTS;

  const rollCount = calculatedScores.length;
  
  // Find current student overall result
  const result = calculatedScores.find(s => s.sn === student.sn) || {
    overallTotal: 0,
    overallRank: 'E',
    subjects: {}
  };

  const overallMax = metadata.timesOpen || 100; // attendance max
  const maxScore = (teacherSubjects?.length || 10) * 100;

  // Check if current user is an anglican.com account
  const isAnglican = currentUser?.email?.toLowerCase().endsWith('@anglican.com') || false;
  
  const termDisplayMap = { "Term 1": "ONE", "Term 2": "TWO", "Term 3": "THREE" };
  const displayTerm = termDisplayMap[viewingTerm] || viewingTerm || metadata.term || "";

  // Extract STEM scores for Parent Advisory Note (Page 2)
  const mathScore = result.subjects?.['Mathematics']?.total ?? 
                    result.subjects?.['Maths']?.total ?? 0;
  const scienceScore = result.subjects?.['Science']?.total ?? 
                       result.subjects?.['Integrated Science']?.total ?? 0;
  const advisoryNote = (student.parentAdvisoryNote !== undefined && student.parentAdvisoryNote !== '')
    ? student.parentAdvisoryNote
    : generateParentAdvisory(student.name, mathScore, scienceScore);
  
  const isCompactTable = subjects.length >= 11;
  const isMediumTable = subjects.length === 10;
  const rowPadClass = isCompactTable ? 'py-[9px]' : isMediumTable ? 'py-[11.5px]' : 'py-[13.5px]';
  const rowTextClass = isCompactTable ? 'text-[14.5px]' : isMediumTable ? 'text-[15px]' : 'text-[15.5px]';
  const headTeacherName = resolveHeadTeacherName(institution, metadata);

  return (
    <div className="print-page report-card-sheet max-w-[820px] mx-auto space-y-6 print:space-y-0 text-black">
      {/* =================================================================== */}
      {/* PAGE 1: Header, Bio, Enlarged Subject Results Table & Totals        */}
      {/* =================================================================== */}
      <div className="report-page-section bg-white text-black p-6 sm:p-8 border border-zinc-200 shadow-lg sm:min-h-[960px] flex flex-col justify-between gap-5">
        <div className="space-y-5">
          {/* 1. Header block */}
          <div className="text-center border-b-2 border-black pb-3 relative px-20 min-h-[86px] flex flex-col justify-center">
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
            <h4 className="text-[14.5px] font-bold text-black uppercase tracking-widest mt-2 border-t border-zinc-300 pt-1.5">
              Learner&apos;s Report Card - {displayTerm}
            </h4>
          </div>

          {/* 2. Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-7 gap-y-3 text-[13.5px] font-semibold pb-3 border-b border-zinc-300">
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Name:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{student.name}</span>
            </div>
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Class Position:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight text-black">{result.overallRank}</span>
            </div>

            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Class:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{metadata.classLevel}</span>
            </div>
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">No. On Roll:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{rollCount}</span>
            </div>

            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Academic Year:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{metadata.academicYear}</span>
            </div>
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Term:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{displayTerm}</span>
            </div>

            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[132px] shrink-0 whitespace-nowrap">Date:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{formatDate(metadata.date)}</span>
            </div>
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Next Term Begins:</span>
              <span className="font-bold text-[15px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{formatDate(metadata.nextTermBegins)}</span>
            </div>
          </div>

          {/* 3. Enlarged Subjects Table */}
          <div className="w-full px-[1px] pt-1">
            <table className={`report-card-table w-full table-fixed border-collapse border-[1.5px] border-black ${rowTextClass}`}>
              <thead>
                <tr className="bg-zinc-100 font-bold uppercase text-[12.5px] text-center border-b-[1.5px] border-black leading-tight text-black">
                  <th className="border border-black px-2.5 py-3 text-left w-[30%]">Subject</th>
                  <th className="border border-black px-1 py-3 w-[11.5%]">SBA Score (50%)</th>
                  <th className="border border-black px-1 py-3 w-[11.5%]">Exams Score (50%)</th>
                  <th className="border border-black px-1 py-3 w-[12%]">Total Score (100%)</th>
                  <th className="border border-black px-1 py-3 w-[9.5%]">Grade</th>
                  <th className="border border-black px-1 py-3 w-[9%]">Rank</th>
                  <th className="border border-black px-2.5 py-3 text-left w-[16.5%]">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub, idx) => {
                  const subRes = result.subjects[sub.key] || {
                    scaledSba: 0,
                    scaledExam: 0,
                    total: 0,
                    grade: 'E',
                    rank: '1st',
                    remark: 'EMERGING'
                  };

                  return (
                    <tr key={idx} className="leading-snug">
                      <td className={`border border-black px-2.5 ${rowPadClass} text-left font-bold text-black`}>
                        {sub.name}
                      </td>
                      <td className={`border border-black px-1.5 ${rowPadClass} text-center font-semibold tabular-nums text-black`}>
                        {subRes.scaledSba.toFixed(1)}
                      </td>
                      <td className={`border border-black px-1.5 ${rowPadClass} text-center font-semibold tabular-nums text-black`}>
                        {subRes.scaledExam.toFixed(1)}
                      </td>
                      <td className={`border border-black px-1.5 ${rowPadClass} text-center font-bold tabular-nums text-black`}>
                        {subRes.total.toFixed(1)}
                      </td>
                      <td className={`border border-black px-1.5 ${rowPadClass} text-center font-bold tabular-nums text-black`}>
                        {subRes.grade}
                      </td>
                      <td className={`border border-black px-1.5 ${rowPadClass} text-center font-semibold tabular-nums text-black`}>
                        {subRes.rank}
                      </td>
                      <td className={`border border-black px-2.5 ${rowPadClass} text-left font-semibold text-black`}>
                        {subRes.remark}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Totals Summary & Page 1 Footer */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6 text-[15px] font-semibold border-[1.5px] border-black rounded bg-zinc-50 px-4 py-3">
            <div className="flex gap-2 items-baseline">
              <span className="text-black font-bold uppercase whitespace-nowrap shrink-0">Overall Score:</span>
              <span className="font-bold text-[16.5px] text-black">
                {result.overallTotal.toFixed(1)}{' '}
                <span className="font-normal text-[14.5px] text-black">OUT OF {maxScore}</span>
              </span>
            </div>
            <div className="flex gap-2 items-baseline">
              <span className="text-black font-bold uppercase whitespace-nowrap shrink-0">Attendance:</span>
              <span className="font-bold text-[16.5px] text-black">
                {student.attendance || 0}{' '}
                <span className="font-normal text-[14.5px] text-black">OUT OF {overallMax}</span>
              </span>
            </div>
          </div>

          <ReportPageFooter pageNum={1} totalPages={3} />
        </div>
      </div>

      {/* =================================================================== */}
      {/* PAGE 2: Conduct/Remarks, Signatures & Names, Grading Interpretation */}
      {/* =================================================================== */}
      <div className="print-page-break">
        <div className="report-page-section bg-white text-black p-6 sm:p-8 border border-zinc-200 shadow-lg sm:min-h-[960px] flex flex-col justify-between gap-5">
          <ReportContinuationHeader
            schoolName={metadata.schoolName}
            district={metadata.district}
            sectionTitle="Conduct, Endorsement & Grading Interpretation"
            studentName={student.name}
            classLevel={metadata.classLevel}
            displayTerm={displayTerm}
          />

          <ReportConductRemarksSection
            conduct={student.conduct}
            interest={student.interest}
            remarks={student.remarks}
            remarksLabel="Class Teacher's Remarks:"
            promotedTo={viewingTerm === 'Term 3' ? student.promotedTo : ''}
            promotedLabel="Promoted to:"
          />

          <ReportSignaturesBlock
            teacherLabel="Class Teacher's Signature"
            teacherName={metadata.teacherName}
            headTeacherName={headTeacherName}
          />

          {/* Grading Interpretation Table (Full width for crisp alignment & legibility) */}
          <div className="break-inside-avoid space-y-2.5">
            <span className="text-[14px] font-bold uppercase text-black block tracking-wide">
              Grading Interpretation Key
            </span>
            <div className="w-full px-[1px]">
              <table className="report-card-table grading-key-table w-full table-fixed text-left text-[13.5px] border-collapse border-[1.5px] border-black">
                <thead className="bg-zinc-100 text-black font-bold uppercase text-[12px]">
                  <tr>
                    <th className="border border-black px-3 py-2 w-[32%]">Score Range</th>
                    <th className="border border-black px-3 py-2 text-center w-[20%]">Grade</th>
                    <th className="border border-black px-3 py-2 w-[48%]">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="text-black font-medium">
                  <tr>
                    <td className="border border-black px-3 py-1.5">90 - 100</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">1</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Highest</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">80 - 89</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">2</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Higher</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">70 - 79</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">3</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">High</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">60 - 69</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">4</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">High Average</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">55 - 59</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">5</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Average</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">50 - 54</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">6</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Low Average</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">40 - 49</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">7</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Low</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">35 - 39</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">8</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Lower</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5">0 - 34</td>
                    <td className="border border-black px-3 py-1.5 text-center font-bold">9</td>
                    <td className="border border-black px-3 py-1.5 font-semibold">Lowest</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ReportPageFooter pageNum={2} totalPages={3} />
        </div>
      </div>

      {/* =================================================================== */}
      {/* PAGE 3: Parent / Guardian Academic Advisory & Acknowledgment Slip   */}
      {/* =================================================================== */}
      <div className="print-page-break">
        <div className="report-page-section bg-white text-black p-6 sm:p-8 border border-zinc-200 shadow-lg sm:min-h-[960px] flex flex-col justify-between gap-6">
          <ReportContinuationHeader
            schoolName={metadata.schoolName}
            district={metadata.district}
            sectionTitle="Parent / Guardian Academic Advisory & Acknowledgment"
            studentName={student.name}
            classLevel={metadata.classLevel}
            displayTerm={displayTerm}
          />

          {/* 8. PARENT / GUARDIAN ACADEMIC ADVISORY */}
          <div className="break-inside-avoid space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black pb-2">
              <span className="text-[15px] font-bold uppercase text-black tracking-wide">
                Parent / Guardian Academic Advisory
              </span>
              <span className="text-[12px] font-bold text-zinc-700 uppercase">
                Mathematics &amp; Science Diagnostic
              </span>
            </div>

            <div className="bg-zinc-50 border-[1.5px] border-black rounded p-5 sm:p-6 text-[15px] leading-[1.75] text-black">
              <div className="whitespace-pre-line font-normal">{advisoryNote}</div>
            </div>
          </div>

          <ParentAcknowledgmentSlip
            statementText={'"I have reviewed my ward\'s terminal performance, conduct, and recommendations across this report card."'}
            returnToLabel="class teacher"
          />

          <ReportPageFooter pageNum={3} totalPages={3} />
        </div>
      </div>
    </div>
  );
}
