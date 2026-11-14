import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Users,
  Printer,
  Trash2,
  Search,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  X,
  ClipboardList,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { generateGradingSheetDocx } from '../utils/docxGenerator';
import {
  normalizeStudentName,
  normalizeGender,
  normalizeDateOfBirth,
  calculateAgeFromDob,
  parsePastedRosterText,
  stripInternalRowFields,
  buildRosterCommitPayload,
} from '../utils/rosterHelpers';

/**
 * Interactive Mobile-First Class Roster Sheet
 */
const Roster = ({ students = [], metadata = {}, onSave, isReadOnly = false }) => {
  const rowSeqRef = useRef(0);
  const nextRowId = useCallback((prefix) => {
    rowSeqRef.current += 1;
    return `${prefix}-${rowSeqRef.current}`;
  }, []);

  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const makeBlankDraftRow = useCallback(
    () => ({
      _rowId: nextRowId('dft'),
      name: '',
      gender: 'U',
      dateOfBirth: '',
    }),
    [nextRowId]
  );

  const makeBlankDrafts = useCallback(
    (count) => Array.from({ length: count }, () => makeBlankDraftRow()),
    [makeBlankDraftRow]
  );

  const toEnrolledRow = useCallback(
    (student, existingRowId = null) => {
      const cleanName = normalizeStudentName(student?.name);
      const cleanGender = normalizeGender(student?.gender);
      const cleanDob = normalizeDateOfBirth(student?.dateOfBirth);
      return {
        _rowId: existingRowId || nextRowId('enr'),
        _origSn: student?.sn,
        _origName: cleanName,
        _origGender: cleanGender,
        _origDob: cleanDob,
        _rawData: stripInternalRowFields(student),
        sn: student?.sn,
        name: cleanName,
        gender: cleanGender,
        dateOfBirth: cleanDob,
      };
    },
    [nextRowId]
  );

  const ensureTrailingBlankDraft = useCallback(
    (drafts, enrolledCount) => {
      const next = [...drafts];
      const allDraftsUntouched = next.every(
        (d) =>
          !normalizeStudentName(d.name) &&
          normalizeGender(d.gender) === 'U' &&
          !normalizeDateOfBirth(d.dateOfBirth)
      );

      // New/empty classes open with 5 ready-to-type rows; populated classes keep at least 1 trailing blank row.
      if (enrolledCount === 0 && allDraftsUntouched && next.length < 5) {
        while (next.length < 5) {
          next.push(makeBlankDraftRow());
        }
        return next;
      }

      if (next.length === 0) {
        return [makeBlankDraftRow()];
      }

      const last = next[next.length - 1];
      if (
        normalizeStudentName(last.name) !== '' ||
        normalizeGender(last.gender) !== 'U' ||
        normalizeDateOfBirth(last.dateOfBirth) !== ''
      ) {
        next.push(makeBlankDraftRow());
      }
      return next;
    },
    [makeBlankDraftRow]
  );

  const contextKey = `${metadata?.schoolName || ''}|${metadata?.year || ''}|${metadata?.term || ''}|${metadata?.className || ''}`;

  const [enrolledRows, setEnrolledRows] = useState(() =>
    [...students]
      .sort((a, b) => (Number(a.sn) || 0) - (Number(b.sn) || 0))
      .map((s) => toEnrolledRow(s))
  );
  const [draftRows, setDraftRows] = useState(() =>
    students.length === 0 ? makeBlankDrafts(5) : makeBlankDrafts(1)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL'); // 'ALL' | 'M' | 'F' | 'U'
  const [sessionAssignedIds, setSessionAssignedIds] = useState(() => new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [saveStatus, setSaveStatus] = useState('synced'); // 'synced' | 'pending' | 'saving' | 'error'
  const [blankErrorRowIds, setBlankErrorRowIds] = useState(() => new Set());
  const [isExporting, setIsExporting] = useState(false);

  const tableWrapperRef = useRef(null);
  const inputRefs = useRef({});
  const latestStateRef = useRef({ enrolledRows, draftRows, students, isReadOnly, onSave });
  const prevContextKeyRef = useRef(contextKey);
  const prevStudentsRef = useRef(students);
  const autoSaveTimerRef = useRef(null);
  const deleteConfirmTimerRef = useRef(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const lastCommitMetaRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    latestStateRef.current = { enrolledRows, draftRows, students, isReadOnly, onSave };
  }, [enrolledRows, draftRows, students, isReadOnly, onSave]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);

      // Flush pending valid changes cleanly if user switches tabs before hitting Save
      const { enrolledRows: curEnr, draftRows: curDft, students: curStudents, isReadOnly: ro, onSave: saveFn } =
        latestStateRef.current;
      if (ro || typeof saveFn !== 'function') return;

      const payload = buildRosterCommitPayload({
        enrolledRows: curEnr,
        draftRows: curDft,
        originalStudents: curStudents,
      });

      if (!payload.hasError && payload.hasChanges) {
        Promise.resolve(saveFn(payload.roster, payload.snMap)).catch((err) => {
          console.error('Unmount roster flush failed:', err);
          toast.error('Could not save pending roster edits');
        });
      }
    };
  }, []);

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const isAnyTableInputFocused = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active || active.tagName !== 'INPUT') return false;
    return Boolean(tableWrapperRef.current?.contains(active));
  }, []);

  // Reconcile incoming `students` prop or term/class context switch
  useEffect(() => {
    const sortedIncoming = [...students].sort((a, b) => (Number(a.sn) || 0) - (Number(b.sn) || 0));

    if (prevContextKeyRef.current !== contextKey) {
      prevContextKeyRef.current = contextKey;
      prevStudentsRef.current = students;
      clearAutoSaveTimer();
      lastCommitMetaRef.current = null;
      queuedSaveRef.current = false;

      const nextEnrolled = sortedIncoming.map((s) => toEnrolledRow(s));
      setEnrolledRows(nextEnrolled);
      setDraftRows(nextEnrolled.length === 0 ? makeBlankDrafts(5) : [makeBlankDraftRow()]);
      setSearchQuery('');
      setGenderFilter('ALL');
      setSessionAssignedIds(new Set());
      setConfirmDeleteId(null);
      setConfirmClearOpen(false);
      setPasteModalOpen(false);
      setPasteText('');
      setBlankErrorRowIds(new Set());
      setSaveStatus('synced');
      return;
    }

    const currentEnrolled = latestStateRef.current.enrolledRows;
    const currentDrafts = latestStateRef.current.draftRows;
    const prevStudents = prevStudentsRef.current;
    prevStudentsRef.current = students;

    const commitMeta = lastCommitMetaRef.current;

    const matchExistingRowId = (incomingList) => {
      const usedIds = new Set();
      return incomingList.map((s) => {
        const sNorm = normalizeStudentName(s.name);
        let matched = currentEnrolled.find(
          (r) => !usedIds.has(r._rowId) && r._origSn === s.sn && r._origName === sNorm
        );
        if (!matched) {
          matched = currentEnrolled.find(
            (r) => !usedIds.has(r._rowId) && normalizeStudentName(r.name) === sNorm
          );
        }
        if (matched) usedIds.add(matched._rowId);
        return toEnrolledRow(s, matched ? matched._rowId : null);
      });
    };

    if (commitMeta) {
      lastCommitMetaRef.current = null;
      let nextEnrolled = matchExistingRowId(sortedIncoming);

      // Reconcile draft rows committed in this save, preserving any keystrokes made mid-flight
      const remainingDrafts = [];
      for (const draft of currentDrafts) {
        if (!commitMeta.committedDraftMap.has(draft._rowId)) {
          remainingDrafts.push(draft);
          continue;
        }
        const committedName = commitMeta.committedDraftMap.get(draft._rowId);
        const liveName = normalizeStudentName(draft.name);
        if (liveName && liveName !== committedName) {
          const idx = nextEnrolled.findIndex((r) => normalizeStudentName(r.name) === committedName);
          if (idx !== -1) {
            nextEnrolled[idx] = {
              ...nextEnrolled[idx],
              name: draft.name,
              gender: draft.gender,
              dateOfBirth: draft.dateOfBirth || '',
            };
          } else {
            remainingDrafts.push(draft);
          }
        }
      }

      setEnrolledRows(nextEnrolled);
      setDraftRows(ensureTrailingBlankDraft(remainingDrafts, nextEnrolled.length));
      setBlankErrorRowIds(new Set());
      if (!queuedSaveRef.current) {
        setSaveStatus('synced');
      }
      return;
    }

    // External update or initial hydration: only replace enrolledRows if user has no local enrolled edits
    const hasLocalEnrolledEdits =
      currentEnrolled.length !== prevStudents.length ||
      currentEnrolled.some(
        (r) =>
          normalizeStudentName(r.name) !== r._origName ||
          normalizeGender(r.gender) !== r._origGender ||
          normalizeDateOfBirth(r.dateOfBirth) !== (r._origDob || '')
      );

    if (!hasLocalEnrolledEdits) {
      const nextEnrolled = matchExistingRowId(sortedIncoming);
      setEnrolledRows(nextEnrolled);

      const allDraftsEmpty = currentDrafts.every(
        (d) =>
          !normalizeStudentName(d.name) &&
          normalizeGender(d.gender) === 'U' &&
          !normalizeDateOfBirth(d.dateOfBirth)
      );
      if (allDraftsEmpty) {
        setDraftRows(nextEnrolled.length === 0 ? makeBlankDrafts(5) : [makeBlankDraftRow()]);
      } else {
        setDraftRows((prev) => ensureTrailingBlankDraft(prev, nextEnrolled.length));
      }
      setBlankErrorRowIds(new Set());
    }
  }, [
    students,
    contextKey,
    clearAutoSaveTimer,
    ensureTrailingBlankDraft,
    makeBlankDraftRow,
    makeBlankDrafts,
    toEnrolledRow,
  ]);

  const commitSave = useCallback(
    async ({ silent = false, allowReorder = true } = {}) => {
      const {
        enrolledRows: curEnr,
        draftRows: curDft,
        students: curStudents,
        isReadOnly: ro,
        onSave: saveFn,
      } = latestStateRef.current;

      if (ro || typeof saveFn !== 'function') return false;

      if (isSavingRef.current) {
        queuedSaveRef.current = true;
        return false;
      }

      const payload = buildRosterCommitPayload({
        enrolledRows: curEnr,
        draftRows: curDft,
        originalStudents: curStudents,
      });

      if (payload.hasError) {
        if (isMountedRef.current) {
          setBlankErrorRowIds(new Set(payload.blankEnrolledRowIds));
          if (!silent) {
            toast.error('Please enter a name for highlighted row(s) or tap trash to remove.');
          }
        }
        return false;
      }

      if (!payload.hasChanges) {
        if (isMountedRef.current) {
          setSaveStatus('synced');
          setBlankErrorRowIds(new Set());
        }
        return true;
      }

      // Skip background auto-save if sorting/adding would jump rows while user is typing
      if (!allowReorder && payload.needsReorder) {
        return false;
      }

      clearAutoSaveTimer();
      isSavingRef.current = true;
      if (isMountedRef.current) {
        setSaveStatus('saving');
        setBlankErrorRowIds(new Set());
      }

      const committedDraftMap = new Map();
      for (const draft of curDft) {
        const clean = normalizeStudentName(draft.name);
        if (clean) {
          committedDraftMap.set(draft._rowId, clean);
        }
      }

      lastCommitMetaRef.current = {
        committedDraftMap,
        hadStructuralChanges: payload.hasStructuralChanges,
      };

      try {
        await saveFn(payload.roster, payload.snMap);
        if (!silent) {
          toast.success(
            payload.needsReorder
              ? `Roster saved & sorted (${payload.roster.length} learners)`
              : 'Gender updated'
          );
        }
        return true;
      } catch (err) {
        lastCommitMetaRef.current = null;
        console.error('Failed to save roster:', err);
        if (isMountedRef.current) {
          setSaveStatus('error');
        }
        toast.error('Could not save roster changes. Tap Save to retry.');
        return false;
      } finally {
        isSavingRef.current = false;
        if (queuedSaveRef.current) {
          queuedSaveRef.current = false;
          // Run follow-up auto-save shortly for rapid consecutive M/F taps
          autoSaveTimerRef.current = setTimeout(() => {
            const focused = isAnyTableInputFocused();
            commitSave({ silent: true, allowReorder: !focused });
          }, 350);
        }
      }
    },
    [clearAutoSaveTimer, isAnyTableInputFocused]
  );

  const scheduleAutoSave = useCallback(
    (delayMs, allowReorder = false) => {
      clearAutoSaveTimer();
      autoSaveTimerRef.current = setTimeout(() => {
        if (!allowReorder) {
          commitSave({ silent: true, allowReorder: false });
          return;
        }
        // Only auto-sort/commit structural edits when the user is no longer typing inside the table
        if (!isAnyTableInputFocused()) {
          commitSave({ silent: true, allowReorder: true });
        }
      }, delayMs);
    },
    [clearAutoSaveTimer, commitSave, isAnyTableInputFocused]
  );

  // Derived change summary for sticky bottom bar & status pill
  const changeSummary = useMemo(() => {
    const preview = buildRosterCommitPayload({
      enrolledRows,
      draftRows,
      originalStudents: students,
    });

    const filledDraftCount = draftRows.filter((d) => normalizeStudentName(d.name).length > 0).length;
    const deletedCount = Math.max(0, students.length - enrolledRows.length);
    const renamedCount = enrolledRows.filter(
      (r) => normalizeStudentName(r.name) !== r._origName && normalizeStudentName(r.name) !== ''
    ).length;
    const genderChangedCount = enrolledRows.filter(
      (r) => normalizeGender(r.gender) !== r._origGender
    ).length;
    const dobChangedCount = enrolledRows.filter(
      (r) => normalizeDateOfBirth(r.dateOfBirth) !== (r._origDob || '')
    ).length;

    return {
      hasError: preview.hasError,
      blankCount: preview.blankEnrolledRowIds?.length || 0,
      hasChanges: Boolean(preview.hasChanges || preview.hasError),
      needsReorder: Boolean(preview.needsReorder),
      filledDraftCount,
      deletedCount,
      renamedCount,
      genderChangedCount,
      dobChangedCount,
    };
  }, [enrolledRows, draftRows, students]);

  // Keep status indicator aligned with actual pending diff when not actively saving/errored
  useEffect(() => {
    if (isSavingRef.current) return;
    if (saveStatus === 'error') return;
    if (changeSummary.hasChanges) {
      setSaveStatus('pending');
    } else {
      setSaveStatus('synced');
    }
  }, [changeSummary.hasChanges, saveStatus]);

  // Live class headcount metrics (includes active enrolled + typed drafts)
  const stats = useMemo(() => {
    const activeDrafts = draftRows.filter((d) => normalizeStudentName(d.name).length > 0);
    const allActive = [...enrolledRows, ...activeDrafts];
    let boys = 0;
    let girls = 0;
    let unset = 0;

    for (const row of allActive) {
      const g = normalizeGender(row.gender);
      if (g === 'M') boys += 1;
      else if (g === 'F') girls += 1;
      else unset += 1;
    }

    return {
      total: allActive.length,
      savedCount: enrolledRows.length,
      boys,
      girls,
      unset,
    };
  }, [enrolledRows, draftRows]);

  const normalizedQuery = useMemo(() => normalizeStudentName(searchQuery), [searchQuery]);

  const visibleEnrolledRows = useMemo(() => {
    return enrolledRows.filter((row) => {
      const rowName = normalizeStudentName(row.name);
      if (normalizedQuery && !rowName.includes(normalizedQuery)) {
        return false;
      }
      if (genderFilter === 'ALL') return true;
      const g = normalizeGender(row.gender);
      if (genderFilter === 'U') {
        // Keep rows just tagged in this Missing-M/F filter session visible so wrong taps can be corrected immediately
        return g === 'U' || sessionAssignedIds.has(row._rowId);
      }
      return g === genderFilter;
    });
  }, [enrolledRows, normalizedQuery, genderFilter, sessionAssignedIds]);

  const visibleDraftRows = useMemo(() => {
    if (isReadOnly) return [];
    // Hide empty draft rows only while filtering by search or gender (except ALL)
    if (normalizedQuery || genderFilter !== 'ALL') {
      return draftRows.filter((d) => {
        const dName = normalizeStudentName(d.name);
        if (!dName) return false;
        if (normalizedQuery && !dName.includes(normalizedQuery)) return false;
        if (genderFilter === 'U') return normalizeGender(d.gender) === 'U' || sessionAssignedIds.has(d._rowId);
        return normalizeGender(d.gender) === genderFilter;
      });
    }
    return draftRows;
  }, [draftRows, isReadOnly, normalizedQuery, genderFilter, sessionAssignedIds]);

  const handleFilterChange = (nextFilter) => {
    setGenderFilter(nextFilter);
    setSessionAssignedIds(new Set());
  };

  // --- Row mutation handlers ---

  const handleEnrolledNameChange = (rowId, value) => {
    if (isReadOnly) return;
    setEnrolledRows((prev) => prev.map((r) => (r._rowId === rowId ? { ...r, name: value } : r)));
    setBlankErrorRowIds((prev) => {
      if (!prev.has(rowId)) return prev;
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
    if (saveStatus === 'error') setSaveStatus('pending');
    scheduleAutoSave(3500, true);
  };

  const handleEnrolledGenderTap = (rowId, code) => {
    if (isReadOnly) return;
    setEnrolledRows((prev) =>
      prev.map((r) => {
        if (r._rowId !== rowId) return r;
        const nextGender = normalizeGender(r.gender) === code ? 'U' : code;
        return { ...r, gender: nextGender };
      })
    );

    if (genderFilter === 'U') {
      setSessionAssignedIds((prev) => {
        const next = new Set(prev);
        next.add(rowId);
        return next;
      });
    }

    if (saveStatus === 'error') setSaveStatus('pending');

    // Compute quickly whether only genders are dirty -> rapid 650ms quiet auto-save without re-sorting
    const hasDraftText = latestStateRef.current.draftRows.some((d) => normalizeStudentName(d.name) !== '');
    const hasStructuralEnrolledDiff =
      latestStateRef.current.enrolledRows.length !== latestStateRef.current.students.length ||
      latestStateRef.current.enrolledRows.some((r) => normalizeStudentName(r.name) !== r._origName);

    if (!hasDraftText && !hasStructuralEnrolledDiff) {
      scheduleAutoSave(650, false);
    } else {
      scheduleAutoSave(3500, true);
    }
  };

  const handleEnrolledDobChange = (rowId, value) => {
    if (isReadOnly) return;
    setEnrolledRows((prev) =>
      prev.map((r) => (r._rowId === rowId ? { ...r, dateOfBirth: value } : r))
    );
    if (saveStatus === 'error') setSaveStatus('pending');

    const hasDraftText = latestStateRef.current.draftRows.some((d) => normalizeStudentName(d.name) !== '');
    const hasStructuralEnrolledDiff =
      latestStateRef.current.enrolledRows.length !== latestStateRef.current.students.length ||
      latestStateRef.current.enrolledRows.some((r) => normalizeStudentName(r.name) !== r._origName);

    if (!hasDraftText && !hasStructuralEnrolledDiff) {
      scheduleAutoSave(1200, false);
    } else {
      scheduleAutoSave(3500, true);
    }
  };

  const handleDraftNameChange = (rowId, value) => {
    if (isReadOnly) return;
    setDraftRows((prev) => {
      const updated = prev.map((d) => (d._rowId === rowId ? { ...d, name: value } : d));
      return ensureTrailingBlankDraft(updated, enrolledRows.length);
    });
    if (saveStatus === 'error') setSaveStatus('pending');
    scheduleAutoSave(3500, true);
  };

  const handleDraftGenderTap = (rowId, code) => {
    if (isReadOnly) return;
    setDraftRows((prev) =>
      prev.map((d) => {
        if (d._rowId !== rowId) return d;
        const nextGender = normalizeGender(d.gender) === code ? 'U' : code;
        return { ...d, gender: nextGender };
      })
    );
    if (saveStatus === 'error') setSaveStatus('pending');
    scheduleAutoSave(3500, true);
  };

  const handleDraftDobChange = (rowId, value) => {
    if (isReadOnly) return;
    setDraftRows((prev) => {
      const updated = prev.map((d) => (d._rowId === rowId ? { ...d, dateOfBirth: value } : d));
      return ensureTrailingBlankDraft(updated, enrolledRows.length);
    });
    if (saveStatus === 'error') setSaveStatus('pending');
    scheduleAutoSave(3500, true);
  };

  const handleDeleteEnrolledClick = (rowId) => {
    if (isReadOnly) return;
    if (confirmDeleteId === rowId) {
      if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);
      setConfirmDeleteId(null);
      setEnrolledRows((prev) => {
        const next = prev.filter((r) => r._rowId !== rowId);
        setDraftRows((dPrev) => ensureTrailingBlankDraft(dPrev, next.length));
        return next;
      });
      setBlankErrorRowIds((prev) => {
        if (!prev.has(rowId)) return prev;
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      scheduleAutoSave(3500, true);
      toast('Learner marked for removal — tap Save to apply', { icon: '🗑️' });
      return;
    }

    setConfirmDeleteId(rowId);
    if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);
    deleteConfirmTimerRef.current = setTimeout(() => {
      setConfirmDeleteId((cur) => (cur === rowId ? null : cur));
    }, 3500);
  };

  const handleRemoveDraftRow = (rowId) => {
    if (isReadOnly) return;
    setDraftRows((prev) => {
      const filtered = prev.filter((d) => d._rowId !== rowId);
      return ensureTrailingBlankDraft(filtered, enrolledRows.length);
    });
  };

  const handleTableBlur = () => {
    // Allow brief focus handoff to next input or tap button before checking idle focus
    setTimeout(() => {
      if (!isMountedRef.current) return;
      if (!isAnyTableInputFocused() && latestStateRef.current.draftRows) {
        const preview = buildRosterCommitPayload({
          enrolledRows: latestStateRef.current.enrolledRows,
          draftRows: latestStateRef.current.draftRows,
          originalStudents: latestStateRef.current.students,
        });
        if (!preview.hasError && preview.hasChanges && !preview.needsReorder) {
          scheduleAutoSave(650, false);
        } else if (!preview.hasError && preview.hasChanges) {
          scheduleAutoSave(3500, true);
        }
      }
    }, 120);
  };

  // --- Keyboard Enter / Next jump across rows ---

  const visibleRowOrder = useMemo(
    () => [...visibleEnrolledRows, ...visibleDraftRows],
    [visibleEnrolledRows, visibleDraftRows]
  );

  const handleInputKeyDown = (e, rowId, isDraftRow) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const idx = visibleRowOrder.findIndex((r) => r._rowId === rowId);
    if (idx >= 0 && idx + 1 < visibleRowOrder.length) {
      const nextId = visibleRowOrder[idx + 1]._rowId;
      const nextEl = inputRefs.current[nextId];
      if (nextEl) {
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // If user is on the very last draft row and typed a name, ensure another blank row and focus it
    if (isDraftRow) {
      const curDraft = draftRows.find((d) => d._rowId === rowId);
      if (curDraft && normalizeStudentName(curDraft.name) !== '') {
        const extra = makeBlankDraftRow();
        setDraftRows((prev) => [...prev, extra]);
        setTimeout(() => {
          const el = inputRefs.current[extra._rowId];
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 40);
      } else {
        e.currentTarget.blur();
      }
    }
  };

  // --- Multi-line Paste Handling (Direct table paste + Paste List modal) ---

  const insertParsedEntriesAtDraft = useCallback(
    (entries, targetDraftId = null) => {
      if (!entries.length) return;

      setDraftRows((prev) => {
        const newDraftObjs = entries.map((item) => ({
          _rowId: nextRowId('dft'),
          name: item.name,
          gender: item.gender,
          dateOfBirth: normalizeDateOfBirth(item.dateOfBirth),
        }));

        let nextList;
        if (targetDraftId) {
          const idx = prev.findIndex((d) => d._rowId === targetDraftId);
          if (idx !== -1 && !normalizeStudentName(prev[idx].name)) {
            nextList = [...prev.slice(0, idx), ...newDraftObjs, ...prev.slice(idx + 1)];
          } else {
            const firstEmptyIdx = prev.findIndex((d) => !normalizeStudentName(d.name));
            if (firstEmptyIdx !== -1) {
              nextList = [
                ...prev.slice(0, firstEmptyIdx),
                ...newDraftObjs,
                ...prev.slice(firstEmptyIdx + 1),
              ];
            } else {
              nextList = [...prev, ...newDraftObjs];
            }
          }
        } else {
          // Filter out untouched leading empty rows when adding via Paste List modal so entries sit cleanly at top of drafts
          const nonEmpty = prev.filter(
            (d) =>
              normalizeStudentName(d.name) !== '' ||
              normalizeGender(d.gender) !== 'U' ||
              normalizeDateOfBirth(d.dateOfBirth) !== ''
          );
          nextList = [...nonEmpty, ...newDraftObjs];
        }

        // Remove duplicate blank tails before ensuring one trailing blank row
        const trimmed = [];
        let seenTrailingBlanks = 0;
        for (let i = nextList.length - 1; i >= 0; i -= 1) {
          const d = nextList[i];
          const empty =
            !normalizeStudentName(d.name) &&
            normalizeGender(d.gender) === 'U' &&
            !normalizeDateOfBirth(d.dateOfBirth);
          if (empty && trimmed.length === 0) {
            if (seenTrailingBlanks === 0) {
              trimmed.unshift(d);
              seenTrailingBlanks += 1;
            }
          } else {
            trimmed.unshift(d);
          }
        }

        return ensureTrailingBlankDraft(trimmed, enrolledRows.length);
      });
    },
    [enrolledRows.length, ensureTrailingBlankDraft, nextRowId]
  );

  const handleDraftPaste = (e, draftId) => {
    if (isReadOnly) return;
    const raw = e.clipboardData?.getData('text/plain') || '';
    if (!raw.includes('\n')) return; // Single-line paste uses standard browser behavior

    const parsed = parsePastedRosterText(raw);
    if (parsed.length <= 1) return;

    e.preventDefault();
    insertParsedEntriesAtDraft(parsed, draftId);
    toast.success(`Added ${parsed.length} rows — tap M/F if needed, then Save`);
    scheduleAutoSave(4000, true);
  };

  const parsedModalPreview = useMemo(() => parsePastedRosterText(pasteText), [pasteText]);

  const handleConfirmPasteModal = () => {
    if (!parsedModalPreview.length) return;
    setSearchQuery('');
    setGenderFilter('ALL');
    insertParsedEntriesAtDraft(parsedModalPreview, null);
    setPasteText('');
    setPasteModalOpen(false);
    toast.success(`Added ${parsedModalPreview.length} learners into the table — tap Save to sort A–Z`);
  };

  // --- Toolbar shortcuts ---

  const handleJumpToNewRow = () => {
    if (isReadOnly) return;
    setSearchQuery('');
    setGenderFilter('ALL');

    setTimeout(() => {
      const currentDrafts = latestStateRef.current.draftRows;
      const target =
        currentDrafts.find((d) => normalizeStudentName(d.name) === '') ||
        currentDrafts[currentDrafts.length - 1];
      if (!target) return;
      const el = inputRefs.current[target._rowId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 50);
  };

  const handleAddFiveBlankRows = () => {
    if (isReadOnly) return;
    setSearchQuery('');
    setGenderFilter('ALL');
    const added = makeBlankDrafts(5);
    setDraftRows((prev) => [...prev, ...added]);
    setTimeout(() => {
      const el = inputRefs.current[added[0]._rowId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 50);
  };

  const handleDiscardChanges = () => {
    clearAutoSaveTimer();
    const freshEnrolled = [...students]
      .sort((a, b) => (Number(a.sn) || 0) - (Number(b.sn) || 0))
      .map((s) => toEnrolledRow(s));
    setEnrolledRows(freshEnrolled);
    setDraftRows(freshEnrolled.length === 0 ? makeBlankDrafts(5) : makeBlankDrafts(1));
    setConfirmDeleteId(null);
    setBlankErrorRowIds(new Set());
    setSaveStatus('synced');
    toast('Unsaved edits discarded');
  };

  const handleClearAllConfirm = async () => {
    if (isReadOnly || typeof onSave !== 'function') return;
    clearAutoSaveTimer();
    setConfirmClearOpen(false);
    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      lastCommitMetaRef.current = {
        committedDraftMap: new Map(),
        hadStructuralChanges: true,
      };
      await onSave([], {});
      setEnrolledRows([]);
      setDraftRows(makeBlankDrafts(5));
      setSearchQuery('');
      setGenderFilter('ALL');
      setSessionAssignedIds(new Set());
      setBlankErrorRowIds(new Set());
      setSaveStatus('synced');
      toast.success('Class roster cleared');
    } catch (err) {
      lastCommitMetaRef.current = null;
      console.error('Failed to clear roster:', err);
      setSaveStatus('error');
      toast.error('Failed to clear roster');
    } finally {
      isSavingRef.current = false;
    }
  };

  const handlePrintSheet = async () => {
    const preview = buildRosterCommitPayload({
      enrolledRows,
      draftRows,
      originalStudents: students,
    });

    const printable =
      preview.roster ||
      [...enrolledRows]
        .filter((r) => normalizeStudentName(r.name) !== '')
        .sort((a, b) => (Number(a.sn) || 0) - (Number(b.sn) || 0))
        .map((r) => ({
          ...stripInternalRowFields(r._rawData),
          sn: r._origSn,
          name: normalizeStudentName(r.name),
          gender: normalizeGender(r.gender),
        }));

    if (!printable || printable.length === 0) {
      toast.error('Add learners to the roster before printing.');
      return;
    }

    setIsExporting(true);
    try {
      await generateGradingSheetDocx(printable, metadata);
      toast.success('Attendance / grading sheet downloaded');
    } catch (err) {
      console.error('Print sheet generation failed:', err);
      toast.error('Failed to generate printable sheet');
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to render crisp status pill
  const renderSyncPill = () => {
    if (isReadOnly) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          Read-Only
        </span>
      );
    }
    if (saveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving
        </span>
      );
    }
    if (saveStatus === 'error') {
      return (
        <button
          type="button"
          onClick={() => commitSave({ silent: false, allowReorder: true })}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-950/60 touch-manipulation"
        >
          <AlertCircle className="w-3 h-3" />
          Retry Save
        </button>
      );
    }
    if (saveStatus === 'pending' && changeSummary.hasChanges) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/50">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Unsaved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/80">
        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        Synced
      </span>
    );
  };

  // Shared segmented [M | F] control for both enrolled and draft rows
  const renderGenderPills = (genderValue, onTap, disabled) => {
    const g = normalizeGender(genderValue);
    const isUnset = g === 'U';

    return (
      <div className="inline-flex items-center gap-1" role="group" aria-label="Select Gender">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTap('M')}
          aria-pressed={g === 'M'}
          aria-label="Male"
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all touch-manipulation select-none active:scale-95 ${
            g === 'M'
              ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
              : isUnset
              ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-amber-300 dark:border-amber-700/60 hover:border-blue-400 hover:text-blue-600'
              : 'bg-white dark:bg-[#09090b] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 hover:text-blue-600'
          } ${disabled ? 'opacity-60 cursor-not-allowed active:scale-100' : 'cursor-pointer'}`}
        >
          M
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTap('F')}
          aria-pressed={g === 'F'}
          aria-label="Female"
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all touch-manipulation select-none active:scale-95 ${
            g === 'F'
              ? 'bg-rose-600 text-white border border-rose-600 shadow-sm'
              : isUnset
              ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-amber-300 dark:border-amber-700/60 hover:border-rose-400 hover:text-rose-600'
              : 'bg-white dark:bg-[#09090b] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 hover:border-rose-300 hover:text-rose-600'
          } ${disabled ? 'opacity-60 cursor-not-allowed active:scale-100' : 'cursor-pointer'}`}
        >
          F
        </button>
      </div>
    );
  };

  const pendingActionLabel = useMemo(() => {
    if (changeSummary.blankCount > 0) {
      return `${changeSummary.blankCount} blank name${changeSummary.blankCount > 1 ? 's' : ''} — fix or remove`;
    }
    const parts = [];
    if (changeSummary.filledDraftCount > 0) {
      parts.push(`+${changeSummary.filledDraftCount} new`);
    }
    if (changeSummary.renamedCount > 0) {
      parts.push(`${changeSummary.renamedCount} renamed`);
    }
    if (changeSummary.deletedCount > 0) {
      parts.push(`${changeSummary.deletedCount} removed`);
    }
    if (parts.length === 0) {
      if (changeSummary.genderChangedCount > 0) {
        parts.push(`${changeSummary.genderChangedCount} sex updated`);
      }
      if (changeSummary.dobChangedCount > 0) {
        parts.push(`${changeSummary.dobChangedCount} DOB updated`);
      }
    }
    return parts.join(' · ') || 'Unsaved changes';
  }, [changeSummary]);

  const showStickySaveBar =
    !isReadOnly && (changeSummary.hasChanges || saveStatus === 'error');

  return (
    <div className={`space-y-4 ${showStickySaveBar ? 'pb-24 sm:pb-8' : 'pb-6'}`}>
      {/* Header & Controls */}
      <div className="glass-card rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2 min-w-0">
            <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Class Roster
            </h2>
            {metadata?.className && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/70 dark:border-zinc-700/70">
                {metadata.className}
              </span>
            )}
            {renderSyncPill()}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 transition-all touch-manipulation"
              >
                <ClipboardList className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                Paste List
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSheet}
              disabled={isExporting || stats.total === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-45 disabled:cursor-not-allowed active:scale-95 transition-all touch-manipulation"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              )}
              Print Sheet
            </button>

            {!isReadOnly && stats.total > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 border border-zinc-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/60 hover:bg-red-50/70 dark:hover:bg-red-950/30 active:scale-95 transition-all touch-manipulation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Minimalist Filter Tabs + Search + Add */}
        <div className="mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleFilterChange('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                genderFilter === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              All <span className="opacity-75 ml-0.5 tabular-nums">{stats.total}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('M')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                genderFilter === 'M'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              Boys <span className="opacity-75 ml-0.5 tabular-nums">{stats.boys}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('F')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                genderFilter === 'F'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              Girls <span className="opacity-75 ml-0.5 tabular-nums">{stats.girls}</span>
            </button>
            {(stats.unset > 0 || genderFilter === 'U') && (
              <button
                type="button"
                onClick={() => handleFilterChange('U')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                  genderFilter === 'U'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                }`}
              >
                No M/F <span className="ml-0.5 font-bold tabular-nums">{stats.unset}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search learner..."
                className="w-full pl-8 pr-8 py-1.5 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-[#09090b] focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleJumpToNewRow}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 transition-all touch-manipulation"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Add New</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          Archived term is read-only. Switch to the active term to make edits.
        </div>
      )}

      {/* Minimalist Spreadsheet Table */}
      <div
        ref={tableWrapperRef}
        data-roster-table="true"
        onBlur={handleTableBlur}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="overflow-x-auto sm:max-h-[65vh] sm:overflow-y-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="w-11 py-2.5 pl-3 sm:pl-4 pr-1 text-center">#</th>
                <th className="min-w-[200px] py-2.5 px-2 sm:px-3">Learner Name</th>
                <th className="w-[92px] py-2.5 px-1 text-center">Sex</th>
                <th className="w-[152px] py-2.5 px-2">Date of Birth</th>
                <th className="w-[70px] py-2.5 px-2 text-center">Age</th>
                {!isReadOnly && <th className="w-10 py-2.5 pr-2 sm:pr-3 text-center"></th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {/* Saved / Enrolled Learner Rows */}
              {visibleEnrolledRows.map((row) => {
                const isMissingGender = normalizeGender(row.gender) === 'U';
                const isBlankName = blankErrorRowIds.has(row._rowId);
                const isEdited =
                  normalizeStudentName(row.name) !== row._origName ||
                  normalizeGender(row.gender) !== row._origGender ||
                  normalizeDateOfBirth(row.dateOfBirth) !== (row._origDob || '');
                const isConfirmingDel = confirmDeleteId === row._rowId;
                const age = calculateAgeFromDob(row.dateOfBirth);

                return (
                  <tr
                    key={row._rowId}
                    className={`group transition-colors ${
                      isBlankName
                        ? 'bg-red-50/70 dark:bg-red-950/20'
                        : isEdited
                        ? 'bg-emerald-50/35 dark:bg-emerald-950/15'
                        : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <td
                      className={`py-1.5 pl-3 sm:pl-4 pr-1 text-center text-xs font-medium tabular-nums align-middle ${
                        isMissingGender
                          ? 'border-l-2 border-l-amber-400 text-amber-600 dark:text-amber-400'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {row.sn}
                    </td>

                    <td className="py-1 px-1.5 sm:px-2 align-middle">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current[row._rowId] = el;
                          else delete inputRefs.current[row._rowId];
                        }}
                        type="text"
                        readOnly={isReadOnly}
                        value={row.name}
                        onChange={(e) => handleEnrolledNameChange(row._rowId, e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, row._rowId, false)}
                        placeholder="SURNAME FIRSTNAME"
                        enterKeyHint="next"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-label={`Learner ${row.sn} name`}
                        className={`w-full px-2 py-1.5 rounded-lg text-base sm:text-sm font-medium uppercase tracking-tight transition-all outline-none ${
                          isBlankName
                            ? 'bg-white dark:bg-[#09090b] text-red-700 dark:text-red-400 ring-1 ring-red-400 placeholder:text-red-300'
                            : isReadOnly
                            ? 'bg-transparent text-zinc-700 dark:text-zinc-300 cursor-default'
                            : 'bg-transparent text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50 focus:bg-white dark:focus:bg-[#09090b] focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600'
                        }`}
                      />
                      {isBlankName && (
                        <div className="px-2 pb-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                          Enter name or remove row
                        </div>
                      )}
                    </td>

                    <td className="py-1.5 px-1 text-center align-middle">
                      {renderGenderPills(
                        row.gender,
                        (code) => handleEnrolledGenderTap(row._rowId, code),
                        isReadOnly
                      )}
                    </td>

                    <td className="py-1 px-1.5 sm:px-2 align-middle">
                      <input
                        type="date"
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        max={todayIso}
                        value={row.dateOfBirth || ''}
                        onChange={(e) => handleEnrolledDobChange(row._rowId, e.target.value)}
                        aria-label={`Learner ${row.sn} date of birth`}
                        className={`w-full px-2 py-1.5 rounded-lg text-base sm:text-xs font-medium tabular-nums outline-none transition-colors border border-transparent ${
                          isReadOnly
                            ? 'bg-transparent text-zinc-500 dark:text-zinc-400 cursor-default'
                            : 'bg-transparent text-zinc-700 dark:text-zinc-200 hover:border-zinc-200 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-[#09090b] focus:border-zinc-400 dark:focus:border-zinc-600'
                        }`}
                      />
                    </td>

                    <td className="py-1.5 px-2 text-center align-middle">
                      <span
                        className={`text-xs font-semibold tabular-nums whitespace-nowrap ${
                          age !== null
                            ? 'text-zinc-800 dark:text-zinc-200'
                            : 'text-zinc-300 dark:text-zinc-600'
                        }`}
                      >
                        {age !== null ? `${age} yrs` : '—'}
                      </span>
                    </td>

                    {!isReadOnly && (
                      <td className="py-1.5 pr-2 sm:pr-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleDeleteEnrolledClick(row._rowId)}
                          title={isConfirmingDel ? 'Tap again to remove learner' : 'Remove learner'}
                          aria-label={isConfirmingDel ? 'Confirm remove learner' : 'Remove learner'}
                          className={`inline-flex items-center justify-center rounded-lg transition-all touch-manipulation active:scale-95 ${
                            isConfirmingDel
                              ? 'px-2 h-7 bg-red-600 text-white text-[10px] font-bold shadow-sm'
                              : 'w-7 h-7 text-zinc-300 dark:text-zinc-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                          }`}
                        >
                          {isConfirmingDel ? 'Del?' : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Minimal divider between saved learners and new draft rows */}
              {!isReadOnly && visibleEnrolledRows.length > 0 && visibleDraftRows.length > 0 && (
                <tr className="bg-zinc-50/70 dark:bg-zinc-900/50 border-y border-zinc-100 dark:border-zinc-800">
                  <td
                    colSpan={6}
                    className="px-3 sm:px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                  >
                    New Learners
                  </td>
                </tr>
              )}

              {/* Ready-to-Type Blank / Draft Rows */}
              {visibleDraftRows.map((draft, dIdx) => {
                const hasText = normalizeStudentName(draft.name) !== '';
                const hasGender = normalizeGender(draft.gender) !== 'U';
                const hasDob = normalizeDateOfBirth(draft.dateOfBirth) !== '';
                const canClearDraft = hasText || hasGender || hasDob || draftRows.length > 1;
                const draftAge = calculateAgeFromDob(draft.dateOfBirth);

                return (
                  <tr
                    key={draft._rowId}
                    className={`transition-colors ${
                      hasText
                        ? 'bg-zinc-50/90 dark:bg-zinc-900/60'
                        : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'
                    }`}
                  >
                    <td className="py-1.5 pl-3 sm:pl-4 pr-1 text-center align-middle">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-semibold tabular-nums ${
                          hasText
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                            : 'border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                        }`}
                      >
                        {hasText ? enrolledRows.length + dIdx + 1 : '+'}
                      </span>
                    </td>

                    <td className="py-1 px-1.5 sm:px-2 align-middle">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current[draft._rowId] = el;
                          else delete inputRefs.current[draft._rowId];
                        }}
                        type="text"
                        value={draft.name}
                        onChange={(e) => handleDraftNameChange(draft._rowId, e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, draft._rowId, true)}
                        onPaste={(e) => handleDraftPaste(e, draft._rowId)}
                        placeholder={
                          dIdx === 0 && enrolledRows.length === 0
                            ? 'SURNAME FIRSTNAME'
                            : 'Add learner...'
                        }
                        enterKeyHint="next"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-label={`New learner row ${dIdx + 1}`}
                        className="w-full px-2 py-1.5 rounded-lg text-base sm:text-sm font-medium uppercase tracking-tight bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:normal-case placeholder:font-normal placeholder:text-zinc-400 dark:placeholder:text-zinc-600 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50 focus:bg-white dark:focus:bg-[#09090b] focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all"
                      />
                    </td>

                    <td className="py-1.5 px-1 text-center align-middle">
                      {renderGenderPills(
                        draft.gender,
                        (code) => handleDraftGenderTap(draft._rowId, code),
                        false
                      )}
                    </td>

                    <td className="py-1 px-1.5 sm:px-2 align-middle">
                      <input
                        type="date"
                        max={todayIso}
                        value={draft.dateOfBirth || ''}
                        onChange={(e) => handleDraftDobChange(draft._rowId, e.target.value)}
                        aria-label={`New learner ${dIdx + 1} date of birth`}
                        className="w-full px-2 py-1.5 rounded-lg text-base sm:text-xs font-medium tabular-nums bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-[#09090b] focus:border-zinc-400 dark:focus:border-zinc-600 outline-none text-zinc-700 dark:text-zinc-200 transition-colors"
                      />
                    </td>

                    <td className="py-1.5 px-2 text-center align-middle">
                      <span
                        className={`text-xs font-semibold tabular-nums whitespace-nowrap ${
                          draftAge !== null
                            ? 'text-zinc-800 dark:text-zinc-200'
                            : 'text-zinc-300 dark:text-zinc-600'
                        }`}
                      >
                        {draftAge !== null ? `${draftAge} yrs` : '—'}
                      </span>
                    </td>

                    <td className="py-1.5 pr-2 sm:pr-3 text-center align-middle">
                      {canClearDraft && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRow(draft._rowId)}
                          title="Clear row"
                          aria-label="Clear row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all touch-manipulation"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Empty state when search/filter hides all rows */}
              {visibleEnrolledRows.length === 0 && visibleDraftRows.length === 0 && (
                <tr>
                  <td
                    colSpan={isReadOnly ? 5 : 6}
                    className="py-10 px-4 text-center text-sm text-zinc-400 dark:text-zinc-500"
                  >
                    {normalizedQuery
                      ? `No learners match "${searchQuery}".`
                      : genderFilter === 'U'
                      ? 'All learners already have Male or Female selected.'
                      : 'No learners in this filter.'}
                    {(normalizedQuery || genderFilter !== 'ALL') && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            handleFilterChange('ALL');
                          }}
                          className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
                        >
                          Show all learners
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-2.5 bg-zinc-50/70 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{stats.total}</span> total ·{' '}
            <span>{stats.boys} Boys</span> · <span>{stats.girls} Girls</span>
            {stats.unset > 0 && (
              <span className="text-amber-600 dark:text-amber-400"> · {stats.unset} Unset</span>
            )}
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleAddFiveBlankRows}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 transition-all touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" />
              5 Blank Rows
            </button>
          )}
        </div>
      </div>

      {/* Minimalist Floating Save Bar */}
      {showStickySaveBar && (
        <div className="fixed bottom-3 left-2.5 right-2.5 sm:sticky sm:bottom-4 z-30 max-w-2xl mx-auto">
          <div className="bg-zinc-900/95 dark:bg-zinc-100/95 backdrop-blur-md text-white dark:text-zinc-900 rounded-xl shadow-lg border border-zinc-800 dark:border-zinc-200 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  saveStatus === 'error' || changeSummary.blankCount > 0
                    ? 'bg-red-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-xs sm:text-sm font-medium truncate">
                {saveStatus === 'error' ? 'Save failed — check connection' : pendingActionLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {changeSummary.hasChanges && (
                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  aria-label="Discard unsaved changes"
                  title="Discard unsaved changes"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 dark:text-zinc-600 hover:text-white dark:hover:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 transition-all touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
              )}

              <button
                type="button"
                disabled={saveStatus === 'saving'}
                onClick={() => commitSave({ silent: false, allowReorder: true })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 active:scale-95 transition-all touch-manipulation"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {changeSummary.needsReorder ? 'Save & Sort A–Z' : 'Save Roster'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Line Paste Modal */}
      {pasteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPasteModalOpen(false)}
        >
          <div
            className="glass-card bg-white dark:bg-[#0c0c0f] w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Paste Class List</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  One learner per line; optional M/F tags detected automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close paste dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={7}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'1. ADZORLI PRINCE - M\n2. AGBEKO MARY - F\n3. AMENYO JOYCE'}
              className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#09090b] focus:bg-white dark:focus:bg-[#09090b] focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-base sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
              autoFocus
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {parsedModalPreview.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {parsedModalPreview.length} learner{parsedModalPreview.length === 1 ? '' : 's'} detected
                  </span>
                ) : (
                  'Ready to paste'
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPasteModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedModalPreview.length === 0}
                  onClick={handleConfirmPasteModal}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation"
                >
                  Add {parsedModalPreview.length > 0 ? parsedModalPreview.length : ''} Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {confirmClearOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmClearOpen(false)}
        >
          <div
            className="glass-card bg-white dark:bg-[#0c0c0f] w-full max-w-sm rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Clear All {stats.total} Learners?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Clears every learner and recorded score from{' '}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                    {metadata?.className || 'this class'}
                  </span>{' '}
                  for this term.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllConfirm}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 touch-manipulation"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roster;
