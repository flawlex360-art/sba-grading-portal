import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BookOpen, Users, User } from 'lucide-react';
import { computeClassResults } from '../utils/calculations';

export default function TrendAnalysis({
  termData,
  students,
  metadata,
  teacherSubjects,
  allocatedSubjects = null,
  isSubjectTeacherMode = false
}) {
  // Determine if a Class Teacher (Form Master) has a specific subset of allocated subjects in their home class
  const hasOwnSubjectArea = useMemo(() => {
    if (!Array.isArray(allocatedSubjects) || allocatedSubjects.length === 0) return false;
    if (isSubjectTeacherMode) return true;
    const totalCount = Array.isArray(teacherSubjects) ? teacherSubjects.length : 0;
    return totalCount > 0 && allocatedSubjects.length < totalCount;
  }, [allocatedSubjects, teacherSubjects, isSubjectTeacherMode]);

  const mySubjectNames = useMemo(() => {
    if (!Array.isArray(allocatedSubjects)) return [];
    return allocatedSubjects.map(s => s.name).filter(Boolean);
  }, [allocatedSubjects]);

  const [selectedStudent, setSelectedStudent] = useState('class');
  // 'overall' | 'my_subjects' | 'subjects'
  const [viewMode, setViewMode] = useState(
    isSubjectTeacherMode ? 'subjects' : (hasOwnSubjectArea ? 'my_subjects' : 'overall')
  );
  const [selectedSubject, setSelectedSubject] = useState('all');

  useEffect(() => {
    if (isSubjectTeacherMode) {
      setViewMode('subjects');
      if (mySubjectNames.length === 1) {
        setSelectedSubject(mySubjectNames[0]);
      } else {
        setSelectedSubject('all');
      }
    }
  }, [isSubjectTeacherMode, mySubjectNames]);

  // Extract chronological terms
  const terms = useMemo(() => {
    return Object.keys(termData || {}).sort();
  }, [termData]);

  // Compute results for ALL terms
  const historicalResults = useMemo(() => {
    const results = {};
    terms.forEach(term => {
      const termSpecificData = termData[term];
      if (!termSpecificData) return;

      const termStudents = termSpecificData.students || [];
      const termGrades = termSpecificData.grades || {};

      // Default subjects mapping for calculations
      let subjectMap = {};
      let subjectsList = [];

      if (teacherSubjects && Array.isArray(teacherSubjects) && teacherSubjects.length > 0) {
        teacherSubjects.forEach(sub => {
          subjectMap[sub.name] = sub.key;
          subjectsList.push(sub.name);
        });
      } else {
        subjectMap = metadata?.classLevel?.startsWith('BS. 7') || metadata?.classLevel?.startsWith('BS. 8') || metadata?.classLevel?.startsWith('BS. 9')
          ? { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "Career Technology": "C. TECH", "Social Studies": "SOCIAL", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts & Design": "C. ARTS" }
          : { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "History": "HISTORYY", "Our World Our People": "OWOP", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts": "C. ARTS" };
        subjectsList = Object.keys(subjectMap);
      }

      const computed = computeClassResults(termStudents, termGrades, subjectsList, subjectMap);
      results[term] = computed;
    });
    return results;
  }, [termData, terms, metadata, teacherSubjects]);

  // All available subject names across terms / teacherSubjects
  const allSubjectNames = useMemo(() => {
    const set = new Set();
    if (Array.isArray(teacherSubjects)) {
      teacherSubjects.forEach(s => {
        if (s?.name) set.add(s.name);
      });
    }
    terms.forEach(term => {
      const results = historicalResults[term] || [];
      if (results.length > 0) {
        Object.keys(results[0].subjects || {}).forEach(sub => set.add(sub));
      }
    });
    return Array.from(set);
  }, [teacherSubjects, terms, historicalResults]);

  // Active subjects to plot when in 'my_subjects' or 'subjects' mode
  const activeSubjectsForView = useMemo(() => {
    if (viewMode === 'my_subjects' && mySubjectNames.length > 0) {
      if (selectedSubject !== 'all' && mySubjectNames.includes(selectedSubject)) {
        return [selectedSubject];
      }
      return mySubjectNames;
    }
    if (selectedSubject !== 'all' && allSubjectNames.includes(selectedSubject)) {
      return [selectedSubject];
    }
    return allSubjectNames;
  }, [viewMode, mySubjectNames, selectedSubject, allSubjectNames]);

  // Extract graph data for Overall Average (or scoped Subject Area Average)
  const overallChartData = useMemo(() => {
    const scopedSubjects =
      viewMode === 'overall' && !isSubjectTeacherMode
        ? allSubjectNames
        : activeSubjectsForView;

    return terms.map(term => {
      const resultsForTerm = historicalResults[term] || [];
      if (resultsForTerm.length === 0) {
        return { term, Average: 0 };
      }

      const targetSubjects = scopedSubjects.length > 0 ? scopedSubjects : Object.keys(resultsForTerm[0].subjects || {});
      const subCount = targetSubjects.length > 0 ? targetSubjects.length : 1;

      let averageScore = 0;
      if (selectedStudent === 'class') {
        const sumAcrossStudents = resultsForTerm.reduce((acc, studentRes) => {
          const studentSubSum = targetSubjects.reduce((sAcc, subName) => {
            return sAcc + (studentRes.subjects?.[subName]?.total || 0);
          }, 0);
          return acc + studentSubSum / subCount;
        }, 0);
        averageScore = sumAcrossStudents / resultsForTerm.length;
      } else {
        const studentResult = resultsForTerm.find(s => (s.sn || s.id || '').toString() === selectedStudent);
        if (studentResult) {
          const studentSubSum = targetSubjects.reduce((sAcc, subName) => {
            return sAcc + (studentResult.subjects?.[subName]?.total || 0);
          }, 0);
          averageScore = studentSubSum / subCount;
        }
      }

      return {
        term,
        Average: parseFloat(averageScore.toFixed(2))
      };
    });
  }, [terms, historicalResults, selectedStudent, viewMode, isSubjectTeacherMode, allSubjectNames, activeSubjectsForView]);

  // Extract graph data for Subject-by-Subject
  const subjectChartData = useMemo(() => {
    const data = [];
    terms.forEach(term => {
      const results = historicalResults[term] || [];
      const termObj = { term };

      activeSubjectsForView.forEach(sub => {
        let value = 0;
        if (results.length === 0) {
          termObj[sub] = 0;
          return;
        }

        if (selectedStudent === 'class') {
          const totalSub = results.reduce((sum, s) => {
            const sData = s.subjects?.[sub];
            return sum + (sData ? sData.total : 0);
          }, 0);
          value = totalSub / results.length;
        } else {
          const studentResult = results.find(s => (s.sn || s.id || '').toString() === selectedStudent);
          if (studentResult && studentResult.subjects?.[sub]) {
            value = studentResult.subjects[sub].total;
          }
        }
        termObj[sub] = parseFloat(value.toFixed(2));
      });
      data.push(termObj);
    });

    return { data, subjects: activeSubjectsForView };
  }, [terms, historicalResults, selectedStudent, activeSubjectsForView]);

  // Compute Growth Metrics (dynamically scoped to the active subject area or overall class)
  const growthMetrics = useMemo(() => {
    if (terms.length < 2) return null;

    const lastTerm = overallChartData[overallChartData.length - 1];
    const prevTerm = overallChartData[overallChartData.length - 2];

    if (!lastTerm || !prevTerm) return null;

    const diff = lastTerm.Average - prevTerm.Average;
    const isPositive = diff > 0;
    const isNeutral = diff === 0;

    let highestAvg = 0;
    let highestTerm = '';
    overallChartData.forEach(d => {
      if (d.Average >= highestAvg) {
        highestAvg = d.Average;
        highestTerm = d.term;
      }
    });

    const scopeLabel =
      viewMode === 'overall' && !isSubjectTeacherMode
        ? 'Overall Class'
        : activeSubjectsForView.length === 1
          ? activeSubjectsForView[0]
          : viewMode === 'my_subjects' || isSubjectTeacherMode
            ? `My Subject Area (${activeSubjectsForView.length})`
            : `Selected Subjects (${activeSubjectsForView.length})`;

    return {
      currentAvg: lastTerm.Average,
      prevAvg: prevTerm.Average,
      diff: parseFloat(diff.toFixed(2)),
      isPositive,
      isNeutral,
      highestAvg,
      highestTerm,
      scopeLabel
    };
  }, [overallChartData, terms, viewMode, isSubjectTeacherMode, activeSubjectsForView]);

  // Colors for subject lines
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1', '#f97316'];

  // Dropdown options for subject filter depending on viewMode
  const subjectFilterOptions = viewMode === 'my_subjects' && mySubjectNames.length > 0 ? mySubjectNames : allSubjectNames;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">Progress & Trends</h2>
            {(isSubjectTeacherMode || viewMode === 'my_subjects' || selectedSubject !== 'all') && (
              <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                {selectedSubject !== 'all'
                  ? selectedSubject
                  : mySubjectNames.join(', ') || 'Subject Area'}
              </span>
            )}
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            {isSubjectTeacherMode
              ? `Visualize term-over-term performance in your assigned subject area (${mySubjectNames.join(', ')}).`
              : 'Visualize term-over-term performance trajectories across the class or in your specific subject area.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          {!isSubjectTeacherMode && (
            <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
              <button
                onClick={() => {
                  setViewMode('overall');
                  setSelectedSubject('all');
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'overall'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
              >
                Overall Average
              </button>
              {hasOwnSubjectArea && (
                <button
                  onClick={() => {
                    setViewMode('my_subjects');
                    setSelectedSubject(mySubjectNames.length === 1 ? mySubjectNames[0] : 'all');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'my_subjects'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                  }`}
                >
                  My Subject Area ({mySubjectNames.length})
                </button>
              )}
              <button
                onClick={() => {
                  setViewMode('subjects');
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'subjects'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
              >
                By Subject
              </button>
            </div>
          )}

          {/* Subject Area Filter Dropdown (Allows Class Teachers & Subject Teachers to focus on a specific subject) */}
          {(viewMode !== 'overall' || isSubjectTeacherMode) && subjectFilterOptions.length > 1 && (
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl pl-9 pr-8 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">
                  {viewMode === 'my_subjects' || isSubjectTeacherMode
                    ? `All My Subjects (${subjectFilterOptions.length})`
                    : `All Subjects (${subjectFilterOptions.length})`}
                </option>
                {subjectFilterOptions.map(subName => (
                  <option key={subName} value={subName}>
                    {subName}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 pointer-events-none">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Quick Subject Selector even from Overall tab so any Class Teacher can jump straight to a subject */}
          {!isSubjectTeacherMode && viewMode === 'overall' && allSubjectNames.length > 0 && (
            <div className="relative">
              <select
                value="all"
                onChange={(e) => {
                  if (e.target.value !== 'all') {
                    setViewMode('subjects');
                    setSelectedSubject(e.target.value);
                  }
                }}
                className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl pl-9 pr-8 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">Filter by Subject Area...</option>
                {allSubjectNames.map(subName => (
                  <option key={subName} value={subName}>
                    {subName}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 pointer-events-none">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Student Selector */}
          <div className="relative">
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl pl-10 pr-10 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="class">Entire Class Average</option>
              {students.map(s => (
                <option key={s.sn || s.id || s.name} value={(s.sn || s.id || '').toString()}>{s.name}</option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
              {selectedStudent === 'class' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </div>

      {terms.length === 0 ? (
        <div className="glass-card p-12 text-center text-zinc-500">
          No historical data available. Ensure terms are properly set up.
        </div>
      ) : (
        <>
          {/* Growth Metrics Row */}
          {growthMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                  Recent Term Average ({growthMetrics.scopeLabel})
                </div>
                <div className="text-2xl font-bold tracking-tight">{growthMetrics.currentAvg.toFixed(2)}%</div>
                <div className="text-xs text-zinc-400 mt-1">For {terms[terms.length - 1]}</div>
              </div>

              <div className="glass-card p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                  Term-over-Term Change ({growthMetrics.scopeLabel})
                </div>
                <div className={`flex items-end gap-2 ${growthMetrics.isPositive ? 'text-emerald-500' : growthMetrics.isNeutral ? 'text-zinc-500' : 'text-rose-500'}`}>
                  <div className="text-2xl font-bold tracking-tight">
                    {growthMetrics.isPositive ? '+' : ''}{growthMetrics.diff}%
                  </div>
                  <div className="mb-1 text-sm font-medium">
                    {growthMetrics.isPositive ? <TrendingUp className="w-5 h-5" /> : growthMetrics.isNeutral ? <Minus className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                </div>
                <div className="text-xs text-zinc-400 mt-1">Compared to {terms[terms.length - 2]}</div>
              </div>

              <div className="glass-card p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                  Highest Historical Average ({growthMetrics.scopeLabel})
                </div>
                <div className="text-2xl font-bold tracking-tight text-blue-500">{growthMetrics.highestAvg.toFixed(2)}%</div>
                <div className="text-xs text-zinc-400 mt-1">Achieved in {growthMetrics.highestTerm || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Main Chart Area */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-6">
              {viewMode === 'overall' && !isSubjectTeacherMode
                ? 'Overall Average Trajectory'
                : activeSubjectsForView.length === 1
                  ? `${activeSubjectsForView[0]} — Performance Trajectory`
                  : 'Subject Performance Trajectory'}
            </h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={viewMode === 'overall' && !isSubjectTeacherMode ? overallChartData : subjectChartData.data}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="term"
                    tick={{ fill: '#888888', fontSize: 12 }}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#888888', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(24, 24, 27, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />

                  {viewMode === 'overall' && !isSubjectTeacherMode ? (
                    <Line
                      type="monotone"
                      name="Overall Average (%)"
                      dataKey="Average"
                      stroke="#10b981"
                      strokeWidth={4}
                      dot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#10b981' }}
                      animationDuration={1500}
                    />
                  ) : (
                    subjectChartData.subjects.map((sub, idx) => (
                      <Line
                        key={sub}
                        type="monotone"
                        name={sub}
                        dataKey={sub}
                        stroke={colors[idx % colors.length]}
                        strokeWidth={subjectChartData.subjects.length === 1 ? 4 : 2.5}
                        dot={{ r: subjectChartData.subjects.length === 1 ? 6 : 4, strokeWidth: 1.5, fill: '#fff' }}
                        activeDot={{ r: 7, strokeWidth: 0 }}
                      />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Area Term-over-Term Summary Table */}
          {subjectChartData.subjects.length > 0 && (
            <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">
                Subject Area Term-by-Term Progress Breakdown
              </h3>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      <th className="p-3 font-bold">Subject Area</th>
                      {terms.map(t => (
                        <th key={t} className="p-3 text-center font-bold">{t}</th>
                      ))}
                      {terms.length >= 2 && (
                        <th className="p-3 text-center font-bold">Recent Change</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                    {(viewMode === 'overall' && !isSubjectTeacherMode ? allSubjectNames : subjectChartData.subjects).map(sub => {
                      const termScores = terms.map(t => {
                        const row = subjectChartData.data.find(d => d.term === t);
                        if (row && typeof row[sub] === 'number') return row[sub];
                        // Compute if not in activeSubjectsForView
                        const results = historicalResults[t] || [];
                        if (results.length === 0) return 0;
                        if (selectedStudent === 'class') {
                          const totalSub = results.reduce((sum, s) => sum + (s.subjects?.[sub]?.total || 0), 0);
                          return parseFloat((totalSub / results.length).toFixed(2));
                        }
                        const st = results.find(s => (s.sn || s.id || '').toString() === selectedStudent);
                        return parseFloat((st?.subjects?.[sub]?.total || 0).toFixed(2));
                      });
                      const lastVal = termScores[termScores.length - 1] || 0;
                      const prevVal = termScores.length >= 2 ? (termScores[termScores.length - 2] || 0) : 0;
                      const delta = parseFloat((lastVal - prevVal).toFixed(2));
                      const isMySub = mySubjectNames.includes(sub);

                      return (
                        <tr
                          key={sub}
                          onClick={() => {
                            if (!isSubjectTeacherMode && viewMode === 'overall') {
                              setViewMode('subjects');
                            }
                            setSelectedSubject(selectedSubject === sub ? 'all' : sub);
                          }}
                          className={`cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                            selectedSubject === sub ? 'bg-emerald-50/60 dark:bg-emerald-950/25' : ''
                          }`}
                        >
                          <td className="p-3 font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span>{sub}</span>
                            {isMySub && (
                              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">
                                My Subject
                              </span>
                            )}
                          </td>
                          {termScores.map((score, i) => (
                            <td key={terms[i]} className="p-3 text-center font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                              {score > 0 ? `${score.toFixed(1)}%` : '—'}
                            </td>
                          ))}
                          {terms.length >= 2 && (
                            <td className="p-3 text-center font-mono font-bold">
                              <span className={delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400'}>
                                {delta > 0 ? `+${delta.toFixed(1)}%` : delta < 0 ? `${delta.toFixed(1)}%` : '0.0%'}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
