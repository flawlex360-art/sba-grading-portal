import React, { useState } from 'react';
import { Award, Download, Printer } from 'lucide-react';

const DEFAULT_JHS_HEADERS = [
  { name: "ENG. LANG.", key: "English Language" },
  { name: "MATHS", key: "Mathematics" },
  { name: "SCIENCE", key: "Science" },
  { name: "C. TECH", key: "Career Technology" },
  { name: "SOCIAL", key: "Social Studies" },
  { name: "COMPUTING", key: "Computing" },
  { name: "RME", key: "Religious and Moral Education" },
  { name: "GH. LANG.", key: "Ghanaian Language" },
  { name: "C. ARTS", key: "Creative Arts & Design" }
];

export default function ConsolidatedView({ computedResults, teacherSubjects }) {
  const SUBJECT_HEADERS = teacherSubjects && teacherSubjects.length > 0 
    ? teacherSubjects.map(sub => ({ name: sub.key, key: sub.name }))
    : DEFAULT_JHS_HEADERS;
  const maxScore = (teacherSubjects?.length || 10) * 100;
  const [hoverRow, setHoverRow] = useState(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (computedResults.length === 0) return;
    
    // Build CSV content
    const headers = ["S/N", "Student Name", "Overall Total", "Class Position", ...SUBJECT_HEADERS.map(s => s.name)];
    const csvRows = [headers.join(",")];
    
    computedResults.forEach((s, idx) => {
      const row = [
        s.sn,
        `"${s.name}"`,
        s.overallTotal,
        s.overallRank,
        ...SUBJECT_HEADERS.map(sh => s.subjects[sh.key]?.total || 0)
      ];
      csvRows.push(row.join(","));
    });
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "class_positions_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort computedResults by rank for display on the Positions overview
  const rankedResults = [...computedResults].sort((a, b) => {
    const aRank = parseInt(a.overallRank, 10) || 999;
    const bRank = parseInt(b.overallRank, 10) || 999;
    return aRank - bRank;
  });

  return (
    <div className="space-y-4">
      {/* Consolidated Overview Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 no-print">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              POSITIONS — Class Overview
            </h3>
            <p className="text-[10px] text-zinc-400">
              Sorted by overall ranking. Displays totals out of {maxScore} and subject breakdowns.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={rankedResults.length === 0}
              className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 transition-colors flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Page
            </button>
            <button
              onClick={handleExportCSV}
              disabled={rankedResults.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse gradebook-table">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10 text-center">
              <tr>
                <th className="px-3 py-3 w-12 text-center">Pos</th>
                <th className="px-3 py-3 text-left min-w-[180px]">Student Name</th>
                <th className="px-3 py-3 w-24">Overall Total<br/>({maxScore})</th>
                {SUBJECT_HEADERS.map(sub => (
                  <th key={sub.key} className="px-2 py-3 w-20 font-mono text-[10px]">{sub.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {rankedResults.map((row, idx) => {
                const isSelected = hoverRow === row.sn;
                const subjectCount = teacherSubjects?.length || 10;
                const overallAvg = row.overallTotal / subjectCount;
                
                // Styling ranks
                const rankNum = idx + 1;
                const isPodium = rankNum <= 3;
                const podiumClass = rankNum === 1 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' :
                                    rankNum === 2 ? 'bg-zinc-400/10 text-zinc-600 dark:text-zinc-300 font-bold' :
                                    rankNum === 3 ? 'bg-amber-700/10 text-amber-800 dark:text-amber-600 font-bold' : '';

                return (
                  <tr
                    key={row.sn}
                    onMouseEnter={() => setHoverRow(row.sn)}
                    onMouseLeave={() => setHoverRow(null)}
                    className={`transition-colors text-center ${
                      isSelected 
                        ? 'bg-blue-50/40 dark:bg-blue-900/20' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <td className={`px-3 py-2 text-center font-mono font-medium ${podiumClass}`}>
                      {row.overallRank}
                    </td>
                    <td className="px-3 py-2 text-left font-semibold truncate max-w-[180px]" title={row.name}>
                      {row.name}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {row.overallTotal}
                      <span className="text-[10px] text-zinc-400 font-normal block">
                        ({overallAvg.toFixed(1)}%)
                      </span>
                    </td>
                    
                    {/* Subject breakdowns */}
                    {SUBJECT_HEADERS.map(sh => {
                      const subRes = row.subjects[sh.key] || { total: 0, grade: 'E' };
                      return (
                        <td key={sh.key} className="px-2 py-2 font-mono text-zinc-600 dark:text-zinc-400">
                          {subRes.total}
                          <span className={`text-[10px] font-bold ml-1 ${
                            subRes.grade === 'HP' ? 'text-emerald-500' :
                            subRes.grade === 'P' ? 'text-blue-500' :
                            subRes.grade === 'AP' ? 'text-yellow-500' :
                            subRes.grade === 'D' ? 'text-orange-500' : 'text-zinc-400'
                          }`}>
                            {subRes.grade}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rankedResults.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-zinc-400">
                    No results available. Set up students and input grades first.
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
