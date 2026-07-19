import React, { useState, useEffect, useRef } from 'react';
import { Save, FileSpreadsheet } from 'lucide-react';
import { calculateGrade, getOrdinalSuffix } from '../utils/calculations';

const DEFAULT_JHS_TABS = [
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

export default function Gradebook({ students, gradesStore, onSave, teacherSubjects }) {
  const SUBJECT_TABS = teacherSubjects && teacherSubjects.length > 0 ? teacherSubjects : DEFAULT_JHS_TABS;
  const [activeTab, setActiveTab] = useState(SUBJECT_TABS[0]);
  const [localGrades, setLocalGrades] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  // Ensure activeTab matches any updates in teacherSubjects
  useEffect(() => {
    if (teacherSubjects && teacherSubjects.length > 0) {
      const exists = teacherSubjects.find(t => t.key === activeTab.key);
      if (!exists) {
        setActiveTab(teacherSubjects[0]);
      }
    }
  }, [teacherSubjects]);

  // Load grades when active subject tab changes or gradesStore changes
  useEffect(() => {
    const currentSubGrades = gradesStore[activeTab.key] || {};
    // Pre-populate grades for all students
    const initialGrades = {};
    students.forEach(s => {
      const g = currentSubGrades[s.sn] || { gw1: '', test: '', gw2: '', proj: '', exams: '' };
      initialGrades[s.sn] = {
        gw1: g.gw1 !== undefined ? g.gw1 : '',
        test: g.test !== undefined ? g.test : '',
        gw2: g.gw2 !== undefined ? g.gw2 : '',
        proj: g.proj !== undefined ? g.proj : '',
        exams: g.exams !== undefined ? g.exams : ''
      };
    });
    setLocalGrades(initialGrades);
  }, [activeTab, gradesStore, students]);

  const handleInputChange = (sn, field, val) => {
    // Parse value within bounds
    let parsedVal = val === '' ? '' : parseFloat(val);
    if (parsedVal !== '' && isNaN(parsedVal)) return;

    // Boundary check
    if (parsedVal !== '') {
      if (field === 'exams' && (parsedVal < 0 || parsedVal > 100)) return;
      if (field !== 'exams' && (parsedVal < 0 || parsedVal > 15)) return;
    }

    setLocalGrades(prev => ({
      ...prev,
      [sn]: {
        ...prev[sn],
        [field]: val // keep raw string in state so user can type decimals/backspace
      }
    }));
  };

  const saveCurrentGrades = async (currentTabKey = activeTab.key, currentGrades = localGrades) => {
    const formattedGrades = {};
    Object.keys(currentGrades).forEach(sn => {
      const g = currentGrades[sn];
      formattedGrades[sn] = {
        gw1: g.gw1 === '' ? 0 : parseFloat(g.gw1),
        test: g.test === '' ? 0 : parseFloat(g.test),
        gw2: g.gw2 === '' ? 0 : parseFloat(g.gw2),
        proj: g.proj === '' ? 0 : parseFloat(g.proj),
        exams: g.exams === '' ? 0 : parseFloat(g.exams)
      };
    });
    await onSave(currentTabKey, formattedGrades);
  };

  const handleTabSwitch = (tab) => {
    if (tab.key === activeTab.key) return;
    setActiveTab(tab);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveCurrentGrades(activeTab.key, localGrades);
    setIsSaving(false);
  };

  const handleBlur = () => {
    saveCurrentGrades(activeTab.key, localGrades);
  };

  // Perform client-side calculations for real-time presentation
  const calculatedRows = students.map(s => {
    const g = localGrades[s.sn] || { gw1: '', test: '', gw2: '', proj: '', exams: '' };
    
    const gw1 = parseFloat(g.gw1) || 0;
    const test = parseFloat(g.test) || 0;
    const gw2 = parseFloat(g.gw2) || 0;
    const proj = parseFloat(g.proj) || 0;
    const exams = parseFloat(g.exams) || 0;

    const sbaTotal = gw1 + test + gw2 + proj;
    const scaledSba = (sbaTotal / 60) * 50;
    const scaledExam = exams * 0.5;
    const overallTotal = scaledSba + scaledExam;
    
    return {
      sn: s.sn,
      name: s.name,
      gw1: g.gw1,
      test: g.test,
      gw2: g.gw2,
      proj: g.proj,
      exams: g.exams,
      sbaTotal,
      scaledSba,
      scaledExam,
      overallTotal
    };
  });

  // Calculate ranks in real-time
  const sortedByScore = [...calculatedRows].sort((a, b) => b.overallTotal - a.overallTotal);
  const ranksMap = {};
  sortedByScore.forEach((item, idx) => {
    if (idx > 0 && item.overallTotal === sortedByScore[idx - 1].overallTotal) {
      ranksMap[item.sn] = ranksMap[sortedByScore[idx - 1].sn];
    } else {
      ranksMap[item.sn] = idx + 1;
    }
  });

  return (
    <div className="space-y-4">
      {/* Excel Sheet Tabs at the top */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 overflow-x-auto select-none no-print">
        <FileSpreadsheet className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 overflow-hidden">
          {SUBJECT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabSwitch(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all truncate max-w-[130px] ${
                activeTab.key === tab.key
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grade Table Card */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Gradebook — {activeTab.name}
            </h3>
            <p className="text-[10px] text-zinc-400">
              Calculations update in real time. Hover / click fields to input scores.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || students.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse gradebook-table">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10 text-center">
              <tr>
                <th className="px-3 py-2 w-12 text-center" rowSpan={2}>S/N</th>
                <th className="px-3 py-2 text-left min-w-[200px]" rowSpan={2}>NAMES OF LEARNERS</th>
                <th className="px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-800" colSpan={4}>SCHOOL BASED ASSESSMENT (SBA)</th>
                <th className="px-3 py-2 w-20" rowSpan={2}>SBA TOTAL<br/>(60)</th>
                <th className="px-3 py-2 w-20" rowSpan={2}>SBA SCALED<br/>(50)</th>
                <th className="px-3 py-2 w-20" rowSpan={2}>EXAMS<br/>(100)</th>
                <th className="px-3 py-2 w-20" rowSpan={2}>EXAM SCALED<br/>(50)</th>
                <th className="px-3 py-2 w-20" rowSpan={2}>OVERALL TOTAL<br/>(100)</th>
                <th className="px-3 py-2 w-16" rowSpan={2}>GRADE</th>
                <th className="px-3 py-2 w-16" rowSpan={2}>POSITION</th>
                <th className="px-3 py-2 min-w-[120px] text-left" rowSpan={2}>REMARKS</th>
              </tr>
              <tr className="bg-zinc-50 dark:bg-zinc-900/60 text-[10px]">
                <th className="px-2 py-1 w-16 border-r border-zinc-200 dark:border-zinc-800">GW 1 (15)</th>
                <th className="px-2 py-1 w-16 border-r border-zinc-200 dark:border-zinc-800">TEST (15)</th>
                <th className="px-2 py-1 w-16 border-r border-zinc-200 dark:border-zinc-800">GW 2 (15)</th>
                <th className="px-2 py-1 w-16">PROJ (15)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {calculatedRows.map((row) => {
                const { grade, remark } = calculateGrade(row.overallTotal);
                const rank = ranksMap[row.sn];
                const isSelected = activeRow === row.sn;

                return (
                  <tr
                    key={row.sn}
                    onMouseEnter={() => setActiveRow(row.sn)}
                    onMouseLeave={() => setActiveRow(null)}
                    className={`transition-colors text-center ${
                      isSelected 
                        ? 'bg-blue-50/40 dark:bg-blue-900/20' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <td className="px-3 py-2 text-center font-mono font-medium text-zinc-500">
                      {row.sn}
                    </td>
                    <td className="px-3 py-2 text-left font-semibold min-w-[150px]" title={row.name}>
                      {row.name}
                    </td>
                    <td className="px-1 py-1 border-r border-zinc-100 dark:border-zinc-800/30">
                      <input
                        type="text"
                        value={row.gw1}
                        onChange={(e) => handleInputChange(row.sn, 'gw1', e.target.value)}
                        onBlur={handleBlur}
                        className="w-12 text-center bg-transparent border-0 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 rounded p-1 font-mono"
                      />
                    </td>
                    <td className="px-1 py-1 border-r border-zinc-100 dark:border-zinc-800/30">
                      <input
                        type="text"
                        value={row.test}
                        onChange={(e) => handleInputChange(row.sn, 'test', e.target.value)}
                        onBlur={handleBlur}
                        className="w-12 text-center bg-transparent border-0 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 rounded p-1 font-mono"
                      />
                    </td>
                    <td className="px-1 py-1 border-r border-zinc-100 dark:border-zinc-800/30">
                      <input
                        type="text"
                        value={row.gw2}
                        onChange={(e) => handleInputChange(row.sn, 'gw2', e.target.value)}
                        onBlur={handleBlur}
                        className="w-12 text-center bg-transparent border-0 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 rounded p-1 font-mono"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={row.proj}
                        onChange={(e) => handleInputChange(row.sn, 'proj', e.target.value)}
                        onBlur={handleBlur}
                        className="w-12 text-center bg-transparent border-0 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 rounded p-1 font-mono"
                      />
                    </td>
                    
                    {/* Computed cells */}
                    <td className="px-3 py-2 font-mono text-zinc-500 font-medium">
                      {Math.round(row.sbaTotal * 10) / 10}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">
                      {Math.round(row.scaledSba * 10) / 10}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={row.exams}
                        onChange={(e) => handleInputChange(row.sn, 'exams', e.target.value)}
                        onBlur={handleBlur}
                        className="w-14 text-center bg-transparent border-0 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 rounded p-1 font-mono font-semibold"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">
                      {Math.round(row.scaledExam * 10) / 10}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {Math.round(row.overallTotal * 10) / 10}
                    </td>
                    <td className={`px-3 py-2 font-bold ${
                      grade === 'HP' ? 'text-emerald-600 dark:text-emerald-400' :
                      grade === 'P' ? 'text-blue-500' :
                      grade === 'AP' ? 'text-yellow-600 dark:text-yellow-400' :
                      grade === 'D' ? 'text-orange-500' : 'text-rose-500'
                    }`}>
                      {grade}
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-zinc-500">
                      {getOrdinalSuffix(rank)}
                    </td>
                    <td className="px-3 py-2 text-left font-medium text-zinc-500 truncate max-w-[150px]" title={remark}>
                      {remark}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-zinc-400">
                    Roster is empty. Set up students on the Student Roster tab first.
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
