import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell
} from 'recharts';

// Helper to calculate subject averages
const calculateSubjectAverages = (computedResults, teacherSubjects) => {
  if (!computedResults || computedResults.length === 0) return [];

  const subjectTotals = {};
  const subjectCounts = {};

  teacherSubjects.forEach(sub => {
    subjectTotals[sub.name] = 0;
    subjectCounts[sub.name] = 0;
  });

  computedResults.forEach(student => {
    teacherSubjects.forEach(sub => {
      const res = student.subjects[sub.name];
      if (res && typeof res.total === 'number') {
        subjectTotals[sub.name] += res.total;
        subjectCounts[sub.name] += 1;
      }
    });
  });

  return teacherSubjects.map(sub => {
    const total = subjectTotals[sub.name] || 0;
    const count = subjectCounts[sub.name] || 1;
    return {
      subject: sub.key || sub.name.substring(0, 8),
      fullSubject: sub.name,
      average: Number((total / count).toFixed(1))
    };
  });
};

// Helper to calculate grade distribution across all subjects
const calculateGradeDistribution = (computedResults, teacherSubjects) => {
  if (!computedResults || computedResults.length === 0) return [];

  const gradeCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0 };

  computedResults.forEach(student => {
    teacherSubjects.forEach(sub => {
      const res = student.subjects[sub.name];
      if (res && res.grade) {
        if (gradeCounts[res.grade] !== undefined) {
          gradeCounts[res.grade]++;
        }
      }
    });
  });

  return Object.keys(gradeCounts).map(grade => ({
    grade: `Grade ${grade}`,
    count: gradeCounts[grade]
  }));
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b'];

export function GradeDistributionChart({ computedResults, teacherSubjects }) {
  const data = useMemo(() => calculateGradeDistribution(computedResults, teacherSubjects), [computedResults, teacherSubjects]);

  if (data.every(d => d.count === 0)) {
    return <div className="flex items-center justify-center h-full text-zinc-400 text-xs font-semibold">No grades recorded yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
        <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
        <RechartsTooltip 
          cursor={{ fill: '#3f3f46', opacity: 0.05 }}
          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ color: '#38bdf8' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubjectPerformanceChart({ computedResults, teacherSubjects }) {
  const data = useMemo(() => calculateSubjectAverages(computedResults, teacherSubjects), [computedResults, teacherSubjects]);

  if (data.every(d => d.average === 0)) {
    return <div className="flex items-center justify-center h-full text-zinc-400 text-xs font-semibold">No scores recorded yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#3f3f46" opacity={0.3} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 9, fontWeight: 'bold' }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#a1a1aa' }} />
        <Radar name="Class Average" dataKey="average" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
        <RechartsTooltip 
          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ color: '#10b981' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
