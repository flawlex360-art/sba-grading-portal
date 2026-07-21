import React from 'react';
import { getOrdinalSuffix } from '../utils/calculations';

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

export default function ReportCard({ student, metadata, calculatedScores, teacherSubjects }) {
  if (!student) return null;

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
  
  return (
    <div className="print-page bg-white text-zinc-950 p-6 border border-zinc-200 shadow-lg max-w-[800px] mx-auto space-y-4 font-sans">
      
      {/* 1. Header block */}
      <div className="text-center border-b-2 border-zinc-950 pb-4 relative px-20 min-h-[90px] flex flex-col justify-center">
        <img 
          src="/ghana-coa.svg" 
          alt="Ghana Coat of Arms" 
          className="absolute left-0 top-1 w-16 h-16 object-contain"
        />
        <h1 className="text-xl font-bold uppercase tracking-wide">Ghana Education Service</h1>
        <h2 className="text-sm font-semibold uppercase text-zinc-600 tracking-wider mt-0.5">
          {metadata.district}
        </h2>
        <h3 className="text-lg font-bold uppercase text-zinc-800 tracking-wide mt-1">
          {metadata.schoolName}
        </h3>
        <h4 className="text-md font-bold text-zinc-500 uppercase tracking-widest mt-2 border-t border-zinc-200 pt-2">
          Learner's Report Card
        </h4>
      </div>

      {/* 2. Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs font-semibold pb-4 border-b border-zinc-200">
        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-28 flex-shrink-0">Name:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{student.name}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-36 flex-shrink-0">Class Position:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5 text-blue-700">{result.overallRank}</span>
        </div>
        
        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-28 flex-shrink-0">Class:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{metadata.classLevel}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-36 flex-shrink-0">No. On Roll:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{rollCount}</span>
        </div>

        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-28 flex-shrink-0">Academic Year:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{metadata.academicYear}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-36 flex-shrink-0">Term:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{metadata.term}</span>
        </div>

        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-28 flex-shrink-0">Date:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{formatDate(metadata.date)}</span>
        </div>
        <div className="flex gap-2 items-end">
          <span className="text-zinc-500 uppercase w-36 flex-shrink-0">Next Term Begins:</span>
          <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5">{formatDate(metadata.nextTermBegins)}</span>
        </div>
      </div>

      {/* 3. Subjects Table */}
      <table className="w-full border-collapse border border-zinc-950 text-sm">
        <thead>
          <tr className="bg-zinc-100 font-bold uppercase text-xs text-center border-b border-zinc-950">
            <th className="border border-zinc-950 px-3 py-2 text-left min-w-[150px]">Subject</th>
            <th className="border border-zinc-950 px-2 py-2 w-24">SBA Score (50%)</th>
            <th className="border border-zinc-950 px-2 py-2 w-24">Exams Score (50%)</th>
            <th className="border border-zinc-950 px-2 py-2 w-24">Total Score (100%)</th>
            <th className="border border-zinc-950 px-2 py-2 w-16">Grade</th>
            <th className="border border-zinc-950 px-2 py-2 w-16">Rank</th>
            <th className="border border-zinc-950 px-3 py-2 text-left min-w-[150px]">Remarks</th>
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
              <tr key={idx} className="border-b border-zinc-300">
                <td className="border border-zinc-950 px-3 py-1.5 text-left font-semibold text-zinc-900">
                  {sub.name}
                </td>
                <td className="border border-zinc-950 px-2 py-1.5 text-center font-mono text-zinc-700">
                  {subRes.scaledSba.toFixed(1)}
                </td>
                <td className="border border-zinc-950 px-2 py-1.5 text-center font-mono text-zinc-700">
                  {subRes.scaledExam.toFixed(1)}
                </td>
                <td className="border border-zinc-950 px-2 py-1.5 text-center font-mono font-bold text-zinc-950">
                  {subRes.total.toFixed(1)}
                </td>
                <td className="border border-zinc-950 px-2 py-1.5 text-center font-bold text-blue-600">
                  {subRes.grade}
                </td>
                <td className="border border-zinc-950 px-2 py-1.5 text-center font-mono text-zinc-500">
                  {subRes.rank}
                </td>
                <td className="border border-zinc-950 px-3 py-1.5 text-left font-medium text-zinc-600">
                  {subRes.remark}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 4. Totals Block */}
      <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-2">
        <div className="flex gap-2">
          <span className="text-zinc-500 uppercase">Overall score:</span>
          <span className="font-bold border-b border-zinc-400 flex-1">
            {result.overallTotal.toFixed(1)} <span className="font-normal text-zinc-400">OUT OF {maxScore}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 uppercase w-20">Attendance:</span>
          <span className="font-bold border-b border-zinc-400 flex-1">
            {student.attendance || 0} <span className="font-normal text-zinc-400">OUT OF {overallMax}</span>
          </span>
        </div>
      </div>

      {/* 5. Teachers Remarks Block */}
      <div className="grid grid-cols-1 gap-y-3 text-xs pt-4 border-t border-zinc-200">
        <div className="flex gap-2 items-center">
          <span className="text-zinc-500 font-bold uppercase w-40">Conduct:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.conduct || "N/A"}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-zinc-500 font-bold uppercase w-40">Interest:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.interest || "N/A"}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-zinc-500 font-bold uppercase w-40">Class Teacher's Remarks:</span>
          <span className="font-semibold border-b border-zinc-400 flex-1 pb-0.5">{student.remarks || "N/A"}</span>
        </div>
        {student.promotedTo && (
          <div className="flex gap-2 items-center">
            <span className="text-zinc-500 font-bold uppercase w-40">Promoted to:</span>
            <span className="font-bold border-b border-zinc-400 flex-1 pb-0.5 text-blue-700">{student.promotedTo}</span>
          </div>
        )}
      </div>

      {/* 6. Signatures */}
      <div className="grid grid-cols-2 gap-8 text-center text-[10px] font-bold uppercase pt-6">
        <div className="space-y-1">
          <div className="border-t border-zinc-500 pt-1.5 mx-auto max-w-[200px]" />
          <div>Class Teacher's Signature</div>
        </div>
        <div className="space-y-1">
          <div className="border-t border-zinc-500 pt-1.5 mx-auto max-w-[200px]" />
          <div>Headteacher's Signature</div>
        </div>
      </div>

      {/* Subtle footer */}
      <div className="text-center text-[9px] text-zinc-400 mt-4 border-t border-zinc-100 pt-2 italic">
        Flawlex Technologies (0592664865)
      </div>

      {/* Grading Interpretation Table */}
      <div className="mt-8 pt-8 border-t border-zinc-200 break-before-page">
        <span className="text-sm font-bold uppercase text-zinc-800 block mb-3">Grading Interpretation</span>
        <table className="w-full text-left text-xs border-collapse border border-zinc-300">
          <thead className="bg-zinc-100 text-zinc-800 font-bold">
            <tr>
              <th className="border border-zinc-300 px-3 py-2">Score Range</th>
              <th className="border border-zinc-300 px-3 py-2 text-center">Grade</th>
              <th className="border border-zinc-300 px-3 py-2">Interpretation</th>
            </tr>
          </thead>
          <tbody className="text-zinc-800 font-medium">
            <tr>
              <td className="border border-zinc-300 px-3 py-2">80 - 100</td>
              <td className="border border-zinc-300 px-3 py-2 text-center font-bold">A</td>
              <td className="border border-zinc-300 px-3 py-2">Highly Proficient (HP)</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-3 py-2">68 - 79</td>
              <td className="border border-zinc-300 px-3 py-2 text-center font-bold">B</td>
              <td className="border border-zinc-300 px-3 py-2">Proficient (P)</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-3 py-2">54 - 67</td>
              <td className="border border-zinc-300 px-3 py-2 text-center font-bold">C</td>
              <td className="border border-zinc-300 px-3 py-2">Approaching Proficient (AP)</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-3 py-2">40 - 53</td>
              <td className="border border-zinc-300 px-3 py-2 text-center font-bold">D</td>
              <td className="border border-zinc-300 px-3 py-2">Developing (D)</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 px-3 py-2">0 - 39</td>
              <td className="border border-zinc-300 px-3 py-2 text-center font-bold">E</td>
              <td className="border border-zinc-300 px-3 py-2">Emerging (E)</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
