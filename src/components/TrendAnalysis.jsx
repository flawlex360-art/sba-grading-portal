import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BookOpen, Users, User } from 'lucide-react';
import { computeClassResults } from '../utils/calculations';

export default function TrendAnalysis({ termData, students, metadata, teacherSubjects }) {
  const [selectedStudent, setSelectedStudent] = useState('class');
  const [viewMode, setViewMode] = useState('overall'); // 'overall' or 'subjects'

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
        subjectMap = metadata.classLevel?.startsWith('BS. 7') || metadata.classLevel?.startsWith('BS. 8') || metadata.classLevel?.startsWith('BS. 9')
          ? { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "Career Technology": "C. TECH", "Social Studies": "SOCIAL", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts & Design": "C. ARTS" }
          : { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "History": "HISTORYY", "Our World Our People": "OWOP", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts": "C. ARTS" };
        subjectsList = Object.keys(subjectMap);
      }

      const computed = computeClassResults(termStudents, termGrades, subjectsList, subjectMap);
      results[term] = computed;
    });
    return results;
  }, [termData, terms, metadata, teacherSubjects]);

  // Extract graph data for Overall Average
  const overallChartData = useMemo(() => {
    return terms.map(term => {
      const resultsForTerm = historicalResults[term] || [];
      let termValue = 0;
      
      if (resultsForTerm.length === 0) {
         return { term, Average: 0 };
      }

      if (selectedStudent === 'class') {
        const total = resultsForTerm.reduce((sum, s) => sum + (s.overallTotal || 0), 0);
        termValue = total / resultsForTerm.length;
      } else {
        const studentResult = resultsForTerm.find(s => (s.sn || s.id || '').toString() === selectedStudent);
        termValue = studentResult ? (studentResult.overallTotal || 0) : 0;
      }

      let subjectCount = 0;
      if (selectedStudent === 'class' && resultsForTerm.length > 0) {
         subjectCount = Object.keys(resultsForTerm[0].subjects || {}).length || 9;
      } else {
         const studentResult = resultsForTerm.find(s => ((s.sn || s.id) || '').toString() === selectedStudent);
         subjectCount = studentResult ? Object.keys(studentResult.subjects || {}).length || 9 : 9;
      }

      const averageScore = termValue / (subjectCount > 0 ? subjectCount : 1);
      
      return {
        term,
        Average: parseFloat(averageScore.toFixed(2))
      };
    });
  }, [terms, historicalResults, selectedStudent]);

  // Extract graph data for Subject-by-Subject
  const subjectChartData = useMemo(() => {
    // Collect all unique subjects across all terms
    const allSubjects = new Set();
    terms.forEach(term => {
      const results = historicalResults[term] || [];
      if (results.length > 0) {
         const sample = results[0].subjects || {};
         Object.keys(sample).forEach(sub => allSubjects.add(sub));
      }
    });

    const data = [];
    terms.forEach(term => {
       const results = historicalResults[term] || [];
       const termObj = { term };
       
       Array.from(allSubjects).forEach(sub => {
          let value = 0;
          if (results.length === 0) {
             termObj[sub] = 0;
             return;
          }

          if (selectedStudent === 'class') {
             // compute class average for this subject
             const totalSub = results.reduce((sum, s) => {
                const sData = s.subjects[sub];
                return sum + (sData ? sData.total : 0);
             }, 0);
             value = totalSub / results.length;
          } else {
             const studentResult = results.find(s => (s.sn || s.id || '').toString() === selectedStudent);
             if (studentResult && studentResult.subjects[sub]) {
                value = studentResult.subjects[sub].total;
             }
          }
          termObj[sub] = parseFloat(value.toFixed(2));
       });
       data.push(termObj);
    });

    return { data, subjects: Array.from(allSubjects) };
  }, [terms, historicalResults, selectedStudent]);

  // Compute Growth Metrics
  const growthMetrics = useMemo(() => {
    if (terms.length < 2) return null;
    
    const lastTerm = overallChartData[overallChartData.length - 1];
    const prevTerm = overallChartData[overallChartData.length - 2];
    
    if (!lastTerm || !prevTerm) return null;

    const diff = lastTerm.Average - prevTerm.Average;
    const isPositive = diff > 0;
    const isNeutral = diff === 0;

    let highestAvg = 0;
    let highestTerm = "";
    overallChartData.forEach(d => {
       if (d.Average > highestAvg) {
          highestAvg = d.Average;
          highestTerm = d.term;
       }
    });

    return {
      currentAvg: lastTerm.Average,
      prevAvg: prevTerm.Average,
      diff: parseFloat(diff.toFixed(2)),
      isPositive,
      isNeutral,
      highestAvg,
      highestTerm
    };
  }, [overallChartData, terms]);

  // Colors for subject lines
  const colors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#6366f1", "#f97316"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Progress & Trends</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Visualize term-over-term performance trajectories.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
            <button
              onClick={() => setViewMode('overall')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'overall' 
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              Overall Average
            </button>
            <button
              onClick={() => setViewMode('subjects')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'subjects' 
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              By Subject
            </button>
          </div>

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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
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
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Recent Term Average</div>
                <div className="text-2xl font-bold tracking-tight">{growthMetrics.currentAvg.toFixed(2)}%</div>
                <div className="text-xs text-zinc-400 mt-1">For {terms[terms.length - 1]}</div>
              </div>
              
              <div className="glass-card p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Term-over-Term Change</div>
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
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Highest Historical Average</div>
                <div className="text-2xl font-bold tracking-tight text-blue-500">{growthMetrics.highestAvg.toFixed(2)}%</div>
                <div className="text-xs text-zinc-400 mt-1">Achieved in {growthMetrics.highestTerm}</div>
              </div>
            </div>
          )}

          {/* Main Chart Area */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-6">
              {viewMode === 'overall' ? 'Overall Average Trajectory' : 'Subject Performance Trajectory'}
            </h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={viewMode === 'overall' ? overallChartData : subjectChartData.data} 
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
                  
                  {viewMode === 'overall' ? (
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
                        strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 1, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
