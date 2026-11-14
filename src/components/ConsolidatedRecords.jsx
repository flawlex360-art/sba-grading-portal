import React, { useState } from 'react';
import { Search, Filter, FileSpreadsheet } from 'lucide-react';
import { calculateStudentSubjectScores } from '../utils/calculations';
import {
  SCHOOL_LEVELS,
  JHS_SUBJECTS_LIST,
  KG_PROFICIENCY_SCALE,
  getDefaultSubjectsListForLevel,
  getKgProficiencyMeta,
  normalizeKgRatingCode,
  resolveSchoolLevel,
} from '../constants/curriculum';

const DEFAULT_JHS_KEYS = JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC');

export default function ConsolidatedRecords({ students, gradesStore, teacherSubjects, viewingTerm, metadata = {} }) {
  const schoolLevel = resolveSchoolLevel(metadata?.classLevel, metadata?.level);
  const isKgMode =
    schoolLevel === SCHOOL_LEVELS.KG ||
    Object.values(gradesStore || {}).some((areaMap) =>
      Object.values(areaMap || {}).some((entry) => entry?.mode === 'kg')
    );

  const SUBJECT_KEYS =
    teacherSubjects && teacherSubjects.length > 0
      ? teacherSubjects
      : schoolLevel === SCHOOL_LEVELS.JHS
        ? DEFAULT_JHS_KEYS
        : getDefaultSubjectsListForLevel(schoolLevel);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');

  // Build a flat list of all subject / learning area records
  const flatRecords = [];

  if (isKgMode) {
    SUBJECT_KEYS.forEach((sub) => {
      const subGrades = gradesStore?.[sub.key] || {};
      students.forEach((s) => {
        const entry = subGrades[s.sn] || {};
        const rating = normalizeKgRatingCode(entry.rating || entry.grade);
        const ratingMeta = getKgProficiencyMeta(rating);
        const indicatorsCount = entry.indicators
          ? Object.values(entry.indicators).filter((code) => Boolean(normalizeKgRatingCode(code))).length
          : 0;

        flatRecords.push({
          isKg: true,
          subjectName: sub.name,
          subjectKey: sub.key,
          sn: s.sn,
          name: s.name,
          rating: rating || '—',
          ratingLabel: ratingMeta.label,
          tone: ratingMeta.tone,
          indicatorsCount,
          note: entry.note || '',
          grade: rating || 'UNASSESSED',
        });
      });
    });
  } else {
    SUBJECT_KEYS.forEach(sub => {
      const subGrades = gradesStore?.[sub.key] || {};

      // Sort students by score to compute ranking within the subject
      const subjectTotals = students.map(s => {
        const sg = subGrades[s.sn] || { gw1: 0, test: 0, gw2: 0, proj: 0, exams: 0 };
        const scores = calculateStudentSubjectScores(sg.gw1, sg.test, sg.gw2, sg.proj, sg.exams);
        return { sn: s.sn, name: s.name, overallTotal: scores.overallTotal, scores, sg };
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

      subjectTotals.forEach(({ sn, name, scores, sg }) => {
        flatRecords.push({
          isKg: false,
          subjectName: sub.name,
          subjectKey: sub.key,
          sn,
          name,
          gw1: sg.gw1 || 0,
          test: sg.test || 0,
          gw2: sg.gw2 || 0,
          proj: sg.proj || 0,
          sbaTotal: Math.round(scores.sbaTotal * 10) / 10,
          scaledSba: Math.round(scores.scaledSba * 10) / 10,
          exams: sg.exams || 0,
          scaledExam: Math.round(scores.scaledExam * 10) / 10,
          overallTotal: Math.round(scores.overallTotal * 10) / 10,
          grade: scores.grade,
          rank: ranks[sn]
        });
      });
    });
  }

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
            placeholder={isKgMode ? "Search by learner or learning area..." : "Search by student name or subject..."}
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
            <option value="ALL">{isKgMode ? 'All Learning Areas' : 'All Subjects'}</option>
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
            {isKgMode ? (
              <>
                <option value="ALL">All Proficiency Ratings</option>
                {KG_PROFICIENCY_SCALE.map(tier => (
                  <option key={tier.code} value={tier.code}>{tier.code} ({tier.label})</option>
                ))}
                <option value="UNASSESSED">Not Assessed Yet</option>
              </>
            ) : (
              <>
                <option value="ALL">All Grades</option>
                <option value="1">1 (Highest)</option>
                <option value="2">2 (Higher)</option>
                <option value="3">3 (High)</option>
                <option value="4">4 (High Average)</option>
                <option value="5">5 (Average)</option>
                <option value="6">6 (Low Average)</option>
                <option value="7">7 (Low)</option>
                <option value="8">8 (Lower)</option>
                <option value="9">9 (Lowest)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
              {isKgMode ? 'OPEN — Learning Area Observation Records' : 'OPEN — Consolidated Subject Records'}
            </h3>
            <p className="text-[10px] text-zinc-400">
              {isKgMode
                ? 'A complete learner-by-area view of NaCCA proficiency ratings and teacher observations.'
                : 'A complete vertical stack of all subject scores.'}
            </p>
          </div>
          <span className="text-xs text-zinc-400 no-print">
            Showing {filteredRecords.length} of {flatRecords.length} records
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          {isKgMode ? (
            <table className="w-full text-left text-xs border-collapse gradebook-table">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">S/N</th>
                  <th className="px-3 py-2.5 w-44">Learning Area</th>
                  <th className="px-3 py-2.5 min-w-[160px]">Learner Name</th>
                  <th className="px-3 py-2.5 w-40 text-center">Proficiency</th>
                  <th className="px-3 py-2.5 w-28 text-center">Milestones</th>
                  <th className="px-3 py-2.5 min-w-[220px]">Teacher Observation Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {filteredRecords.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-3 py-2.5 text-center font-mono text-zinc-400">{row.sn}</td>
                    <td className="px-3 py-2.5 font-semibold text-zinc-500 dark:text-zinc-400">{row.subjectName}</td>
                    <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{row.name}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        row.rating === 'IND' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        row.rating === 'DEV' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                        row.rating === 'EMG' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        row.rating === 'NYS' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                      }`}>
                        {row.rating !== '—' ? `${row.rating} • ${row.ratingLabel}` : 'Pending'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-zinc-500">{row.indicatorsCount} rated</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{row.note || <span className="text-zinc-400 italic">—</span>}</td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                      No matching observation records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse gradebook-table">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10 text-center">
                <tr>
                  <th className="px-3 py-2.5 w-12">S/N</th>
                  <th className="px-3 py-2.5 text-left w-36">Subject</th>
                  <th className="px-3 py-2.5 text-left min-w-[150px]">Student Name</th>
                  <th className="px-2 py-2.5 w-16">Test 1 (20)</th>
                  <th className="px-2 py-2.5 w-16">GW (30)</th>
                  <th className="px-2 py-2.5 w-16">Test 2 (20)</th>
                  <th className="px-2 py-2.5 w-16">Proj (30)</th>
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
                        ['1', '2', '3'].includes(row.grade) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        ['4', '5'].includes(row.grade) ? 'bg-blue-500/10 text-blue-500' :
                        row.grade === '6' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                        ['7', '8'].includes(row.grade) ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'
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
          )}
        </div>
      </div>
    </div>
  );
}
