import React, { useState, useMemo } from 'react';
import { Award, Download, Printer, TrendingUp, Users, CheckCircle, AlertTriangle, BarChart2, Sparkles, Loader2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GradeDistributionChart, SubjectPerformanceChart } from './AnalyticsCharts';
import { generateClassSummary } from '../utils/aiSummary';
import {
  SCHOOL_LEVELS,
  JHS_SUBJECTS_LIST,
  getDefaultSubjectsListForLevel,
  resolveSchoolLevel,
} from '../constants/curriculum';

const DEFAULT_JHS_HEADERS = JHS_SUBJECTS_LIST
  .filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC')
  .map(s => ({ name: s.key, key: s.name }));

export default function ConsolidatedView({ computedResults, teacherSubjects, onPrintAnalytics, metadata }) {
  const schoolLevel = resolveSchoolLevel(metadata?.classLevel, metadata?.level);
  const isKgMode = schoolLevel === SCHOOL_LEVELS.KG || computedResults.some(s => s?.isKgResult);

  const SUBJECT_HEADERS = teacherSubjects && teacherSubjects.length > 0 
    ? teacherSubjects.map(sub => ({ name: sub.key, key: sub.name }))
    : schoolLevel === SCHOOL_LEVELS.JHS
      ? DEFAULT_JHS_HEADERS
      : getDefaultSubjectsListForLevel(schoolLevel).map(sub => ({ name: sub.key, key: sub.name }));
  const subjectDenominator = SUBJECT_HEADERS.length || (isKgMode ? 4 : 9);
  const maxScore = subjectDenominator * 100;
  const [hoverRow, setHoverRow] = useState(null);
  const [filter, setFilter] = useState('all'); // Primary/JHS: all|top5|bottom5|atRisk|boys|girls; KG: all|ind|dev|support|boys|girls
  const [aiSummary, setAiSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      const summary = await generateClassSummary(analytics, rankedResults, apiKey, metadata);
      setAiSummary(summary);
    } catch (error) {
      console.error("Error generating summary:", error);
      alert(error.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handlePrintSummary = () => {
    const printContent = document.getElementById('ai-summary-content');
    if (!printContent) return;
    
    const WindowPrt = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
    WindowPrt.document.write(`
      <html>
        <head>
          <title>Class Performance Review</title>
          <style>
            body { font-family: system-ui, sans-serif; line-height: 1.6; color: #18181b; padding: 2rem; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 24px; border-bottom: 2px solid #e4e4e7; padding-bottom: 8px; }
            h3 { font-size: 18px; color: #111; margin-top: 24px; margin-bottom: 12px; }
            p { margin-bottom: 16px; font-size: 14px; }
            ul { margin-bottom: 16px; padding-left: 24px; }
            li { margin-bottom: 4px; font-size: 14px; }
            strong { font-weight: 600; color: #000; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Class Performance Review</h1>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    WindowPrt.document.close();
    WindowPrt.focus();
    setTimeout(() => {
      WindowPrt.print();
      WindowPrt.close();
    }, 250);
  };

  const handleExportCSV = () => {
    if (computedResults.length === 0) return;

    const headers = isKgMode
      ? ["S/N", "Learner Name", "Readiness Status", "Mastery Index (%)", ...SUBJECT_HEADERS.map(s => s.key)]
      : ["S/N", "Student Name", "Overall Total", "Class Position", ...SUBJECT_HEADERS.map(s => s.key)];
    const csvRows = [headers.join(",")];

    rankedResults.forEach((s) => {
      const row = isKgMode
        ? [
            s.sn,
            `"${s.name}"`,
            `"${s.readinessStatus || 'In Progress'}"`,
            s.readinessScore ?? '',
            ...SUBJECT_HEADERS.map(sh => s.subjects?.[sh.key]?.rating || '')
          ]
        : [
            s.sn,
            `"${s.name}"`,
            s.overallTotal,
            s.overallRank,
            ...SUBJECT_HEADERS.map(sh => s.subjects?.[sh.key]?.total || 0)
          ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", isKgMode ? "kg_developmental_overview.csv" : "class_positions_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort and filter computedResults (KG keeps alphabetical/natural order — no ranking)
  const isMaleGender = (g) => {
    const u = String(g || '').trim().toUpperCase();
    return u === 'M' || u === 'MALE' || u === 'BOY';
  };
  const isFemaleGender = (g) => {
    const u = String(g || '').trim().toUpperCase();
    return u === 'F' || u === 'FEMALE' || u === 'GIRL';
  };

  const rankedResults = useMemo(() => {
    let base = [...computedResults];
    if (isKgMode) {
      base.sort((a, b) => (a.sn || 0) - (b.sn || 0));
      if (filter === 'ind') return base.filter(s => (s.masteryCounts?.IND || 0) > 0 && (s.masteryCounts?.NYS || 0) === 0);
      if (filter === 'dev') return base.filter(s => (s.masteryCounts?.DEV || 0) > 0);
      if (filter === 'support') return base.filter(s => (s.masteryCounts?.NYS || 0) > 0 || (s.masteryCounts?.EMG || 0) > 0);
      if (filter === 'boys') return base.filter(s => isMaleGender(s.gender));
      if (filter === 'girls') return base.filter(s => isFemaleGender(s.gender));
      return base;
    }

    base.sort((a, b) => {
      const aRank = parseInt(a.overallRank, 10) || 999;
      const bRank = parseInt(b.overallRank, 10) || 999;
      return aRank - bRank;
    });

    const subjectCount = SUBJECT_HEADERS.length || 9;

    if (filter === 'top5') return base.slice(0, 5);
    if (filter === 'bottom5') return base.slice(-5);
    if (filter === 'atRisk') return base.filter(s => (s.overallTotal / subjectCount) < 40); // Less than 40%
    if (filter === 'boys') return base.filter(s => isMaleGender(s.gender));
    if (filter === 'girls') return base.filter(s => isFemaleGender(s.gender));
    return base;
  }, [computedResults, filter, isKgMode, SUBJECT_HEADERS.length]);

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!computedResults || computedResults.length === 0) return null;

    const totalStudents = computedResults.length;
    const activeSubHeaders = SUBJECT_HEADERS;
    const subjectCount = activeSubHeaders.length || (isKgMode ? 4 : 9);

    let sumAverages = 0;
    let avgDenominator = 0;
    let passCount = 0;
    let boyTotal = 0, boyCount = 0;
    let girlTotal = 0, girlCount = 0;

    const subjectTotals = {};
    const subjectCounts = {};
    activeSubHeaders.forEach(sub => {
      subjectTotals[sub.key] = 0;
      subjectCounts[sub.key] = 0;
    });

    computedResults.forEach(student => {
      let studentAvg = null;
      if (isKgMode) {
        if (typeof student.readinessScore === 'number') {
          studentAvg = student.readinessScore;
          sumAverages += studentAvg;
          avgDenominator += 1;
        }
        if ((student.masteryCounts?.IND || 0) + (student.masteryCounts?.DEV || 0) > 0 && (student.masteryCounts?.NYS || 0) === 0) {
          passCount++;
        }
      } else {
        studentAvg = (student.overallTotal || 0) / subjectCount;
        sumAverages += studentAvg;
        avgDenominator += 1;
        if (studentAvg >= 50) passCount++;
      }

      if (studentAvg !== null) {
        if (isMaleGender(student.gender)) { boyTotal += studentAvg; boyCount++; }
        if (isFemaleGender(student.gender)) { girlTotal += studentAvg; girlCount++; }
      }

      activeSubHeaders.forEach(sub => {
        const res = student.subjects?.[sub.key];
        if (res && typeof res.total === 'number' && (!isKgMode || res.rating)) {
          subjectTotals[sub.key] += res.total;
          subjectCounts[sub.key] += 1;
        }
      });
    });

    let bestSubject = { name: '-', avg: 0 };
    let worstSubject = { name: '-', avg: 100 };
    let foundAny = false;

    activeSubHeaders.forEach(sub => {
      const cnt = subjectCounts[sub.key];
      const avg = cnt > 0 ? subjectTotals[sub.key] / cnt : 0;
      if (cnt > 0) foundAny = true;
      if (avg >= bestSubject.avg && cnt > 0) bestSubject = { name: sub.name || sub.key.substring(0, 8), avg };
      if (avg <= worstSubject.avg && cnt > 0) worstSubject = { name: sub.name || sub.key.substring(0, 8), avg };
    });

    if (!foundAny) {
      worstSubject = { name: '-', avg: 0 };
    }

    return {
      classAverage: avgDenominator > 0 ? (sumAverages / avgDenominator).toFixed(1) : '0.0',
      passRate: ((passCount / totalStudents) * 100).toFixed(1),
      boyAvg: boyCount > 0 ? (boyTotal / boyCount).toFixed(1) : '-',
      girlAvg: girlCount > 0 ? (girlTotal / girlCount).toFixed(1) : '-',
      bestSubject,
      worstSubject,
      totalStudents
    };
  }, [computedResults, SUBJECT_HEADERS, isKgMode]);

  return (
    <div className="space-y-6">
      
      {/* 1. KPIs Row */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
          <div className="glass-card p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{isKgMode ? 'Mastery Index' : 'Class Average'}</span>
            </div>
            <div className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{analytics.classAverage}%</div>
          </div>
          <div className="glass-card p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{isKgMode ? 'On-Track Mastery' : 'Pass Rate'}</span>
            </div>
            <div className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{analytics.passRate}%</div>
          </div>
          <div className="glass-card p-4 flex flex-col justify-center border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
              <Award className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{isKgMode ? 'Strongest Area' : 'Top Subject'}</span>
            </div>
            <div className="text-xl font-bold text-zinc-800 dark:text-zinc-100 truncate" title={analytics.bestSubject.name}>{analytics.bestSubject.name}</div>
            <div className="text-xs text-zinc-400 font-semibold">{analytics.bestSubject.avg.toFixed(1)}% {isKgMode ? 'mastery' : 'avg'}</div>
          </div>
          <div className="glass-card p-4 flex flex-col justify-center border-l-4 border-rose-500">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{isKgMode ? 'Focus Area' : 'Lowest Subject'}</span>
            </div>
            <div className="text-xl font-bold text-zinc-800 dark:text-zinc-100 truncate" title={analytics.worstSubject.name}>{analytics.worstSubject.name}</div>
            <div className="text-xs text-zinc-400 font-semibold">{analytics.worstSubject.avg.toFixed(1)}% {isKgMode ? 'mastery' : 'avg'}</div>
          </div>
        </div>
      )}

      {/* 1.5 Demographic KPIs */}
      {analytics && (analytics.boyAvg !== '-' || analytics.girlAvg !== '-') && (
        <div className="grid grid-cols-2 gap-4 no-print">
          <div className="glass-card p-3 flex items-center justify-between border-l-4 border-blue-500">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{isKgMode ? 'Boys Mastery' : 'Boys Average'}</span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400">{analytics.boyAvg}%</span>
          </div>
          <div className="glass-card p-3 flex items-center justify-between border-l-4 border-pink-500">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{isKgMode ? 'Girls Mastery' : 'Girls Average'}</span>
            <span className="text-lg font-black text-pink-600 dark:text-pink-400">{analytics.girlAvg}%</span>
          </div>
        </div>
      )}
      
      {/* 1.6 AI Narrative Summary */}
      {aiSummary && (
        <div className="glass-card border border-indigo-200 dark:border-indigo-900 overflow-hidden relative no-print animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg shadow-indigo-500/10">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 px-6 py-4 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-100">Diagnostic Performance Review</h3>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrintSummary}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1.5 rounded-md"
              >
                <FileText className="w-3.5 h-3.5" />
                Print Report
              </button>
              <button 
                onClick={() => setAiSummary('')}
                className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <div id="ai-summary-content" className="text-sm text-zinc-700 dark:text-zinc-300 space-y-4 leading-relaxed">
              <ReactMarkdown
                components={{
                  h3: ({node, ...props}) => <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2" {...props} />,
                  p: ({node, ...props}) => <p className="mb-4" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 marker:text-indigo-400" {...props} />,
                  li: ({node, ...props}) => <li {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-zinc-900 dark:text-zinc-100" {...props} />
                }}
              >
                {aiSummary}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* 2. Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        {/* Grade / Proficiency Distribution */}
        <div className="glass-card p-4 flex flex-col h-[300px]">
          <div className="flex items-center gap-2 mb-4 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              {isKgMode ? 'Proficiency Rating Distribution' : 'Grade Distribution'}
            </h3>
          </div>
          <div className="flex-1 w-full">
            <GradeDistributionChart computedResults={computedResults} teacherSubjects={teacherSubjects} metadata={metadata} />
          </div>
        </div>
        
        {/* Subject Performance */}
        <div className="glass-card p-4 flex flex-col h-[300px]">
          <div className="flex items-center gap-2 mb-4 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <Award className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              {isKgMode ? 'Learning Area Mastery Overview' : 'Subject Performance Overview'}
            </h3>
          </div>
          <div className="flex-1 w-full">
            <SubjectPerformanceChart computedResults={computedResults} teacherSubjects={teacherSubjects} />
          </div>
        </div>
      </div>

      {/* Consolidated Overview Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 border-b border-zinc-200 dark:border-zinc-800 no-print">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              {isKgMode ? 'EARLY CHILDHOOD OVERVIEW — Developmental Mastery' : 'POSITIONS — Class Overview'}
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              {isKgMode
                ? 'NaCCA Kindergarten proficiency across the 4 Core Learning Areas (IND = Independently, DEV = Developing, EMG = Emerging, NYS = Not Yet).'
                : `Sorted by overall ranking. Displays totals out of ${maxScore} and subject breakdowns.`}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <button onClick={() => setFilter('all')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>All</button>
              {isKgMode ? (
                <>
                  <button onClick={() => setFilter('ind')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'ind' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Consistent (IND)</button>
                  <button onClick={() => setFilter('dev')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'dev' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Developing (DEV)</button>
                  <button onClick={() => setFilter('support')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'support' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Needs Support</button>
                </>
              ) : (
                <>
                  <button onClick={() => setFilter('top5')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'top5' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Top 5</button>
                  <button onClick={() => setFilter('bottom5')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'bottom5' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Bottom 5</button>
                  <button onClick={() => setFilter('atRisk')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'atRisk' ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>At-Risk</button>
                </>
              )}
              <button onClick={() => setFilter('boys')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'boys' ? 'bg-blue-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Boys</button>
              <button onClick={() => setFilter('girls')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === 'girls' ? 'bg-pink-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Girls</button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary || rankedResults.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {isGeneratingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isGeneratingSummary ? 'Generating...' : 'AI Summary'}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={rankedResults.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => onPrintAnalytics(aiSummary)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF Report
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Page
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse gradebook-table">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10 text-center">
              <tr>
                <th className="px-3 py-3 w-12 text-center">{isKgMode ? 'S/N' : 'Pos'}</th>
                <th className="px-3 py-3 text-left min-w-[180px]">{isKgMode ? 'Learner Name' : 'Student Name'}</th>
                <th className="px-2 py-3 w-16 text-center">Gender</th>
                <th className="px-3 py-3 w-28">
                  {isKgMode ? 'Readiness' : (<>Overall Total<br/>({maxScore})</>)}
                </th>
                {SUBJECT_HEADERS.map(sub => (
                  <th key={sub.key} className="px-2 py-3 w-24 font-mono text-[10px]">{sub.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {rankedResults.map((row, idx) => {
                const isSelected = hoverRow === row.sn;
                const overallAvg = (row.overallTotal || 0) / subjectDenominator;

                const rankNum = idx + 1;
                const podiumClass = isKgMode
                  ? 'text-zinc-400'
                  : rankNum === 1 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                  : rankNum === 2 ? 'bg-zinc-400/10 text-zinc-600 dark:text-zinc-300 font-bold'
                  : rankNum === 3 ? 'bg-amber-700/10 text-amber-800 dark:text-amber-600 font-bold'
                  : '';

                const gUpper = String(row.gender || '').trim().toUpperCase();
                const genderShort = gUpper === 'M' || gUpper === 'MALE' || gUpper === 'BOY' ? 'M'
                  : gUpper === 'F' || gUpper === 'FEMALE' || gUpper === 'GIRL' ? 'F'
                  : '-';

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
                      {isKgMode ? row.sn : row.overallRank}
                    </td>
                    <td className="px-3 py-2 text-left font-semibold truncate max-w-[180px]" title={row.name}>
                      {row.name}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        genderShort === 'M' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        genderShort === 'F' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                        'text-zinc-400'
                      }`}>
                        {genderShort}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {isKgMode ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {row.readinessScore !== null && row.readinessScore !== undefined ? `${row.readinessScore}%` : '—'}
                          </span>
                          <span className="text-[9px] font-sans font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                            {row.readinessStatus || 'Pending'}
                          </span>
                        </div>
                      ) : (
                        <>
                          {row.overallTotal}
                          <span className="text-[10px] text-zinc-400 font-normal block">
                            ({overallAvg.toFixed(1)}%)
                          </span>
                        </>
                      )}
                    </td>
                    
                    {/* Subject / Learning Area breakdowns */}
                    {SUBJECT_HEADERS.map(sh => {
                      const subRes = row.subjects?.[sh.key] || { total: 0, grade: 'E', rating: '' };
                      if (isKgMode) {
                        const code = subRes.rating || '';
                        const badgeCls =
                          code === 'IND' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/60' :
                          code === 'DEV' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-700/60' :
                          code === 'EMG' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60' :
                          code === 'NYS' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/60 dark:border-rose-700/60' :
                          'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800';
                        return (
                          <td key={sh.key} className="px-2 py-2">
                            <span
                              title={subRes.label || 'Not Assessed'}
                              className={`inline-block px-2 py-0.5 rounded border text-[10px] font-extrabold ${badgeCls}`}
                            >
                              {code || '—'}
                            </span>
                          </td>
                        );
                      }

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
  );
}
