import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Lock, Save, Search, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  KG_LEARNING_AREAS,
  KG_PROFICIENCY_SCALE,
  getKgIndicatorsForArea,
  getKgProficiencyMeta,
  normalizeKgRatingCode,
  deriveKgAreaRatingFromIndicators,
} from '../constants/curriculum';
import { calculateAgeFromDob } from '../utils/rosterHelpers';

const TONE_BADGE_CLASSES = {
  emerald: {
    active: 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20',
    idle: 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300',
    pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  },
  blue: {
    active: 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20',
    idle: 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300',
    pill: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
  },
  amber: {
    active: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20',
    idle: 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300',
    pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  },
  rose: {
    active: 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/20',
    idle: 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300',
    pill: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
  },
  zinc: {
    active: 'bg-zinc-700 text-white border-zinc-700',
    idle: 'border-zinc-200 dark:border-zinc-800 text-zinc-500',
    pill: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
  },
};

export default function KgAssessmentBook({
  students = [],
  gradesStore = {},
  onSave,
  teacherSubjects,
  metadata = {},
  isReadOnly = false,
}) {
  const areaTabs = useMemo(
    () => (Array.isArray(teacherSubjects) && teacherSubjects.length > 0 ? teacherSubjects : KG_LEARNING_AREAS),
    [teacherSubjects]
  );

  const [activeTab, setActiveTab] = useState(areaTabs[0] || KG_LEARNING_AREAS[0]);
  const [localGrades, setLocalGrades] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSnMap, setExpandedSnMap] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

  useEffect(() => {
    if (areaTabs.length > 0 && !areaTabs.some((t) => t.key === activeTab?.key)) {
      setActiveTab(areaTabs[0]);
    }
  }, [areaTabs, activeTab]);

  useEffect(() => {
    const rawArea = gradesStore?.[activeTab?.key] || {};
    const initialized = {};
    students.forEach((student) => {
      const entry = rawArea[student.sn] || {};
      const rating = normalizeKgRatingCode(entry.rating || entry.grade);
      const indicators = entry.indicators && typeof entry.indicators === 'object' ? { ...entry.indicators } : {};
      const note = typeof entry.note === 'string' ? entry.note : '';
      initialized[student.sn] = {
        mode: 'kg',
        rating: rating || deriveKgAreaRatingFromIndicators(indicators) || '',
        indicators,
        note,
      };
    });
    setLocalGrades(initialized);
    setSaveStatus('idle');
  }, [activeTab?.key, gradesStore, students]);

  const classLevel = metadata?.classLevel || 'KG 1';
  const areaIndicators = useMemo(
    () => getKgIndicatorsForArea(activeTab?.key, classLevel),
    [activeTab?.key, classLevel]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => String(s.name || '').toLowerCase().includes(q));
  }, [students, searchQuery]);

  const assessedCount = useMemo(() => {
    return students.filter((s) => Boolean(normalizeKgRatingCode(localGrades[s.sn]?.rating))).length;
  }, [students, localGrades]);

  const persistAreaGrades = async (nextState, showToast = false) => {
    if (isReadOnly || !onSave || !activeTab?.key) return;
    setSaveStatus('saving');
    try {
      await onSave(activeTab.key, nextState);
      setSaveStatus('saved');
      if (showToast) toast.success(`${activeTab.name} observations saved.`);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save KG progress:', err);
      setSaveStatus('idle');
      if (showToast) toast.error('Could not save observations. Check connection.');
    }
  };

  const handleSetRating = (sn, code) => {
    if (isReadOnly) return;
    const current = localGrades[sn] || { mode: 'kg', rating: '', indicators: {}, note: '' };
    const nextRating = current.rating === code ? '' : code;
    const nextEntry = {
      ...current,
      mode: 'kg',
      rating: nextRating,
    };
    const nextState = { ...localGrades, [sn]: nextEntry };
    setLocalGrades(nextState);
    persistAreaGrades(nextState, false);
  };

  const handleSetIndicatorRating = (sn, indicatorId, code) => {
    if (isReadOnly) return;
    const current = localGrades[sn] || { mode: 'kg', rating: '', indicators: {}, note: '' };
    const nextIndicators = { ...(current.indicators || {}) };
    if (nextIndicators[indicatorId] === code) {
      delete nextIndicators[indicatorId];
    } else {
      nextIndicators[indicatorId] = code;
    }
    const derivedRating = deriveKgAreaRatingFromIndicators(nextIndicators);
    const nextEntry = {
      ...current,
      mode: 'kg',
      indicators: nextIndicators,
      rating: derivedRating || current.rating || '',
    };
    const nextState = { ...localGrades, [sn]: nextEntry };
    setLocalGrades(nextState);
    persistAreaGrades(nextState, false);
  };

  const handleClearIndicators = (sn) => {
    if (isReadOnly) return;
    const current = localGrades[sn] || { mode: 'kg', rating: '', indicators: {}, note: '' };
    const nextState = {
      ...localGrades,
      [sn]: { ...current, mode: 'kg', indicators: {} },
    };
    setLocalGrades(nextState);
    persistAreaGrades(nextState, false);
  };

  const handleNoteChange = (sn, text) => {
    if (isReadOnly) return;
    const current = localGrades[sn] || { mode: 'kg', rating: '', indicators: {}, note: '' };
    setLocalGrades((prev) => ({
      ...prev,
      [sn]: { ...current, mode: 'kg', note: text },
    }));
  };

  const handleNoteBlur = () => {
    if (isReadOnly) return;
    persistAreaGrades(localGrades, false);
  };

  const handleBulkFillUnassessed = (targetCode) => {
    if (isReadOnly || !targetCode) return;
    const nextState = { ...localGrades };
    let changed = 0;
    students.forEach((student) => {
      const existing = nextState[student.sn] || { mode: 'kg', rating: '', indicators: {}, note: '' };
      if (!normalizeKgRatingCode(existing.rating)) {
        nextState[student.sn] = { ...existing, mode: 'kg', rating: targetCode };
        changed += 1;
      }
    });
    if (changed === 0) {
      toast('All learners already have an observation rating for this area.');
      return;
    }
    setLocalGrades(nextState);
    persistAreaGrades(nextState, true);
  };

  const toggleExpand = (sn) => {
    setExpandedSnMap((prev) => ({ ...prev, [sn]: !prev[sn] }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Learning Area Tab Bar */}
      <div className="glass-card p-2 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {areaTabs.map((tab) => {
          const isActive = activeTab?.key === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Header & Controls */}
      <div className="glass-card p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                {activeTab?.name}
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                {classLevel} • NaCCA Observation
              </span>
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                  <Lock className="w-3 h-3" /> Read-Only Term
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {assessedCount} of {students.length} learners assessed • Tap proficiency or expand {classLevel} milestones
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isReadOnly && (
              <div className="relative">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkFillUnassessed(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="" disabled>Mark Unassessed As...</option>
                  {KG_PROFICIENCY_SCALE.map((tier) => (
                    <option key={tier.code} value={tier.code}>
                      {tier.code} — {tier.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => persistAreaGrades(localGrades, true)}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
              >
                {saveStatus === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Progress'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scale Key + Search Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            {KG_PROFICIENCY_SCALE.map((tier) => {
              const cls = TONE_BADGE_CLASSES[tier.tone] || TONE_BADGE_CLASSES.zinc;
              return (
                <span
                  key={tier.code}
                  title={tier.description}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cls.pill}`}
                >
                  <span>{tier.code}</span>
                  <span className="font-medium opacity-85">= {tier.label}</span>
                </span>
              );
            })}
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search learner name..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Learner List */}
      {students.length === 0 ? (
        <div className="glass-card p-10 text-center border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-sm text-zinc-500 dark:text-zinc-400">
          No learners on the class roster yet. Add Kindergarten learners in the <strong>Roster</strong> tab first.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredStudents.map((student) => {
            const entry = localGrades[student.sn] || { mode: 'kg', rating: '', indicators: {}, note: '' };
            const activeMeta = getKgProficiencyMeta(entry.rating);
            const isExpanded = Boolean(expandedSnMap[student.sn]);
            const ratedIndicatorCount = areaIndicators.filter((ind) =>
              Boolean(normalizeKgRatingCode(entry.indicators?.[ind.id]))
            ).length;
            const learnerDob = student?.dateOfBirth || student?.dob || '';
            const ageYears = learnerDob ? calculateAgeFromDob(learnerDob) : null;

            return (
              <div
                key={student.sn}
                className="glass-card border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden transition-colors"
              >
                <div className="p-3.5 sm:px-4 sm:py-3 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                  {/* Left: Learner Identity + Expand Trigger */}
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 lg:w-64 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(student.sn)}
                      className="mt-0.5 sm:mt-0 p-1 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      title="Expand observable milestones"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-zinc-400">
                          #{student.sn}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {student.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>{student.gender || 'Learner'}</span>
                        {ageYears !== null && <span>• {ageYears} yrs</span>}
                        <button
                          type="button"
                          onClick={() => toggleExpand(student.sn)}
                          className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Milestones ({ratedIndicatorCount}/{areaIndicators.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Middle: 4-Tier Proficiency Selector Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {KG_PROFICIENCY_SCALE.map((tier) => {
                      const selected = entry.rating === tier.code;
                      const toneCfg = TONE_BADGE_CLASSES[tier.tone] || TONE_BADGE_CLASSES.zinc;
                      return (
                        <button
                          key={tier.code}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleSetRating(student.sn, tier.code)}
                          title={`${tier.label}: ${tier.description}`}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all disabled:opacity-60 ${
                            selected ? toneCfg.active : toneCfg.idle
                          }`}
                        >
                          {tier.code}
                        </button>
                      );
                    })}
                    <span
                      className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        (TONE_BADGE_CLASSES[activeMeta.tone] || TONE_BADGE_CLASSES.zinc).pill
                      }`}
                    >
                      {activeMeta.label}
                    </span>
                  </div>

                  {/* Right: Qualitative Teacher Observation Note */}
                  <div className="flex-1 min-w-[200px] lg:max-w-sm">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={entry.note || ''}
                      onChange={(e) => handleNoteChange(student.sn, e.target.value)}
                      onBlur={handleNoteBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder={`Observation note for ${activeTab?.name}...`}
                      className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Expandable Age-Specific Milestone Indicators */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-zinc-50/90 dark:bg-zinc-950/60 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {classLevel} Observable Milestones — {activeTab?.name} (Rating updates automatically)
                      </span>
                      {!isReadOnly && ratedIndicatorCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleClearIndicators(student.sn)}
                          className="text-[10px] font-semibold text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          Clear Milestones
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {areaIndicators.map((ind) => {
                        const indRating = normalizeKgRatingCode(entry.indicators?.[ind.id]);
                        return (
                          <div
                            key={ind.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2"
                          >
                            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 leading-snug">
                              {ind.label}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {KG_PROFICIENCY_SCALE.map((tier) => {
                                const picked = indRating === tier.code;
                                const toneCfg = TONE_BADGE_CLASSES[tier.tone] || TONE_BADGE_CLASSES.zinc;
                                return (
                                  <button
                                    key={tier.code}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleSetIndicatorRating(student.sn, ind.id, tier.code)}
                                    title={tier.label}
                                    className={`px-2 py-1 rounded text-[10px] font-extrabold border transition-all disabled:opacity-60 ${
                                      picked ? toneCfg.active : toneCfg.idle
                                    }`}
                                  >
                                    {tier.code}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
