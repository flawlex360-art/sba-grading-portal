import React, { useState, useEffect } from 'react';
import { Save, Printer, User, Search, ChevronRight, FileCheck, Check } from 'lucide-react';
import ReportCard from './ReportCard';

export default function ReportEditor({ students, metadata, computedResults, dropLists, onSave, onPrintAll, onPrintSingle, teacherSubjects }) {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local form state
  const [attendance, setAttendance] = useState(0);
  const [conduct, setConduct] = useState('');
  const [interest, setInterest] = useState('');
  const [remarks, setRemarks] = useState('');
  const [promotedTo, setPromotedTo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Set first student as default if none selected
  useEffect(() => {
    if (students.length > 0 && !selectedStudent) {
      handleSelectStudent(students[0]);
    }
  }, [students, selectedStudent]);

  // Load student values into form
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setAttendance(student.attendance || 0);
    setConduct(student.conduct || '');
    setInterest(student.interest || '');
    setRemarks(student.remarks || '');
    setPromotedTo(student.promotedTo || '');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
  };

  const saveFormDirect = async (updatedFields = {}) => {
    if (!selectedStudent) return;
    
    const maxAttendance = metadata.timesOpen || 100;
    
    const attendanceVal = updatedFields.hasOwnProperty('attendance') 
      ? updatedFields.attendance 
      : attendance;
      
    const parsedAttendance = parseInt(attendanceVal, 10) || 0;
    if (parsedAttendance < 0 || parsedAttendance > maxAttendance) {
      // Clamped attendance value silently for frictionless auto-saving
      return;
    }

    const updatedStudent = {
      ...selectedStudent,
      attendance: parsedAttendance,
      conduct: updatedFields.hasOwnProperty('conduct') ? updatedFields.conduct : conduct,
      interest: updatedFields.hasOwnProperty('interest') ? updatedFields.interest : interest,
      remarks: updatedFields.hasOwnProperty('remarks') ? updatedFields.remarks : remarks,
      promotedTo: updatedFields.hasOwnProperty('promotedTo') ? updatedFields.promotedTo : promotedTo
    };
    
    await onSave(updatedStudent);
    setSelectedStudent(updatedStudent);
    
    // Only show success toast if explicitly called (not for auto-saves during typing)
    if (Object.keys(updatedFields).length === 0) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handlePrevStudent = () => {
    if (!selectedStudent) return;
    const curIdx = students.findIndex(s => s.sn === selectedStudent.sn);
    if (curIdx > 0) {
      handleSelectStudent(students[curIdx - 1]);
    }
  };

  const handleNextStudent = () => {
    if (!selectedStudent) return;
    const curIdx = students.findIndex(s => s.sn === selectedStudent.sn);
    if (curIdx < students.length - 1) {
      handleSelectStudent(students[curIdx + 1]);
    }
  };

  const handlePrintSingle = () => {
    if (selectedStudent) {
      onPrintSingle(selectedStudent);
    }
  };

  const handlePrintAll = () => {
    onPrintAll();
  };

  // Filter students based on search query
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Live preview student state
  const previewStudent = selectedStudent ? {
    ...selectedStudent,
    attendance: parseInt(attendance, 10) || 0,
    conduct,
    interest,
    remarks: remarks,
    promotedTo
  } : null;

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar: Print All */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass-card no-print">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Report Card Batch Manager</h2>
          <p className="text-[10px] text-zinc-400">All changes are saved automatically. Batch print all report cards here.</p>
        </div>
        <div>
          <button
            type="button"
            onClick={handlePrintAll}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print All Report Cards
          </button>
        </div>
      </div>
      
      {/* 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 5 Columns: Roster selection & direct editor form */}
        <div className="lg:col-span-5 space-y-4 no-print">
          
          {/* Student Selector Card */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="max-h-[160px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              {filteredStudents.map(s => {
                const isCurrent = selectedStudent && selectedStudent.sn === s.sn;
                return (
                  <button
                    key={s.sn}
                    onClick={() => handleSelectStudent(s)}
                    className={`w-full flex items-center justify-between p-2.5 text-left text-xs font-semibold transition-colors ${
                      isCurrent 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User className={`w-3.5 h-3.5 ${isCurrent ? 'text-blue-500' : 'text-zinc-400'}`} />
                      <span className="truncate">{s.name}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                  </button>
                );
              })}
              {filteredStudents.length === 0 && (
                <div className="text-center py-6 text-zinc-400 text-xs">
                  No students match your search.
                </div>
              )}
            </div>
          </div>

          {/* Direct Input Card */}
          {selectedStudent && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
                <FileCheck className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-sm font-bold" title={selectedStudent.name}>
                    Edit Report: {selectedStudent.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400">S/N: {selectedStudent.sn}</p>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">
                    ATTENDANCE (DAYS PRESENT — Max: {metadata.timesOpen || 100})
                  </label>
                  <input
                    type="number"
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    onBlur={(e) => saveFormDirect({ attendance: e.target.value })}
                    min={0}
                    max={metadata.timesOpen || 100}
                    required
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">CONDUCT REMARKS</label>
                  <select
                    value={conduct}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConduct(val);
                      saveFormDirect({ conduct: val });
                    }}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Select Conduct --</option>
                    {dropLists.conduct.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={conduct}
                    onChange={(e) => setConduct(e.target.value)}
                    onBlur={(e) => saveFormDirect({ conduct: e.target.value })}
                    placeholder="Or type custom conduct..."
                    className="w-full mt-1.5 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">STUDENT INTEREST ACTIVITIES</label>
                  <select
                    value={interest}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInterest(val);
                      saveFormDirect({ interest: val });
                    }}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Select Interest --</option>
                    {dropLists.interest.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    onBlur={(e) => saveFormDirect({ interest: e.target.value })}
                    placeholder="Or type custom interest..."
                    className="w-full mt-1.5 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">CLASS TEACHER'S REMARKS</label>
                  <select
                    value={remarks}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRemarks(val);
                      saveFormDirect({ remarks: val });
                    }}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Select Remarks --</option>
                    {dropLists.remarks.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    onBlur={(e) => saveFormDirect({ remarks: e.target.value })}
                    placeholder="Or type custom remarks..."
                    className="w-full mt-1.5 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">PROMOTED TO (IF APPLICABLE)</label>
                  <select
                    value={promotedTo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPromotedTo(val);
                      saveFormDirect({ promotedTo: val });
                    }}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- None --</option>
                    {Array.from(new Set(["BS. 1", "BS. 2", "BS. 3", "BS. 4", "BS. 5", "BS. 6", "BS. 7", "BS. 8", "BS. 9", ...(dropLists.classes || [])])).map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => saveFormDirect()}
                    disabled={saveSuccess}
                    className={`flex-1 text-white rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                      saveSuccess
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-emerald-ink hover:bg-emerald-900'
                    } disabled:opacity-50`}
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Report
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintSingle}
                    className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg px-3 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-2 select-none">
                  <button
                    type="button"
                    onClick={handlePrevStudent}
                    disabled={students.findIndex(s => s.sn === selectedStudent.sn) <= 0}
                    className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 transition-colors flex items-center gap-1"
                  >
                    ← Prev Student
                  </button>
                  <span className="text-[10px] text-zinc-400 font-bold font-mono">
                    {students.findIndex(s => s.sn === selectedStudent.sn) + 1} / {students.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextStudent}
                    disabled={students.findIndex(s => s.sn === selectedStudent.sn) >= students.length - 1}
                    className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 transition-colors flex items-center gap-1"
                  >
                    Next Student →
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right 7 Columns: Live HTML Report Card Preview (which becomes print output) */}
        <div className="lg:col-span-7 flex flex-col justify-start no-print">
          {previewStudent ? (
            <ReportCard
              student={previewStudent}
              metadata={metadata}
              calculatedScores={computedResults}
              teacherSubjects={teacherSubjects}
            />
          ) : (
            <div className="glass-card p-12 text-center text-zinc-400 no-print">
              Select a student to edit and preview report card.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
