import React, { useState } from 'react';
import { Save, School, Calendar, Users, Award, Percent, Check } from 'lucide-react';

export default function Dashboard({ metadata, onSave, students, computedResults }) {
  const [formData, setFormData] = useState({ ...metadata });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'timesOpen' || name === 'rollNumber' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Calculate statistics
  const totalStudents = students.length;
  
  const classAverage = totalStudents > 0 
    ? (computedResults.reduce((acc, s) => acc + s.overallTotal, 0) / totalStudents).toFixed(2)
    : 0;

  const passingStudents = computedResults.filter(s => {
    const avg = s.overallTotal / 10;
    return avg >= 40; 
  }).length;

  const passRate = totalStudents > 0
    ? ((passingStudents / totalStudents) * 100).toFixed(1)
    : 0;

  // Display Number on Roll (uses metadata custom value or falls back to roster count)
  const rollNumberDisplay = formData.rollNumber !== undefined && formData.rollNumber !== 0
    ? formData.rollNumber
    : totalStudents;

  return (
    <div className="space-y-6">
      {/* Sleek KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
            <School className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">District & School</div>
            <div className="text-sm font-semibold tracking-tight truncate max-w-[200px]" title={metadata.schoolName}>
              {metadata.schoolName}
            </div>
            <div className="text-xs text-zinc-400">{metadata.district}</div>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Number on Roll</div>
            <div className="text-2xl font-bold tracking-tight">{rollNumberDisplay}</div>
            <div className="text-xs text-zinc-400">Class: {metadata.classLevel} (Roster: {totalStudents})</div>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Class Average Total</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {classAverage} <span className="text-xs font-normal text-zinc-400">/ 1000</span>
            </div>
            <div className="text-xs text-zinc-400">Avg. per subject: {totalStudents > 0 ? (classAverage / 10).toFixed(1) : 0}%</div>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Pass Rate</div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {passRate}%
            </div>
            <div className="text-xs text-zinc-400">Scoring D (40%) or above</div>
          </div>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="glass-card p-6 max-w-3xl mx-auto border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-bold tracking-tight">Class Metadata & Configuration</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Read-Only Admin Controls */}
          <div className="bg-zinc-100/50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 space-y-4">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-1.5 mb-2">
              Admin Provisioned Settings (Read-Only)
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">SCHOOL NAME</label>
                <input
                  type="text"
                  disabled
                  value={formData.schoolName}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">DISTRICT</label>
                <input
                  type="text"
                  disabled
                  value={formData.district}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">CLASS LEVEL</label>
                <input
                  type="text"
                  disabled
                  value={formData.classLevel}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">TERM</label>
                <input
                  type="text"
                  disabled
                  value={formData.term}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">ACADEMIC YEAR</label>
                <input
                  type="text"
                  disabled
                  value={formData.academicYear}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-medium"
                />
              </div>
            </div>
          </div>

          {/* Editable Teacher Controls */}
          <div className="space-y-4 pt-2">
            <div className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-1.5 mb-2">
              Class Administration (Editable by Teacher)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">TEACHER'S NAME</label>
                <input
                  type="text"
                  name="teacherName"
                  value={formData.teacherName || ''}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  required
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">NUMBER ON ROLL</label>
                <input
                  type="number"
                  name="rollNumber"
                  value={formData.rollNumber !== undefined ? formData.rollNumber : totalStudents}
                  onChange={handleChange}
                  min={0}
                  required
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">TOTAL SCHOOL DAYS OPEN</label>
                <input
                  type="number"
                  name="timesOpen"
                  value={formData.timesOpen}
                  onChange={handleChange}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">DATE</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">NEXT TERM BEGINS</label>
                <input
                  type="date"
                  name="nextTermBegins"
                  value={formData.nextTermBegins}
                  onChange={handleChange}
                  required
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="submit"
              disabled={isSaving || saveSuccess}
              className={`text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
                saveSuccess 
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-emerald-ink hover:bg-emerald-900'
              } disabled:opacity-50`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save Settings"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
