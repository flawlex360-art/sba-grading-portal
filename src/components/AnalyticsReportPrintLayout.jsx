import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { GradeDistributionChart, SubjectPerformanceChart } from './AnalyticsCharts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { computeClassResults } from '../utils/calculations';
import {
  SCHOOL_LEVELS,
  DEFAULT_KG_SUBJECT_MAP,
  DEFAULT_PRIMARY_SUBJECT_MAP,
  DEFAULT_JHS_SUBJECT_MAP,
  resolveSchoolLevel,
} from '../constants/curriculum';

export default function AnalyticsReportPrintLayout({ data }) {
  const { metadata, computedResults, termData, aiSummary, teacherSubjects } = data;
  const schoolLevel = resolveSchoolLevel(metadata?.classLevel, metadata?.level);
  const isKgMode = schoolLevel === SCHOOL_LEVELS.KG || computedResults.some(s => s?.isKgResult);

  const subjectCount = teacherSubjects?.length || (isKgMode ? 4 : 9);
  const totalStudents = computedResults.length;

  const classAverage = useMemo(() => {
    if (totalStudents === 0) return 0;
    if (isKgMode) {
      const assessed = computedResults.filter(s => typeof s.readinessScore === 'number');
      if (assessed.length === 0) return 0;
      return (assessed.reduce((sum, s) => sum + s.readinessScore, 0) / assessed.length).toFixed(1);
    }
    const totalScore = computedResults.reduce((sum, student) => sum + (student.overallTotal || 0), 0);
    return (totalScore / (totalStudents * subjectCount)).toFixed(2);
  }, [computedResults, totalStudents, subjectCount, isKgMode]);

  const passingStudents = useMemo(() => {
    if (isKgMode) {
      return computedResults.filter(
        s => (s.masteryCounts?.IND || 0) + (s.masteryCounts?.DEV || 0) > 0 && (s.masteryCounts?.NYS || 0) === 0
      ).length;
    }
    return computedResults.filter(s => {
      const avg = s.overallTotal / subjectCount;
      return avg >= 40;
    }).length;
  }, [computedResults, subjectCount, isKgMode]);

  const passRate = totalStudents > 0
    ? ((passingStudents / totalStudents) * 100).toFixed(1)
    : 0;

  // Compute terms history for Line Chart
  const historicalOverallChartData = useMemo(() => {
    if (!termData) return [];
    const terms = Object.keys(termData).sort();
    return terms.map(term => {
      const termSpecificData = termData[term];
      if (!termSpecificData) return { term, Average: 0 };

      const termStudents = termSpecificData.students || [];
      const termGrades = termSpecificData.grades || {};

      let defaultSubjects = {};
      if (Array.isArray(teacherSubjects) && teacherSubjects.length > 0) {
        teacherSubjects.forEach(s => { defaultSubjects[s.name] = s.key; });
      } else {
        defaultSubjects =
          schoolLevel === SCHOOL_LEVELS.KG
            ? DEFAULT_KG_SUBJECT_MAP
            : schoolLevel === SCHOOL_LEVELS.JHS
              ? DEFAULT_JHS_SUBJECT_MAP
              : DEFAULT_PRIMARY_SUBJECT_MAP;
      }

      const computed = computeClassResults(termStudents, termGrades, Object.keys(defaultSubjects), defaultSubjects, {
        level: schoolLevel,
        classLevel: metadata?.classLevel || '',
      });

      let averageScore = 0;
      if (computed.length > 0) {
        if (isKgMode) {
          const assessed = computed.filter(s => typeof s.readinessScore === 'number');
          averageScore = assessed.length > 0
            ? assessed.reduce((sum, s) => sum + s.readinessScore, 0) / assessed.length
            : 0;
        } else {
          const total = computed.reduce((sum, s) => sum + (s.overallTotal || 0), 0);
          const sCount = Object.keys(computed[0].subjects || {}).length || 9;
          averageScore = total / (computed.length * (sCount > 0 ? sCount : 1));
        }
      }

      return {
        term,
        Average: parseFloat(averageScore.toFixed(2))
      };
    });
  }, [termData, metadata, teacherSubjects, schoolLevel, isKgMode]);

  const topStudents = isKgMode ? [] : [...computedResults].sort((a, b) => b.overallTotal - a.overallTotal).slice(0, 5);
  const bottomStudents = isKgMode ? [] : [...computedResults].sort((a, b) => a.overallTotal - b.overallTotal).slice(0, 5);

  return (
    <div className="bg-white text-black min-h-screen font-sans w-full p-8" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact', margin: 0, padding: 0 }}>
      {/* Page 1: Cover & Summary */}
      <div className="print-page p-10">
        <div className="text-center mb-12 border-b-2 border-black pb-6">
          <h1 className="text-3xl font-black uppercase tracking-wider mb-2">{metadata.schoolName || 'School Name'}</h1>
          <h2 className="text-xl font-bold text-gray-700 uppercase">{metadata.district || 'District'}</h2>
          <div className="mt-4 flex justify-center gap-8 text-sm font-semibold">
            <span>CLASS: {metadata.classLevel || 'N/A'}</span>
            <span>TERM: {metadata.term || 'N/A'}</span>
            <span>ACADEMIC YEAR: {metadata.academicYear || 'N/A'}</span>
          </div>
        </div>

        <div className="mb-12 text-center bg-gray-100 p-6 rounded-lg border border-gray-300">
          <h2 className="text-2xl font-bold mb-4">
            {isKgMode ? 'Kindergarten Developmental Mastery Report' : 'Class Performance Analytics Report'}
          </h2>
          <div className="flex justify-center gap-12 text-lg">
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 uppercase tracking-widest">{isKgMode ? 'Mastery Index' : 'Class Average'}</span>
              <span className="font-bold text-green-700">{classAverage}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 uppercase tracking-widest">{isKgMode ? 'On-Track Mastery' : 'Pass Rate'}</span>
              <span className="font-bold text-blue-700">{passRate}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 uppercase tracking-widest">Enrolment</span>
              <span className="font-bold">{totalStudents}</span>
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-black">
          {aiSummary ? (
            <ReactMarkdown>{aiSummary}</ReactMarkdown>
          ) : (
            <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <p>AI Narrative Summary not generated.</p>
              <p className="text-sm">Please generate the AI summary on the dashboard before exporting.</p>
            </div>
          )}
        </div>
      </div>

      {/* Page 2: Visual Dashboards */}
      <div className="print-page p-10">
        <h2 className="text-2xl font-bold mb-8 pb-2 border-b border-gray-300">Visual Diagnostics</h2>
        
        <div className="mb-12">
          <h3 className="text-lg font-bold mb-4">{isKgMode ? 'Proficiency Rating Distribution' : 'Grade Distribution'}</h3>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50 h-[350px]">
             <GradeDistributionChart computedResults={computedResults} teacherSubjects={teacherSubjects} metadata={metadata} />
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-lg font-bold mb-4">{isKgMode ? 'Learning Area Mastery Analysis' : 'Subject Performance Analysis'}</h3>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50 h-[350px] flex justify-center">
             <SubjectPerformanceChart computedResults={computedResults} teacherSubjects={teacherSubjects} metadata={metadata} />
          </div>
        </div>
      </div>

      {/* Page 3: Trends & Roster */}
      <div className="print-page p-10">
        <h2 className="text-2xl font-bold mb-8 pb-2 border-b border-gray-300">Progress & Roster</h2>
        
        <div className="mb-12">
          <h3 className="text-lg font-bold mb-4">{isKgMode ? 'Historical Term Trajectory (Mastery Index)' : 'Historical Term Trajectory (Class Average)'}</h3>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50 h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalOverallChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="term" tick={{fill: 'black'}} />
                  <YAxis domain={[0, 100]} tick={{fill: 'black'}} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Average" stroke="#10b981" strokeWidth={3} dot={{r: 5}} />
                </LineChart>
             </ResponsiveContainer>
          </div>
        </div>

        {isKgMode ? (
          <div className="mb-16">
            <h3 className="text-lg font-bold mb-4 text-emerald-700">Kindergarten Learner Mastery Summary</h3>
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">S/N</th>
                  <th className="border border-gray-300 p-2 text-left">Learner Name</th>
                  <th className="border border-gray-300 p-2 text-left">Learning Area Ratings</th>
                  <th className="border border-gray-300 p-2 text-right">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {computedResults.map((s) => (
                  <tr key={s.sn}>
                    <td className="border border-gray-300 p-2">{s.sn}</td>
                    <td className="border border-gray-300 p-2 font-semibold">{s.name}</td>
                    <td className="border border-gray-300 p-2 text-xs">
                      {Object.entries(s.subjects || {}).map(([areaName, info]) => `${areaName}: ${info.rating || '—'}`).join(' • ')}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-bold">{s.readinessStatus || 'In Progress'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-8 mb-16">
          <div>
            <h3 className="text-lg font-bold mb-4 text-green-700">Top 5 Students</h3>
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Pos</th>
                  <th className="border border-gray-300 p-2 text-left">Name</th>
                  <th className="border border-gray-300 p-2 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {topStudents.map((s, i) => (
                  <tr key={s.sn}>
                    <td className="border border-gray-300 p-2 font-bold">{i + 1}</td>
                    <td className="border border-gray-300 p-2 truncate">{s.name}</td>
                    <td className="border border-gray-300 p-2 text-right">{(s.overallTotal / subjectCount).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-red-700">Bottom 5 Students</h3>
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Pos</th>
                  <th className="border border-gray-300 p-2 text-left">Name</th>
                  <th className="border border-gray-300 p-2 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {bottomStudents.map((s, i) => (
                  <tr key={s.sn}>
                    <td className="border border-gray-300 p-2 font-bold">{totalStudents - 4 + i}</td>
                    <td className="border border-gray-300 p-2 truncate">{s.name}</td>
                    <td className="border border-gray-300 p-2 text-right">{(s.overallTotal / subjectCount).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Signatures */}
        <div className="mt-32 pt-16 flex justify-between px-12">
          <div className="text-center w-64">
            <div className="border-b border-black mb-2 h-16"></div>
            <div className="font-bold uppercase tracking-widest text-sm">Class Teacher</div>
            <div className="text-xs text-gray-500 mt-1">Signature & Date</div>
          </div>
          
          <div className="text-center w-64">
            <div className="border-b border-black mb-2 h-16"></div>
            <div className="font-bold uppercase tracking-widest text-sm">Headmaster</div>
            <div className="text-xs text-gray-500 mt-1">Signature, Date & Stamp</div>
          </div>
        </div>

      </div>
    </div>
  );
}
