import React from 'react';
import { getOrdinalSuffix, generateParentAdvisory } from '../utils/calculations';
import { resolveSchoolLevel, SCHOOL_LEVELS } from '../constants/curriculum';
import KgReportCard from './KgReportCard';
import SchoolCrestImage from './SchoolCrestImage';

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
  
  return (
    <div className="print-page bg-white text-black p-5 border border-zinc-200 shadow-lg max-w-[800px] mx-auto space-y-3.5 font-sans">
      
      {/* 1. Header block */}
      <div className="text-center border-b-2 border-zinc-950 pb-2.5 relative px-20 min-h-[78px] flex flex-col justify-center">
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
        <h1 className="text-xl font-bold uppercase tracking-wide leading-tight">Ghana Education Service</h1>
        <h2 className="text-sm font-semibold uppercase text-black tracking-wider mt-0.5">
          {metadata.district}
        </h2>
        <h3 className="text-lg font-bold uppercase text-black tracking-wide mt-0.5 leading-snug">
          {metadata.schoolName}
        </h3>
        <h4 className="text-md font-bold text-black uppercase tracking-widest mt-1.5 border-t border-zinc-200 pt-1.5">
          Learner's Report Card - {displayTerm}
        </h4>
      </div>

      {/* 2. Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-semibold pb-2.5 border-b border-zinc-200">
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-28 flex-shrink-0">Name:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{student.name}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-black uppercase w-36 flex-shrink-0">Class Position:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5 text-black">{result.overallRank}</span>
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

      {/* 3. Subjects Table (font size matches Learner Name: text-xs) */}
      <table className="w-full border-collapse border border-zinc-950 text-xs">
        <thead>
          <tr className="bg-zinc-100 font-bold uppercase text-[11px] text-center border-b border-zinc-950 leading-tight">
            <th className="border border-zinc-950 px-2.5 py-1.5 text-left w-[33%]">Subject</th>
            <th className="border border-zinc-950 px-1.5 py-1.5 w-[11%]">SBA Score (50%)</th>
            <th className="border border-zinc-950 px-1.5 py-1.5 w-[11%]">Exams Score (50%)</th>
            <th className="border border-zinc-950 px-1.5 py-1.5 w-[11%]">Total Score (100%)</th>
            <th className="border border-zinc-950 px-1.5 py-1.5 w-[8%]">Grade</th>
            <th className="border border-zinc-950 px-1.5 py-1.5 w-[9%]">Rank</th>
            <th className="border border-zinc-950 px-2.5 py-1.5 text-left w-[17%]">Remarks</th>
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
              <tr key={idx} className="border-b border-zinc-300 leading-snug">
                <td className="border border-zinc-950 px-2.5 py-1 text-left font-bold text-black">
                  {sub.name}
                </td>
                <td className="border border-zinc-950 px-1.5 py-1 text-center font-semibold tabular-nums text-black">
                  {subRes.scaledSba.toFixed(1)}
                </td>
                <td className="border border-zinc-950 px-1.5 py-1 text-center font-semibold tabular-nums text-black">
                  {subRes.scaledExam.toFixed(1)}
                </td>
                <td className="border border-zinc-950 px-1.5 py-1 text-center font-bold tabular-nums text-black">
                  {subRes.total.toFixed(1)}
                </td>
                <td className="border border-zinc-950 px-1.5 py-1 text-center font-bold tabular-nums text-black">
                  {subRes.grade}
                </td>
                <td className="border border-zinc-950 px-1.5 py-1 text-center font-semibold tabular-nums text-black">
                  {subRes.rank}
                </td>
                <td className="border border-zinc-950 px-2.5 py-1 text-left font-semibold text-black">
                  {subRes.remark}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 4. Totals Block */}
      <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-0.5">
        <div className="flex gap-2">
          <span className="text-black uppercase">Overall score:</span>
          <span className="font-bold border-b border-zinc-400 flex-1">
            {result.overallTotal.toFixed(1)} <span className="font-normal text-black">OUT OF {maxScore}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-black uppercase w-24">Attendance:</span>
          <span className="font-bold border-b border-zinc-400 flex-1">
            {student.attendance || 0} <span className="font-normal text-black">OUT OF {overallMax}</span>
          </span>
        </div>
      </div>

      {/* 5. Teachers Remarks Block */}
      <div className="grid grid-cols-1 gap-y-2 text-xs pt-2 border-t border-zinc-200">
        <div className="flex gap-2 items-center">
          <span className="text-black font-bold uppercase w-48 shrink-0">Conduct:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.conduct || "N/A"}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-black font-bold uppercase w-48 shrink-0">Interest:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.interest || "N/A"}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-black font-bold uppercase w-48 shrink-0">Class Teacher's Remarks:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.remarks || "N/A"}</span>
        </div>
        {viewingTerm === 'Term 3' && student.promotedTo && (
          <div className="flex gap-2 items-center">
            <span className="text-black font-bold uppercase w-48 shrink-0">Promoted to:</span>
            <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5 text-black">{student.promotedTo}</span>
          </div>
        )}
      </div>

      {/* 6. Signatures & Page 1 Footer (Locked together on Page 1) */}
      <div className="break-inside-avoid pt-4">
        <div className="grid grid-cols-2 gap-8 text-center text-[10px] font-bold uppercase">
          <div className="space-y-0.5">
            <div className="border-t border-zinc-500 pt-1 mx-auto max-w-[200px]" />
            <div>Class Teacher's Signature</div>
            {metadata.teacherName && (
              <div className="text-zinc-600 dark:text-zinc-400 capitalize font-medium">{metadata.teacherName}</div>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="border-t border-zinc-500 pt-1 mx-auto max-w-[200px]" />
            <div>Headteacher's Signature</div>
            {metadata.headTeacherName && (
              <div className="text-zinc-600 dark:text-zinc-400 capitalize font-medium">{metadata.headTeacherName}</div>
            )}
          </div>
        </div>

        {/* Subtle footer */}
        <div className="text-center text-[9px] text-black mt-2.5 border-t border-zinc-100 pt-1 italic">
          Madifor Technologies (0592664865)
        </div>
      </div>

      {/* Grading Interpretation Table (Starts Page 2 in Print) */}
      <div className="print-page-break mt-4 pt-4 border-t border-zinc-200 break-inside-avoid">
        <span className="text-xs font-bold uppercase text-black block mb-2">Grading Interpretation</span>
        <div className="max-w-md">
          <table className="grading-key-table w-full text-left text-[10px] border-collapse border border-zinc-300">
            <thead className="bg-zinc-100 text-black font-bold">
              <tr>
                <th className="border border-zinc-300 px-2 py-1">Score Range</th>
                <th className="border border-zinc-300 px-2 py-1 text-center">Grade</th>
                <th className="border border-zinc-300 px-2 py-1">Interpretation</th>
              </tr>
            </thead>
          <tbody className="text-black font-medium">
            <tr>
              <td className="border border-zinc-300 px-2 py-1">90 - 100</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">1</td>
              <td className="border border-zinc-300 px-2 py-1">Highest</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">80 - 89</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">2</td>
              <td className="border border-zinc-300 px-2 py-1">Higher</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">70 - 79</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">3</td>
              <td className="border border-zinc-300 px-2 py-1">High</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">60 - 69</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">4</td>
              <td className="border border-zinc-300 px-2 py-1">High Average</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">55 - 59</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">5</td>
              <td className="border border-zinc-300 px-2 py-1">Average</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">50 - 54</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">6</td>
              <td className="border border-zinc-300 px-2 py-1">Low Average</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">40 - 49</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">7</td>
              <td className="border border-zinc-300 px-2 py-1">Low</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">35 - 39</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">8</td>
              <td className="border border-zinc-300 px-2 py-1">Lower</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">0 - 34</td>
              <td className="border border-zinc-300 px-2 py-1 text-center font-bold">9</td>
              <td className="border border-zinc-300 px-2 py-1">Lowest</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* 8. PARENT / GUARDIAN ACADEMIC ADVISORY (Page 2) */}
      <div className="mt-6 pt-4 border-t-2 border-zinc-950 break-inside-avoid space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase text-black tracking-wide">
            PARENT / GUARDIAN ACADEMIC ADVISORY
          </span>
          <span className="text-[9px] font-bold text-zinc-600 uppercase">
            Mathematics & Science Diagnostic
          </span>
        </div>

        <div className="bg-zinc-50 border border-zinc-300 rounded p-3 text-[11px] leading-relaxed text-black">
          <div className="whitespace-pre-line font-normal">
            {advisoryNote}
          </div>
        </div>

        {/* PARENT / GUARDIAN ACKNOWLEDGMENT SLIP */}
        <div className="border border-zinc-950 rounded p-3 bg-white mt-3 break-inside-avoid">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase text-black">
              PARENT / GUARDIAN ACKNOWLEDGMENT
            </span>
            <span className="text-[9px] text-zinc-500 italic">Please sign and return copy to class teacher</span>
          </div>
          <p className="text-[10px] text-zinc-700 italic mb-4">
            "I have reviewed my ward's terminal performance and the recommendations above."
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
