import React, { useState, useEffect, useMemo } from 'react';
import { Save, Printer, User, Search, ChevronRight, FileCheck, Check } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportPaperPreview from './ReportPaperPreview';
import { computeCumulativePromotion, generateParentAdvisory, generateKgParentAdvisory } from '../utils/calculations';
import {
  SCHOOL_LEVELS,
  KG_PROFICIENCY_SCALE,
  KG_SOCIAL_HABITS,
  getDefaultSubjectsListForLevel,
  resolveSchoolLevel,
} from '../constants/curriculum';
import { KG_CONDUCT, KG_INTEREST, KG_REMARKS, KG_CLASSES_DROPLIST } from '../constants/dropList';

export default function ReportEditor({ 
  students, 
  metadata, 
  computedResults, 
  dropLists, 
  onSave, 
  onPrintAll, 
  onPrintSingle, 
  teacherSubjects, 
  viewingTerm, 
  isReadOnly,
  isSubjectTeacherView = false,
  institution,
  termData
}) {
  const schoolLevel = resolveSchoolLevel(metadata?.classLevel, metadata?.level);
  const isKgMode = schoolLevel === SCHOOL_LEVELS.KG || computedResults.some((r) => r?.isKgResult);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local form state
  const [attendance, setAttendance] = useState(0);
  const [conduct, setConduct] = useState('');
  const [interest, setInterest] = useState('');
  const [remarks, setRemarks] = useState('');
  const [promotedTo, setPromotedTo] = useState('');
  const [parentAdvisoryNote, setParentAdvisoryNote] = useState('');
  const [socialHabits, setSocialHabits] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const buildDefaultAdvisory = (stu) => {
    if (!stu) return '';
    const studentResult = computedResults.find(r => r.sn === stu.sn);
    if (isKgMode) {
      const litRating =
        studentResult?.subjects?.['Language & Literacy']?.rating ||
        Object.values(studentResult?.subjects || {})[0]?.rating ||
        '';
      const numRating =
        studentResult?.subjects?.['Numeracy']?.rating ||
        Object.values(studentResult?.subjects || {})[1]?.rating ||
        '';
      return generateKgParentAdvisory(stu.name, litRating, numRating);
    }
    const mathScore = studentResult?.subjects?.['Mathematics']?.total ??
                      studentResult?.subjects?.['Maths']?.total ?? 0;
    const scienceScore = studentResult?.subjects?.['Science']?.total ??
                         studentResult?.subjects?.['Integrated Science']?.total ?? 0;
    return generateParentAdvisory(stu.name, mathScore, scienceScore);
  };

  // Compute cumulative promotion / readiness transition map when viewing Term 3
  const promotionMap = useMemo(() => {
    if (viewingTerm !== 'Term 3' || !termData) return {};
    let activeSubjects = [];
    let subMap = {};
    if (teacherSubjects && teacherSubjects.length > 0) {
      activeSubjects = teacherSubjects.map(s => s.name);
      subMap = teacherSubjects.reduce((acc, sub) => { acc[sub.name] = sub.key || sub.name; return acc; }, {});
    } else {
      const defaults = getDefaultSubjectsListForLevel(schoolLevel);
      activeSubjects = defaults.map(s => s.name);
      subMap = defaults.reduce((acc, sub) => {
        acc[sub.name] = sub.key;
        return acc;
      }, {});
    }
    const list = computeCumulativePromotion(termData, students, activeSubjects, subMap, metadata.classLevel, {
      level: schoolLevel,
    });
    return list.reduce((acc, item) => {
      acc[item.sn] = item;
      return acc;
    }, {});
  }, [termData, students, teacherSubjects, metadata.classLevel, viewingTerm, schoolLevel]);

  // Set first student as default if none selected or if students list changed to another class/term
  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudent(null);
      return;
    }
    const matching = selectedStudent
      ? students.find(s => s.sn === selectedStudent.sn && s.name === selectedStudent.name)
      : null;
    if (!matching) {
      handleSelectStudent(students[0]);
    }
  }, [students]);

  // Load student values into form
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setAttendance(student.attendance || 0);
    setConduct(student.conduct || '');
    setInterest(student.interest || '');
    setRemarks(student.remarks || '');

    // Auto-fill promotion on Term 3 if not already manually set
    if (viewingTerm === 'Term 3') {
      if (student.promotedTo && student.promotedTo.trim() !== '') {
        setPromotedTo(student.promotedTo);
      } else {
        const promo = promotionMap[student.sn];
        setPromotedTo(promo ? promo.autoPromotedTo : '');
      }
    } else {
      setPromotedTo(student.promotedTo || '');
    }

    setSocialHabits(
      student.socialHabits && typeof student.socialHabits === 'object'
        ? { ...student.socialHabits }
        : {}
    );

    // Auto-generate or load Parent Advisory Note
    const defaultAdvisory = buildDefaultAdvisory(student);

    if (student.parentAdvisoryNote !== undefined && student.parentAdvisoryNote !== '') {
      setParentAdvisoryNote(student.parentAdvisoryNote);
    } else {
      setParentAdvisoryNote(defaultAdvisory);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
  };

  const saveFormDirect = async (updatedFields = {}) => {
    if (!selectedStudent) return;
    
    const maxAttendance = metadata.timesOpen || 100;
    
    // Always read attendance from the live local state — this is the source of truth.
    // If caller passes attendance explicitly (e.g. from onBlur), use that instead.
    const attendanceVal = updatedFields.hasOwnProperty('attendance')
      ? updatedFields.attendance
      : attendance;
    
    // Clamp attendance instead of blocking the whole save
    let parsedAttendance = parseInt(attendanceVal, 10);
    if (isNaN(parsedAttendance) || parsedAttendance < 0) parsedAttendance = 0;
    if (parsedAttendance > maxAttendance) parsedAttendance = maxAttendance;

    const updatedStudent = {
      ...selectedStudent,
      attendance: parsedAttendance,
      conduct: updatedFields.hasOwnProperty('conduct') ? updatedFields.conduct : conduct,
      interest: updatedFields.hasOwnProperty('interest') ? updatedFields.interest : interest,
      remarks: updatedFields.hasOwnProperty('remarks') ? updatedFields.remarks : remarks,
      promotedTo: updatedFields.hasOwnProperty('promotedTo') ? updatedFields.promotedTo : promotedTo,
      parentAdvisoryNote: updatedFields.hasOwnProperty('parentAdvisoryNote') ? updatedFields.parentAdvisoryNote : parentAdvisoryNote,
      ...(isKgMode || updatedFields.hasOwnProperty('socialHabits')
        ? { socialHabits: updatedFields.hasOwnProperty('socialHabits') ? updatedFields.socialHabits : socialHabits }
        : {}),
    };
    
    await onSave(updatedStudent);
    setSelectedStudent(prev => prev?.sn === updatedStudent.sn ? updatedStudent : prev);
    // Sync local attendance state so next save also has the clamped value
    setAttendance(parsedAttendance);
    
    // Only show success toast when explicitly triggered (Save button)
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
    promotedTo,
    parentAdvisoryNote,
    ...(isKgMode ? { socialHabits } : {}),
  } : null;

  const effectiveConductList =
    Array.isArray(dropLists?.conduct) && dropLists.conduct.length > 0
      ? dropLists.conduct
      : (isKgMode ? KG_CONDUCT : []);
  const effectiveInterestList =
    Array.isArray(dropLists?.interest) && dropLists.interest.length > 0
      ? dropLists.interest
      : (isKgMode ? KG_INTEREST : []);
  const effectiveRemarksList =
    Array.isArray(dropLists?.remarks) && dropLists.remarks.length > 0
      ? dropLists.remarks
      : (isKgMode ? KG_REMARKS : []);
  const effectiveClassOptions =
    Array.isArray(dropLists?.classes) && dropLists.classes.length > 0
      ? dropLists.classes
      : (isKgMode ? KG_CLASSES_DROPLIST : ["BS. 1", "BS. 2", "BS. 3", "BS. 4", "BS. 5", "BS. 6", "BS. 7", "BS. 8", "BS. 9"]);

  const handleToggleSocialHabit = (habitId, code) => {
    const nextHabits = { ...socialHabits };
    if (nextHabits[habitId] === code) {
      delete nextHabits[habitId];
    } else {
      nextHabits[habitId] = code;
    }
    setSocialHabits(nextHabits);
    saveFormDirect({ socialHabits: nextHabits, attendance });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar: Print All or Subject Teacher Read-Only Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass-card no-print">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            {isSubjectTeacherView ? "Learner Report Card Preview (Read-Only)" : "Report Card Batch Manager"}
          </h2>
          <p className="text-[10px] text-zinc-400">
            {isSubjectTeacherView
              ? "Subject Teacher View — You can browse learners and preview their full report cards here. Remarks and attendance are managed by the Form Master."
              : "All changes are saved automatically. Batch print all report cards here."}
          </p>
        </div>
        {isSubjectTeacherView ? (
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 px-3 py-1.5 rounded-lg text-[11px] font-bold">
              View-Only Mode
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {selectedStudent && (
              <button
                type="button"
                onClick={handlePrintSingle}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Current Report
              </button>
            )}
            <button
              type="button"
              onClick={handlePrintAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Print All Report Cards
            </button>
          </div>
        )}
      </div>
      
      {/* 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 5 Columns: Roster selection & direct editor form */}
        <div className="lg:col-span-5 space-y-4 no-print min-w-0 w-full">
          
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
            
            <div className={`${isReadOnly ? 'max-h-[calc(100vh-250px)]' : 'max-h-[160px]'} overflow-y-auto custom-scrollbar divide-y divide-zinc-100 dark:divide-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg`}>
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
          {selectedStudent && !isReadOnly && (
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
                <fieldset disabled={isReadOnly} className="space-y-4 text-xs font-semibold">
                  <div className={viewingTerm === 'Term 3' ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">
                        ATTENDANCE (Max: {metadata.timesOpen || 100})
                      </label>
                      <input
                        type="number"
                        value={attendance}
                        onChange={(e) => setAttendance(e.target.value)}
                        onBlur={(e) => saveFormDirect({ attendance: e.target.value })}
                        min={0}
                        max={metadata.timesOpen || 100}
                        required
                        className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    {viewingTerm === 'Term 3' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                            {isKgMode ? 'TRANSITION TO' : 'PROMOTED TO'}
                          </label>
                          {promotionMap[selectedStudent?.sn] && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              promotionMap[selectedStudent?.sn].passed 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {isKgMode
                                ? (promotionMap[selectedStudent?.sn].readinessStatus || 'Ready to Transition')
                                : `Auto: ${promotionMap[selectedStudent?.sn].annualScore}%`}
                            </span>
                          )}
                        </div>
                        <select
                          value={promotedTo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPromotedTo(val);
                            saveFormDirect({ promotedTo: val, attendance });
                          }}
                          className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- None --</option>
                          {promotionMap[selectedStudent?.sn] && (
                            <option value={promotionMap[selectedStudent?.sn].autoPromotedTo}>
                              ★ {promotionMap[selectedStudent?.sn].autoPromotedTo}
                            </option>
                          )}
                          {effectiveClassOptions.map((opt, idx) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isKgMode && (
                    <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Personal &amp; Social Habits Checklist
                        </span>
                        <span className="text-[9px] text-zinc-400">IND / DEV / EMG / NYS</span>
                      </div>
                      <div className="space-y-1.5">
                        {KG_SOCIAL_HABITS.map((habit) => (
                          <div
                            key={habit.id}
                            className="flex items-center justify-between gap-2 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800/80 rounded-lg px-2.5 py-1.5"
                          >
                            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 leading-tight">
                              {habit.label}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {KG_PROFICIENCY_SCALE.map((tier) => {
                                const active = socialHabits?.[habit.id] === tier.code;
                                return (
                                  <button
                                    key={tier.code}
                                    type="button"
                                    onClick={() => handleToggleSocialHabit(habit.id, tier.code)}
                                    title={tier.label}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border transition-colors ${
                                      active
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-emerald-400'
                                    }`}
                                  >
                                    {tier.code}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">CONDUCT REMARKS</label>
                      <select
                        value={conduct}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConduct(val);
                          saveFormDirect({ conduct: val, attendance });
                        }}
                        className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Select Conduct --</option>
                        {effectiveConductList.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={conduct}
                        onChange={(e) => setConduct(e.target.value)}
                        onBlur={(e) => saveFormDirect({ conduct: e.target.value, attendance })}
                        placeholder="Or type custom conduct..."
                        className="w-full mt-1.5 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">INTEREST ACTIVITIES</label>
                      <select
                        value={interest}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInterest(val);
                          saveFormDirect({ interest: val, attendance });
                        }}
                        className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Select Interest --</option>
                        {effectiveInterestList.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={interest}
                        onChange={(e) => setInterest(e.target.value)}
                        onBlur={(e) => saveFormDirect({ interest: e.target.value, attendance })}
                        placeholder="Or type custom interest..."
                        className="w-full mt-1.5 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">
                      {isKgMode ? "FACILITATOR'S REMARKS" : "CLASS TEACHER'S REMARKS"}
                    </label>
                    <select
                      value={remarks}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRemarks(val);
                        saveFormDirect({ remarks: val, attendance });
                      }}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Select Remarks --</option>
                      {effectiveRemarksList.map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      onBlur={(e) => saveFormDirect({ remarks: e.target.value, attendance })}
                      placeholder="Or type custom remarks..."
                      className="w-full mt-1.5 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                        {isKgMode ? 'EARLY LEARNING HOME ADVISORY (PAGE 2)' : 'PARENT ADVISORY NOTE (PAGE 2)'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = buildDefaultAdvisory(selectedStudent);
                          setParentAdvisoryNote(generated);
                          saveFormDirect({ parentAdvisoryNote: generated, attendance });
                        }}
                        className="text-[9px] text-blue-500 hover:text-blue-600 font-semibold"
                      >
                        Reset to Auto-Suggested Note
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={parentAdvisoryNote}
                      onChange={(e) => setParentAdvisoryNote(e.target.value)}
                      onBlur={(e) => saveFormDirect({ parentAdvisoryNote: e.target.value, attendance })}
                      placeholder={
                        isKgMode
                          ? "Auto-generated early learning home play advice will appear here..."
                          : "Auto-generated parent advisory note for Maths and Science will appear here..."
                      }
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                    />
                    <p className="text-[9px] text-zinc-400 mt-1">
                      {isKgMode
                        ? "This note is tailored to the learner's Language & Literacy and Numeracy progress and prints on Page 2."
                        : "This note is automatically tailored to this learner's Mathematics and Science scores and prints on Page 2 of their report card."}
                    </p>
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
                  </div>
                </fieldset>

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

        {/* Right 7 Columns: Direct Input Card & Live HTML Report Card Preview */}
        <div className="lg:col-span-7 flex flex-col justify-start gap-6 no-print min-w-0 w-full">
          {previewStudent ? (
            <ReportPaperPreview>
              <ReportCard
                student={previewStudent}
                metadata={metadata}
                calculatedScores={computedResults}
                teacherSubjects={teacherSubjects}
                viewingTerm={viewingTerm}
                institution={institution}
              />
            </ReportPaperPreview>
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
