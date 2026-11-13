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
  parsePastedRosterText,
  stripInternalRowFields,
  buildRosterCommitPayload,
} from '../utils/rosterHelpers';

/**
 * Interactive Mobile-First Class Roster Sheet
 *
 * Teachers tap directly on table rows to enter/edit names and tap visible [M | F]
 * gender pills beside each name—zero dropdowns or modal forms required.
 */
const Roster = ({ students = [], metadata = {}, onSave, isReadOnly = false }) => {
  const rowSeqRef = useRef(0);
  const nextRowId = useCallback((prefix) => {
    rowSeqRef.current += 1;
    return `${prefix}-${rowSeqRef.current}`;
  }, []);

  const makeBlankDraftRow = useCallback(
    () => ({
      _rowId: nextRowId('dft'),
      name: '',
      gender: 'U',
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
      return {
        _rowId: existingRowId || nextRowId('enr'),
        _origSn: student?.sn,
        _origName: cleanName,
        _origGender: cleanGender,
        _rawData: stripInternalRowFields(student),
        sn: student?.sn,
        name: cleanName,
        gender: cleanGender,
      };
    },
    [nextRowId]
  );

  const ensureTrailingBlankDraft = useCallback(
    (drafts, enrolledCount) => {
      const next = [...drafts];
      const allDraftsUntouched = next.every(
        (d) => !normalizeStudentName(d.name) && normalizeGender(d.gender) === 'U'
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
      if (normalizeStudentName(last.name) !== '' || normalizeGender(last.gender) !== 'U') {
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
        (r) => normalizeStudentName(r.name) !== r._origName || normalizeGender(r.gender) !== r._origGender
      );

    if (!hasLocalEnrolledEdits) {
      const nextEnrolled = matchExistingRowId(sortedIncoming);
      setEnrolledRows(nextEnrolled);

      const allDraftsEmpty = currentDrafts.every(
        (d) => !normalizeStudentName(d.name) && normalizeGender(d.gender) === 'U'
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

    return {
      hasError: preview.hasError,
      blankCount: preview.blankEnrolledRowIds?.length || 0,
      hasChanges: Boolean(preview.hasChanges || preview.hasError),
      needsReorder: Boolean(preview.needsReorder),
      filledDraftCount,
      deletedCount,
      renamedCount,
      genderChangedCount,
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
            (d) => normalizeStudentName(d.name) !== '' || normalizeGender(d.gender) !== 'U'
          );
          nextList = [...nonEmpty, ...newDraftObjs];
        }

        // Remove duplicate blank tails before ensuring one trailing blank row
        const trimmed = [];
        let seenTrailingBlanks = 0;
        for (let i = nextList.length - 1; i >= 0; i -= 1) {
          const d = nextList[i];
          const empty = !normalizeStudentName(d.name) && normalizeGender(d.gender) === 'U';
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Read-Only Term
        </span>
      );
    }
    if (saveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving…
        </span>
      );
    }
    if (saveStatus === 'error') {
      return (
        <button
          type="button"
          onClick={() => commitSave({ silent: false, allowReorder: true })}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 touch-manipulation"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Retry Save
        </button>
      );
    }
    if (saveStatus === 'pending' && changeSummary.hasChanges) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Unsaved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check className="w-3.5 h-3.5" />
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
          className={`w-9 h-9 sm:w-9 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all touch-manipulation select-none active:scale-95 ${
            g === 'M'
              ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
              : isUnset
              ? 'bg-amber-50/70 text-slate-600 border border-amber-300 hover:border-blue-400 hover:text-blue-600'
              : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
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
          className={`w-9 h-9 sm:w-9 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all touch-manipulation select-none active:scale-95 ${
            g === 'F'
              ? 'bg-rose-600 text-white border border-rose-600 shadow-sm'
              : isUnset
              ? 'bg-amber-50/70 text-slate-600 border border-amber-300 hover:border-rose-400 hover:text-rose-600'
              : 'bg-white text-slate-400 border border-slate-200 hover:border-rose-300 hover:text-rose-600'
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
    if (parts.length === 0 && changeSummary.genderChangedCount > 0) {
      parts.push(`${changeSummary.genderChangedCount} M/F updated`);
    }
    return parts.join(' · ') || 'Unsaved roster changes';
  }, [changeSummary]);

  const showStickySaveBar =
    !isReadOnly && (changeSummary.hasChanges || saveStatus === 'error');

  return (
    <div className={`space-y-3 sm:space-y-4 ${showStickySaveBar ? 'pb-24 sm:pb-8' : 'pb-6'}`}>
      {/* Top Header & Quick Utility Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                Class Roster
              </h2>
              {metadata?.className && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
                  {metadata.className}
                </span>
              )}
              {renderSyncPill()}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Tap any row to type a name, then tap <span className="font-bold text-blue-600">M</span> or{' '}
              <span className="font-bold text-rose-600">F</span> directly beside it.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all touch-manipulation"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Paste List
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSheet}
              disabled={isExporting || stats.total === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/70 disabled:opacity-45 disabled:cursor-not-allowed active:scale-95 transition-all touch-manipulation"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              Print Sheet
            </button>

            {!isReadOnly && stats.total > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-95 transition-all touch-manipulation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Gender Filter Pills + Mobile Search & Jump-to-Add */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleFilterChange('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                genderFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              All <span className="opacity-80 ml-0.5">{stats.total}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('M')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                genderFilter === 'M'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'
              }`}
            >
              Boys <span className="opacity-80 ml-0.5">{stats.boys}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('F')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                genderFilter === 'F'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100'
              }`}
            >
              Girls <span className="opacity-80 ml-0.5">{stats.girls}</span>
            </button>
            {(stats.unset > 0 || genderFilter === 'U') && (
              <button
                type="button"
                onClick={() => handleFilterChange('U')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                  genderFilter === 'U'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 animate-pulse'
                }`}
              >
                No M/F <span className="ml-0.5 font-extrabold">{stats.unset}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter learner name..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleJumpToNewRow}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all touch-manipulation"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Add New</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-amber-800 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          This archived term is read-only. Switch to the active term to edit the roster or tag M/F.
        </div>
      )}

      {/* Spreadsheet-Style Interactive Table */}
      <div
        ref={tableWrapperRef}
        data-roster-table="true"
        onBlur={handleTableBlur}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
      >
        <div className="sm:max-h-[65vh] sm:overflow-y-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-9 sm:w-12 py-2.5 pl-2.5 sm:pl-4 pr-1 text-center">#</th>
                <th className="py-2.5 px-1.5 sm:px-3">Learner Name (Tap to Type)</th>
                <th className="w-[88px] sm:w-[98px] py-2.5 px-1 text-center">Sex</th>
                {!isReadOnly && <th className="w-10 sm:w-14 py-2.5 pr-2 sm:pr-3 text-center"></th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {/* Saved / Enrolled Learner Rows */}
              {visibleEnrolledRows.map((row, idx) => {
                const isMissingGender = normalizeGender(row.gender) === 'U';
                const isBlankName = blankErrorRowIds.has(row._rowId);
                const isEdited = normalizeStudentName(row.name) !== row._origName;
                const isConfirmingDel = confirmDeleteId === row._rowId;

                return (
                  <tr
                    key={row._rowId}
                    className={`group transition-colors ${
                      isBlankName
                        ? 'bg-red-50/70'
                        : isEdited
                        ? 'bg-emerald-50/40'
                        : idx % 2 === 1
                        ? 'bg-slate-50/40'
                        : 'bg-white'
                    }`}
                  >
                    <td
                      className={`py-1.5 pl-2.5 sm:pl-4 pr-1 text-center text-xs font-bold tabular-nums align-middle ${
                        isMissingGender ? 'border-l-[3px] border-l-amber-400 text-amber-700' : 'text-slate-400'
                      }`}
                    >
                      {row.sn}
                    </td>

                    <td className="py-1 px-1 sm:px-2 align-middle">
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
                        className={`w-full px-2 py-2 sm:py-1.5 rounded-lg text-base sm:text-sm font-semibold uppercase tracking-tight transition-all outline-none ${
                          isBlankName
                            ? 'bg-white text-red-700 ring-2 ring-red-400 placeholder:text-red-300'
                            : isReadOnly
                            ? 'bg-transparent text-slate-700 cursor-default'
                            : 'bg-transparent text-slate-800 hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-blue-500/35'
                        }`}
                      />
                      {isBlankName && (
                        <div className="px-2 pb-1 text-[11px] font-semibold text-red-600">
                          Enter name or tap trash
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

                    {!isReadOnly && (
                      <td className="py-1.5 pr-2 sm:pr-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleDeleteEnrolledClick(row._rowId)}
                          title={isConfirmingDel ? 'Tap again to remove learner' : 'Remove learner'}
                          aria-label={isConfirmingDel ? 'Confirm remove learner' : 'Remove learner'}
                          className={`inline-flex items-center justify-center rounded-lg transition-all touch-manipulation active:scale-95 ${
                            isConfirmingDel
                              ? 'px-2 h-8 bg-red-600 text-white text-[10px] font-extrabold shadow-sm'
                              : 'w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-red-50'
                          }`}
                        >
                          {isConfirmingDel ? 'Del?' : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Visual separator between saved learners and ready-to-type blank rows */}
              {!isReadOnly && visibleEnrolledRows.length > 0 && visibleDraftRows.length > 0 && (
                <tr className="bg-blue-50/45 border-y border-blue-100">
                  <td colSpan={4} className="px-3 sm:px-4 py-1.5 text-[11px] font-bold text-blue-700/80">
                    Tap rows below to add new learners — press Next on keyboard to jump down
                  </td>
                </tr>
              )}

              {/* Ready-to-Type Blank / Draft Rows */}
              {visibleDraftRows.map((draft, dIdx) => {
                const hasText = normalizeStudentName(draft.name) !== '';
                const hasGender = normalizeGender(draft.gender) !== 'U';
                const canClearDraft = hasText || hasGender || draftRows.length > 1;

                return (
                  <tr
                    key={draft._rowId}
                    className={`transition-colors ${
                      hasText ? 'bg-blue-50/25' : 'bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-1.5 pl-2.5 sm:pl-4 pr-1 text-center align-middle">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          hasText
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'border border-dashed border-blue-300 text-blue-500 bg-blue-50/40'
                        }`}
                      >
                        {hasText ? enrolledRows.length + dIdx + 1 : '+'}
                      </span>
                    </td>

                    <td className="py-1 px-1 sm:px-2 align-middle">
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
                            ? 'Tap to type SURNAME FIRSTNAME'
                            : 'Tap to add learner...'
                        }
                        enterKeyHint="next"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-label={`New learner row ${dIdx + 1}`}
                        className="w-full px-2 py-2 sm:py-1.5 rounded-lg text-base sm:text-sm font-semibold uppercase tracking-tight bg-transparent text-slate-800 placeholder:normal-case placeholder:font-normal placeholder:text-slate-300 hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-blue-500/35 outline-none transition-all"
                      />
                    </td>

                    <td className="py-1.5 px-1 text-center align-middle">
                      {renderGenderPills(
                        draft.gender,
                        (code) => handleDraftGenderTap(draft._rowId, code),
                        false
                      )}
                    </td>

                    <td className="py-1.5 pr-2 sm:pr-3 text-center align-middle">
                      {canClearDraft && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRow(draft._rowId)}
                          title="Clear row"
                          aria-label="Clear row"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all touch-manipulation"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Empty state when search/filter hides all rows */}
              {visibleEnrolledRows.length === 0 && visibleDraftRows.length === 0 && (
                <tr>
                  <td colSpan={isReadOnly ? 3 : 4} className="py-10 px-4 text-center text-sm text-slate-400">
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
                          className="text-xs font-bold text-blue-600 hover:underline"
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

        {/* Table Footer Controls */}
        <div className="px-3.5 sm:px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{stats.total}</span> total ·{' '}
            <span className="text-blue-600 font-semibold">{stats.boys} Boys</span> ·{' '}
            <span className="text-rose-600 font-semibold">{stats.girls} Girls</span>
            {stats.unset > 0 && (
              <span className="text-amber-600 font-semibold"> · {stats.unset} Unset</span>
            )}
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddFiveBlankRows}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-600 active:scale-95 transition-all touch-manipulation"
              >
                <Plus className="w-3.5 h-3.5" />
                5 Blank Rows
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating / Sticky Mobile Save Bar */}
      {showStickySaveBar && (
        <div className="fixed bottom-3 left-2.5 right-2.5 sm:sticky sm:bottom-4 z-30 max-w-2xl mx-auto">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/60 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  saveStatus === 'error' || changeSummary.blankCount > 0
                    ? 'bg-red-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-xs sm:text-sm font-semibold truncate">
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
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
              )}

              <button
                type="button"
                disabled={saveStatus === 'saving'}
                onClick={() => commitSave({ silent: false, allowReorder: true })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60 active:scale-95 transition-all shadow-sm touch-manipulation"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {changeSummary.needsReorder ? 'Save & Sort A–Z' : 'Save Roster'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Line WhatsApp / Notes Paste Modal */}
      {pasteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPasteModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-800">Paste Class List</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Copy names from WhatsApp or Notes and paste below. Numbering and trailing M/F tags are detected automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none text-base sm:text-sm font-medium text-slate-800 placeholder:text-slate-400"
              autoFocus
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs font-semibold text-slate-500">
                {parsedModalPreview.length > 0 ? (
                  <span className="text-emerald-700">
                    Ready: {parsedModalPreview.length} learner{parsedModalPreview.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  'One learner per line'
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPasteModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedModalPreview.length === 0}
                  onClick={handleConfirmPasteModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation"
                >
                  Add {parsedModalPreview.length > 0 ? parsedModalPreview.length : ''} Rows to Table
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {confirmClearOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmClearOpen(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Clear All {stats.total} Learners?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This clears every learner from <span className="font-semibold text-slate-700">{metadata?.className || 'this class'}</span> for this term and removes their recorded scores.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 touch-manipulation"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roster;
