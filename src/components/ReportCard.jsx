import React from 'react';
import { getOrdinalSuffix, generateParentAdvisory } from '../utils/calculations';
import { resolveSchoolLevel, SCHOOL_LEVELS } from '../constants/curriculum';
import { resolveHeadTeacherName } from '../utils/schoolDataHandlers';
import KgReportCard from './KgReportCard';
import SchoolCrestImage from './SchoolCrestImage';
import { GHANA_COA_DATA_URI } from '../utils/logoAsset';

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
  const rowPadClass = isCompactTable ? 'py-[6.5px]' : isMediumTable ? 'py-[8px]' : 'py-[10px]';
  const rowTextClass = isCompactTable ? 'text-[13.5px]' : isMediumTable ? 'text-[14px]' : 'text-[15px]';

  return (
    <div className="print-page report-card-sheet bg-white text-black p-6 sm:p-7 border border-zinc-200 shadow-lg max-w-[820px] mx-auto">
      {/* PAGE 1: Header, Bio, Enlarged Results Table, Totals, Conduct/Remarks, Signatures */}
      <div className="report-page-one flex flex-col justify-between gap-5 sm:min-h-[980px]">
        {/* 1. Header block */}
        <div className="text-center border-b-2 border-black pb-3 relative px-20 min-h-[84px] flex flex-col justify-center">
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
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight">{student.name}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="text-black font-bold uppercase w-[162px] shrink-0 whitespace-nowrap">Class Position:</span>
            <span className="font-bold text-[14.5px] border-b border-zinc-500 flex-1 pb-0.5 leading-tight text-black">{result.overallRank}</span>
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

        {/* 3 & 4. Enlarged Subjects Table + Totals Block */}
        <div className="space-y-4">
          <div className="w-full px-[1px]">
            <table className={`report-card-table w-full table-fixed border-collapse border-[1.5px] border-black ${rowTextClass}`}>
              <thead>
                <tr className="bg-zinc-100 font-bold uppercase text-[12.5px] text-center border-b-[1.5px] border-black leading-tight text-black">
                  <th className="border border-black px-2.5 py-2.5 text-left w-[30%]">Subject</th>
                  <th className="border border-black px-1 py-2.5 w-[11.5%]">SBA Score (50%)</th>
                  <th className="border border-black px-1 py-2.5 w-[11.5%]">Exams Score (50%)</th>
                  <th className="border border-black px-1 py-2.5 w-[12%]">Total Score (100%)</th>
                  <th className="border border-black px-1 py-2.5 w-[9.5%]">Grade</th>
                  <th className="border border-black px-1 py-2.5 w-[9%]">Rank</th>
                  <th className="border border-black px-2.5 py-2.5 text-left w-[16.5%]">Remarks</th>
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

          {/* 4. Totals Block */}
          <div className="grid grid-cols-2 gap-6 text-[14.5px] font-semibold pt-1">
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase whitespace-nowrap shrink-0">Overall Score:</span>
              <span className="font-bold text-[15.5px] border-b border-zinc-500 flex-1 pb-0.5">
                {result.overallTotal.toFixed(1)} <span className="font-normal text-[14px] text-black">OUT OF {maxScore}</span>
              </span>
            </div>
            <div className="flex gap-2 items-end">
              <span className="text-black font-bold uppercase whitespace-nowrap shrink-0">Attendance:</span>
              <span className="font-bold text-[15.5px] border-b border-zinc-500 flex-1 pb-0.5">
                {student.attendance || 0} <span className="font-normal text-[14px] text-black">OUT OF {overallMax}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 5. Conduct, Interest & Class Teacher's Remarks Block (Large & Parent-Readable) */}
        <div className="grid grid-cols-1 gap-y-4 text-[14.5px] pt-3.5 border-t border-zinc-300">
          <div className="flex gap-3 items-baseline">
            <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Conduct:</span>
            <span className="font-semibold text-[15.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-snug">
              {student.conduct || "N/A"}
            </span>
          </div>
          <div className="flex gap-3 items-baseline">
            <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Interest:</span>
            <span className="font-semibold text-[15.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-snug">
              {student.interest || "N/A"}
            </span>
          </div>
          <div className="flex gap-3 items-baseline">
            <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Class Teacher&apos;s Remarks:</span>
            <span className="font-semibold text-[15.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-snug">
              {student.remarks || "N/A"}
            </span>
          </div>
          {viewingTerm === 'Term 3' && student.promotedTo && (
            <div className="flex gap-3 items-baseline">
              <span className="text-black font-bold uppercase w-[236px] shrink-0 whitespace-nowrap">Promoted to:</span>
              <span className="font-bold text-[15.5px] border-b border-zinc-500 flex-1 pb-1 text-black leading-snug">
                {student.promotedTo}
              </span>
            </div>
          )}
        </div>

        {/* 6. Signatures & Page 1 Footer (Anchored cleanly at bottom of Page 1) */}
        <div className="break-inside-avoid pt-6">
          <div className="grid grid-cols-2 gap-10 text-center text-[12.5px] font-bold uppercase">
            <div className="space-y-1">
              <div className="border-t border-black pt-1.5 mx-auto max-w-[230px]" />
              <div className="text-black">Class Teacher&apos;s Signature</div>
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

          {/* Subtle footer */}
          <div className="text-center text-[10.5px] text-black mt-4 border-t border-zinc-200 pt-1.5 italic">
            Madifor Technologies (0592664865)
          </div>
        </div>
      </div>

      {/* Grading Interpretation Table (Starts Page 2 in Print) */}
      <div className="print-page-break mt-6 pt-5 border-t border-zinc-300 break-inside-avoid">
        <span className="text-[14px] font-bold uppercase text-black block mb-2.5">Grading Interpretation</span>
        <div className="max-w-lg px-[1px]">
          <table className="report-card-table grading-key-table w-full text-left text-[13px] border-collapse border-[1.5px] border-black">
            <thead className="bg-zinc-100 text-black font-bold">
              <tr>
                <th className="border border-black px-3 py-1.5">Score Range</th>
                <th className="border border-black px-3 py-1.5 text-center">Grade</th>
                <th className="border border-black px-3 py-1.5">Interpretation</th>
              </tr>
            </thead>
          <tbody className="text-black font-medium">
            <tr>
              <td className="border border-black px-3 py-1.5">90 - 100</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">1</td>
              <td className="border border-black px-3 py-1.5">Highest</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">80 - 89</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">2</td>
              <td className="border border-black px-3 py-1.5">Higher</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">70 - 79</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">3</td>
              <td className="border border-black px-3 py-1.5">High</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">60 - 69</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">4</td>
              <td className="border border-black px-3 py-1.5">High Average</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">55 - 59</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">5</td>
              <td className="border border-black px-3 py-1.5">Average</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">50 - 54</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">6</td>
              <td className="border border-black px-3 py-1.5">Low Average</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">40 - 49</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">7</td>
              <td className="border border-black px-3 py-1.5">Low</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">35 - 39</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">8</td>
              <td className="border border-black px-3 py-1.5">Lower</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">0 - 34</td>
              <td className="border border-black px-3 py-1.5 text-center font-bold">9</td>
              <td className="border border-black px-3 py-1.5">Lowest</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* 8. PARENT / GUARDIAN ACADEMIC ADVISORY (Page 2) */}
      <div className="mt-6 pt-5 border-t-2 border-black break-inside-avoid space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold uppercase text-black tracking-wide">
            PARENT / GUARDIAN ACADEMIC ADVISORY
          </span>
          <span className="text-[11px] font-bold text-zinc-700 uppercase">
            Mathematics &amp; Science Diagnostic
          </span>
        </div>

        <div className="bg-zinc-50 border border-zinc-400 rounded p-4 text-[13.5px] leading-relaxed text-black">
          <div className="whitespace-pre-line font-normal">
            {advisoryNote}
          </div>
        </div>

        {/* PARENT / GUARDIAN ACKNOWLEDGMENT SLIP */}
        <div className="border-[1.5px] border-black rounded p-4 bg-white mt-4 break-inside-avoid">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[13px] font-bold uppercase text-black">
              PARENT / GUARDIAN ACKNOWLEDGMENT
            </span>
            <span className="text-[11px] text-zinc-600 italic">Please sign and return copy to class teacher</span>
          </div>
          <p className="text-[12.5px] text-zinc-800 italic mb-5">
            &quot;I have reviewed my ward&apos;s terminal performance and the recommendations above.&quot;
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
