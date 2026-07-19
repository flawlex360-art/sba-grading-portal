import React, { useState } from 'react';
import { Search, Filter, FileSpreadsheet } from 'lucide-react';

const SUBJECT_KEYS = [
  { name: "English Language", key: "ENG. LANG." },
  { name: "Mathematics", key: "MATHS" },
  { name: "Science", key: "SCIENCE" },
  { name: "Career Technology", key: "C. TECH" },
  { name: "Social Studies", key: "SOCIAL" },
  { name: "Computing", key: "COMPUTING" },
  { name: "Religious and Moral Education", key: "RME" },
  { name: "Ghanaian Language", key: "GH. LANG." },
  { name: "Creative Arts & Design", key: "C. ARTS" }
];

export default function ConsolidatedRecords({ students, gradesStore }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');

  // Build a flat list of all subject records, mimicking the stacked nature of the "OPEN" sheet
  const flatRecords = [];
  
  SUBJECT_KEYS.forEach(sub => {
    const subGrades = gradesStore[sub.key] || {};
    
    // Sort students by score to compute ranking within the subject
    const subjectTotals = students.map(s => {
      const sg = subGrades[s.sn] || { gw1: 0, test: 0, gw2: 0, proj: 0, exams: 0 };
      const sbaTotal = (parseFloat(sg.gw1) || 0) + (parseFloat(sg.test) || 0) + (parseFloat(sg.gw2) || 0) + (parseFloat(sg.proj) || 0);
      const scaledSba = (sbaTotal / 60) * 50;
      const scaledExam = (parseFloat(sg.exams) || 0) * 0.5;
      const overallTotal = scaledSba + scaledExam;
      return { sn: s.sn, name: s.name, overallTotal, gw1: sg.gw1, test: sg.test, gw2: sg.gw2, proj: sg.proj, exams: sg.exams };
    });
    
    const sorted = [...subjectTotals].sort((a, b) => b.overallTotal - a.overallTotal);
    const ranks = {};
    sorted.forEach((item, idx) => {
      if (idx > 0 && item.overallTotal === sorted[idx - 1].overallTotal) {
        ranks[item.sn] = ranks[sorted[idx - 1].sn];
      } else {
        ranks[item.sn] = idx + 1;
      }
    });

    students.forEach(s => {
      const sg = subGrades[s.sn] || { gw1: 0, test: 0, gw2: 0, proj: 0, exams: 0 };
      const gw1 = parseFloat(sg.gw1) || 0;
      const test = parseFloat(sg.test) || 0;
      const gw2 = parseFloat(sg.gw2) || 0;
      const proj = parseFloat(sg.proj) || 0;
      const exams = parseFloat(sg.exams) || 0;

      const sbaTotal = gw1 + test + gw2 + proj;
      const scaledSba = (sbaTotal / 60) * 50;
      const scaledExam = exams * 0.5;
      const overallTotal = scaledSba + scaledExam;
      
      // Calculate grade
      let grade = "E";
      if (overallTotal > 79) grade = "HP";
      else if (overallTotal > 67) grade = "P";
      else if (overallTotal > 53) grade = "AP";
      else if (overallTotal > 39) grade = "D";

      flatRecords.push({
        subjectName: sub.name,
        subjectKey: sub.key,
        sn: s.sn,
        name: s.name,
        gw1: sg.gw1 || 0,
        test: sg.test || 0,
        gw2: sg.gw2 || 0,
        proj: sg.proj || 0,
        sbaTotal: Math.round(sbaTotal * 10) / 10,
        scaledSba: Math.round(scaledSba * 10) / 10,
        exams: sg.exams || 0,
        scaledExam: Math.round(scaledExam * 10) / 10,
        overallTotal: Math.round(overallTotal * 10) / 10,
        grade,
        rank: ranks[s.sn]
      });
    });
  });

  // Filter records
  const filteredRecords = flatRecords.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'ALL' || r.subjectKey === selectedSubject;
    const matchesGrade = selectedGrade === 'ALL' || r.grade === selectedGrade;
    return matchesSearch && matchesSubject && matchesGrade;
  });

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="glass-panel p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3 items-center no-print">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by student name or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="flex-1 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          >
            <option value="ALL">All Subjects</option>
            {SUBJECT_KEYS.map(s => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="flex-1 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          >
            <option value="ALL">All Grades</option>
            <option value="HP">HP (Highly Proficient)</option>
            <option value="P">P (Proficient)</option>
            <option value="AP">AP (Approaching Proficiency)</option>
            <option value="D">D (Developing)</option>
            <option value="E">E (Emerging)</option>
          </select>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
              OPEN — Consolidated Subject Records
            </h3>
            <p className="text-[10px] text-zinc-400">
              A complete vertical stack of all subject scores, mimicking the layout of the Excel "OPEN" sheet.
            </p>
          </div>
          <span className="text-xs text-zinc-400 no-print">
            Showing {filteredRecords.length} of {flatRecords.length} records
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse gradebook-table">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10 text-center">
              <tr>
                <th className="px-3 py-2.5 w-12">S/N</th>
                <th className="px-3 py-2.5 text-left w-36">Subject</th>
                <th className="px-3 py-2.5 text-left min-w-[150px]">Student Name</th>
                <th className="px-2 py-2.5 w-16">GW 1 (15)</th>
                <th className="px-2 py-2.5 w-16">Test (15)</th>
                <th className="px-2 py-2.5 w-16">GW 2 (15)</th>
                <th className="px-2 py-2.5 w-16">Proj (15)</th>
                <th className="px-3 py-2.5 w-16">SBA Total</th>
                <th className="px-3 py-2.5 w-16">SBA (50)</th>
                <th className="px-3 py-2.5 w-16">Exam (100)</th>
                <th className="px-3 py-2.5 w-16">Exam (50)</th>
                <th className="px-3 py-2.5 w-16 font-bold">Total (100)</th>
                <th className="px-3 py-2.5 w-12">Grade</th>
                <th className="px-3 py-2.5 w-12">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredRecords.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-center">
                  <td className="px-3 py-2.5 text-center font-mono text-zinc-400">{row.sn}</td>
                  <td className="px-3 py-2.5 text-left font-semibold text-zinc-500 dark:text-zinc-400">{row.subjectName}</td>
                  <td className="px-3 py-2.5 text-left font-semibold text-zinc-800 dark:text-zinc-200">{row.name}</td>
                  <td className="px-2 py-2.5 font-mono">{row.gw1}</td>
                  <td className="px-2 py-2.5 font-mono">{row.test}</td>
                  <td className="px-2 py-2.5 font-mono">{row.gw2}</td>
                  <td className="px-2 py-2.5 font-mono">{row.proj}</td>
                  <td className="px-3 py-2.5 font-mono text-zinc-400">{row.sbaTotal}</td>
                  <td className="px-3 py-2.5 font-mono text-zinc-500">{row.scaledSba}</td>
                  <td className="px-3 py-2.5 font-mono">{row.exams}</td>
                  <td className="px-3 py-2.5 font-mono text-zinc-500">{row.scaledExam}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-zinc-900 dark:text-zinc-100">{row.overallTotal}</td>
                  <td className="px-3 py-2.5">
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      row.grade === 'HP' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      row.grade === 'P' ? 'bg-blue-500/10 text-blue-500' :
                      row.grade === 'AP' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                      row.grade === 'D' ? 'bg-orange-500/10 text-orange-600' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {row.grade}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-zinc-400">{row.rank}</td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-zinc-400">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
