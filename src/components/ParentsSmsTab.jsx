import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users,
  MessageSquare,
  Phone,
  Send,
  CheckSquare,
  Square,
  History,
  Eye,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Search,
  UserCheck,
  X,
  Check,
  AlertCircle,
  Loader2,
  ClipboardList,
  Settings,
  UserPlus,
  RotateCcw,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_MNOTIFY_SENDER_ID,
  SBA_SMS_TEMPLATES,
  calculateSmsUnits,
  checkSmsServerStatus,
  dispatchParentSmsBatch,
  formatGhanaPhone,
  formatSmsName,
  getSchoolSmsPackageSummary,
  interpolateSmsTemplate,
  isValidGhanaPhone,
  maskApiKey,
  normalizeParentName,
  normalizePhoneInput,
  normalizeSmsSenderId,
  parsePastedParentContacts,
  sendSingleTestSms,
} from '../utils/smsService';
import {
  PARENT_REPORT_TTL_DAYS,
  buildParentReportUrl,
} from '../utils/parentReportHelpers';

const QUICK_TOKEN_CHIPS = [
  '{parent_name}',
  '{student_name}',
  '{total_score}',
  '{average}',
  '{position}',
  '{report_link}',
  '{maths_score}',
  '{science_score}',
  '{attendance}',
  '{remark}',
  '{reopening_date}',
  '{school_name}',
];

function findSubjectScore(subjectsObj, keywords = []) {
  if (!subjectsObj || typeof subjectsObj !== 'object') return undefined;
  const entry = Object.entries(subjectsObj).find(([subName]) => {
    const lower = String(subName || '').toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  });
  if (!entry || entry[1] === undefined || entry[1] === null) return undefined;
  const total = Number(entry[1].total);
  return Number.isFinite(total) ? Math.round(total * 10) / 10 : undefined;
}

/**
 * Interactive Parent Onboarding & Group/Individual SMS Alert Center.
 */
export default function ParentsSmsTab({
  students = [],
  computedResults = [],
  teacherSubjects = [],
  metadata = {},
  viewingTerm = 'Term 1',
  onSaveParentContacts,
  gatewayConfig = {},
  onSaveGatewayConfig,
  institution = null,
  onRecordSmsUsage,
  smsLogs = [],
  onAddSmsLog,
  onPublishParentReports,
  onDeleteParentReports,
  onGoToRoster,
  isReadOnly = false,
}) {
  const contextKey = `${metadata?.schoolName || ''}|${metadata?.year || metadata?.academicYear || ''}|${viewingTerm}|${metadata?.classLevel || ''}`;

  const [subTab, setSubTab] = useState(() =>
    students.length === 0 || students.some((s) => !isValidGhanaPhone(s.parentPhone))
      ? 'onboard'
      : 'sms'
  );

  // --- Parent Contact Draft State (keyed by student.sn) ---
  const buildContactsMap = useCallback((list) => {
    const map = {};
    for (const s of list || []) {
      map[s.sn] = {
        parentName: s.parentName ? String(s.parentName) : '',
        parentPhone: s.parentPhone ? String(s.parentPhone) : '',
      };
    }
    return map;
  }, []);

  const [draftContacts, setDraftContacts] = useState(() => buildContactsMap(students));
  const [contactSaveStatus, setContactSaveStatus] = useState('synced'); // 'synced' | 'pending' | 'saving' | 'error'
  const [onboardSearch, setOnboardSearch] = useState('');
  const [onboardFilter, setOnboardFilter] = useState('ALL'); // 'ALL' | 'ONBOARDED' | 'MISSING'
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteFillMode, setPasteFillMode] = useState('missing'); // 'missing' | 'all'

  // --- SMS Composer & Gateway State ---
  const [selectedTemplateId, setSelectedTemplateId] = useState(SBA_SMS_TEMPLATES[0].id);
  const [messageBody, setMessageBody] = useState(SBA_SMS_TEMPLATES[0].body);
  const [recipientMode, setRecipientMode] = useState('all'); // 'all' | 'selected'
  const [selectedSns, setSelectedSns] = useState(() =>
    students.filter((s) => isValidGhanaPhone(s.parentPhone)).map((s) => s.sn)
  );
  const [previewSn, setPreviewSn] = useState(
    () => students.find((s) => isValidGhanaPhone(s.parentPhone))?.sn ?? null
  );
  const [smsSearch, setSmsSearch] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  const [showTestBar, setShowTestBar] = useState(false);
  const [showGatewayPanel, setShowGatewayPanel] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);

  const isSchoolManaged = Boolean(institution?.id);
  const schoolSmsSummary = useMemo(
    () => (isSchoolManaged ? getSchoolSmsPackageSummary(institution) : null),
    [isSchoolManaged, institution]
  );

  const [gatewayDraft, setGatewayDraft] = useState(() => ({
    provider: gatewayConfig?.provider || 'mnotify',
    senderId: normalizeSmsSenderId(
      (isSchoolManaged ? institution?.smsConfig?.senderId : gatewayConfig?.senderId) ||
        DEFAULT_MNOTIFY_SENDER_ID
    ),
    apiKey: gatewayConfig?.apiKey || '',
    dispatchSecret: gatewayConfig?.dispatchSecret || '',
  }));

  useEffect(() => {
    setGatewayDraft((prev) => ({
      provider: gatewayConfig?.provider || prev.provider || 'mnotify',
      senderId: normalizeSmsSenderId(
        (isSchoolManaged ? institution?.smsConfig?.senderId : gatewayConfig?.senderId) ||
          DEFAULT_MNOTIFY_SENDER_ID
      ),
      apiKey: gatewayConfig?.apiKey || '',
      dispatchSecret: gatewayConfig?.dispatchSecret || '',
    }));
  }, [gatewayConfig, isSchoolManaged, institution?.smsConfig?.senderId]);

  useEffect(() => {
    let active = true;
    checkSmsServerStatus(institution?.id || '').then((status) => {
      if (active && status) setServerStatus(status);
    });
    return () => {
      active = false;
    };
  }, [institution?.id]);

  // Refs for focus progression & safe auto-save / unmount flush
  const parentNameRefs = useRef({});
  const parentPhoneRefs = useRef({});
  const onboardingWrapperRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const isSavingContactsRef = useRef(false);
  const queuedContactSaveRef = useRef(false);
  const lastCommittedContactsRef = useRef(null);
  const prevContextKeyRef = useRef(contextKey);
  const prevStudentsRef = useRef(students);
  const isMountedRef = useRef(true);
  const latestStateRef = useRef({
    draftContacts,
    students,
    isReadOnly,
    onSaveParentContacts,
  });

  useEffect(() => {
    latestStateRef.current = {
      draftContacts,
      students,
      isReadOnly,
      onSaveParentContacts,
    };
  }, [draftContacts, students, isReadOnly, onSaveParentContacts]);

  const computeContactUpdates = useCallback((draftsMap, baseStudents) => {
    const updates = {};
    let changedCount = 0;

    for (const s of baseStudents || []) {
      const draft = draftsMap[s.sn] || {};
      const nextName = normalizeParentName(draft.parentName || '');
      const nextPhone = normalizePhoneInput(draft.parentPhone || '');
      const origName = normalizeParentName(s.parentName || '');
      const origPhone = normalizePhoneInput(s.parentPhone || '');

      if (nextName !== origName || nextPhone !== origPhone) {
        updates[s.sn] = {
          parentName: nextName,
          parentPhone: nextPhone,
        };
        changedCount += 1;
      }
    }

    return { updates, changedCount };
  }, []);

  const clearContactAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  // Sync draftContacts on class/term switch or incoming students update
  useEffect(() => {
    if (prevContextKeyRef.current !== contextKey) {
      prevContextKeyRef.current = contextKey;
      prevStudentsRef.current = students;
      clearContactAutoSave();
      lastCommittedContactsRef.current = null;
      queuedContactSaveRef.current = false;
      setDraftContacts(buildContactsMap(students));
      setContactSaveStatus('synced');
      setOnboardSearch('');
      setOnboardFilter('ALL');
      setPasteModalOpen(false);
      setPasteText('');
      return;
    }

    const prevStudents = prevStudentsRef.current;
    prevStudentsRef.current = students;

    if (lastCommittedContactsRef.current) {
      const committed = lastCommittedContactsRef.current;
      lastCommittedContactsRef.current = null;

      setDraftContacts((prev) => {
        const next = buildContactsMap(students);
        // Preserve any extra edits typed while save was in-flight
        for (const [snStr, entry] of Object.entries(prev)) {
          const sn = Number(snStr);
          if (!(sn in next)) continue;
          const prevName = normalizeParentName(entry.parentName || '');
          const prevPhone = normalizePhoneInput(entry.parentPhone || '');
          const savedEntry = committed[sn];
          if (savedEntry && (prevName !== savedEntry.parentName || prevPhone !== savedEntry.parentPhone)) {
            next[sn] = {
              parentName: entry.parentName,
              parentPhone: entry.parentPhone,
            };
          }
        }
        return next;
      });
      if (!queuedContactSaveRef.current) {
        setContactSaveStatus('synced');
      }
      return;
    }

    const { changedCount } = computeContactUpdates(latestStateRef.current.draftContacts, prevStudents);
    if (changedCount === 0 || prevStudents.length !== students.length) {
      setDraftContacts((prev) => {
        const fresh = buildContactsMap(students);
        if (changedCount === 0) return fresh;
        // Retain local edits on surviving learners if roster count changed externally
        for (const s of students) {
          if (prev[s.sn]) fresh[s.sn] = prev[s.sn];
        }
        return fresh;
      });
    }
  }, [students, contextKey, buildContactsMap, clearContactAutoSave, computeContactUpdates]);

  const commitContactSave = useCallback(
    async ({ silent = false } = {}) => {
      const {
        draftContacts: curDrafts,
        students: curStudents,
        isReadOnly: ro,
        onSaveParentContacts: saveFn,
      } = latestStateRef.current;

      if (ro || typeof saveFn !== 'function') return false;

      if (isSavingContactsRef.current) {
        queuedContactSaveRef.current = true;
        return false;
      }

      const { updates, changedCount } = computeContactUpdates(curDrafts, curStudents);
      if (changedCount === 0) {
        if (isMountedRef.current) setContactSaveStatus('synced');
        return true;
      }

      clearContactAutoSave();
      isSavingContactsRef.current = true;
      if (isMountedRef.current) setContactSaveStatus('saving');
      lastCommittedContactsRef.current = updates;

      try {
        await saveFn(updates);
        if (!silent) {
          toast.success(
            `Saved parent contacts (${changedCount} learner${changedCount === 1 ? '' : 's'} updated)`
          );
        }
        return true;
      } catch (err) {
        lastCommittedContactsRef.current = null;
        console.error('Failed to save parent contacts:', err);
        if (isMountedRef.current) setContactSaveStatus('error');
        toast.error('Could not save parent contacts. Tap Save to retry.');
        return false;
      } finally {
        isSavingContactsRef.current = false;
        if (queuedContactSaveRef.current) {
          queuedContactSaveRef.current = false;
          autoSaveTimerRef.current = setTimeout(() => {
            commitContactSave({ silent: true });
          }, 450);
        }
      }
    },
    [clearContactAutoSave, computeContactUpdates]
  );

  // Flush pending parent contact edits on unmount (switching tabs)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearContactAutoSave();

      const {
        draftContacts: curDrafts,
        students: curStudents,
        isReadOnly: ro,
        onSaveParentContacts: saveFn,
      } = latestStateRef.current;

      if (ro || typeof saveFn !== 'function') return;
      const { updates, changedCount } = computeContactUpdates(curDrafts, curStudents);
      if (changedCount > 0) {
        Promise.resolve(saveFn(updates)).catch((err) => {
          console.error('Unmount parent contacts flush failed:', err);
          toast.error('Could not save pending parent contact edits');
        });
      }
    };
  }, [clearContactAutoSave, computeContactUpdates]);

  const scheduleContactAutoSave = useCallback(
    (delayMs = 900) => {
      clearContactAutoSave();
      autoSaveTimerRef.current = setTimeout(() => {
        commitContactSave({ silent: true });
      }, delayMs);
    },
    [clearContactAutoSave, commitContactSave]
  );

  const pendingContactChanges = useMemo(
    () => computeContactUpdates(draftContacts, students),
    [draftContacts, students, computeContactUpdates]
  );

  useEffect(() => {
    if (isSavingContactsRef.current || contactSaveStatus === 'error') return;
    setContactSaveStatus(pendingContactChanges.changedCount > 0 ? 'pending' : 'synced');
  }, [pendingContactChanges.changedCount, contactSaveStatus]);

  // --- Enrich learners with live parent drafts + computed SBA performance ---
  const enrichedLearners = useMemo(() => {
    const resultBySn = new Map((computedResults || []).map((r) => [r.sn, r]));
    const fallbackSubjectCount = Math.max(1, teacherSubjects?.length || 1);

    return [...(students || [])]
      .sort((a, b) => (Number(a.sn) || 0) - (Number(b.sn) || 0))
      .map((s) => {
        const draft = draftContacts[s.sn] || {};
        const parentName = draft.parentName !== undefined ? draft.parentName : s.parentName || '';
        const parentPhone = draft.parentPhone !== undefined ? draft.parentPhone : s.parentPhone || '';
        const res = resultBySn.get(s.sn);
        const subjectsObj = res?.subjects || {};
        const subjectCount = Math.max(1, Object.keys(subjectsObj).length || fallbackSubjectCount);
        const overallTotal = res ? Number(res.overallTotal || 0) : 0;
        const averageScore = res ? Math.round((overallTotal / subjectCount) * 10) / 10 : 0;

        return {
          ...s,
          parentName,
          parentPhone,
          hasValidPhone: isValidGhanaPhone(parentPhone),
          overallTotal: res ? overallTotal : undefined,
          averageScore: res ? averageScore : undefined,
          overallRank: res?.overallRank || '-',
          classSize: computedResults?.length || students?.length || 0,
          subjects: subjectsObj,
          mathsScore: findSubjectScore(subjectsObj, ['math']),
          scienceScore: findSubjectScore(subjectsObj, ['science']),
          englishScore: findSubjectScore(subjectsObj, ['english']),
        };
      });
  }, [students, draftContacts, computedResults, teacherSubjects]);

  const onboardStats = useMemo(() => {
    const total = enrichedLearners.length;
    const onboarded = enrichedLearners.filter((l) => l.hasValidPhone).length;
    const missing = total - onboarded;
    return { total, onboarded, missing };
  }, [enrichedLearners]);

  // --- Parent Onboarding Filters & Mutations ---
  const visibleOnboardRows = useMemo(() => {
    const q = onboardSearch.trim().toLowerCase();
    return enrichedLearners.filter((row) => {
      if (q) {
        const hay = `${row.name || ''} ${row.parentName || ''} ${row.parentPhone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (onboardFilter === 'ONBOARDED') return row.hasValidPhone;
      if (onboardFilter === 'MISSING') return !row.hasValidPhone;
      return true;
    });
  }, [enrichedLearners, onboardSearch, onboardFilter]);

  const handleContactFieldChange = (sn, field, value) => {
    if (isReadOnly) return;
    setDraftContacts((prev) => ({
      ...prev,
      [sn]: {
        parentName: field === 'parentName' ? value : prev[sn]?.parentName || '',
        parentPhone: field === 'parentPhone' ? value : prev[sn]?.parentPhone || '',
      },
    }));
    if (contactSaveStatus === 'error') setContactSaveStatus('pending');
    scheduleContactAutoSave(900);
  };

  const handleOnboardingBlur = () => {
    setTimeout(() => {
      if (!isMountedRef.current) return;
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      const stillInInputs = Boolean(
        active && active.tagName === 'INPUT' && onboardingWrapperRef.current?.contains(active)
      );
      if (!stillInInputs && pendingContactChanges.changedCount > 0) {
        scheduleContactAutoSave(450);
      }
    }, 120);
  };

  const handleParentNameKeyDown = (e, sn) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const phoneEl = parentPhoneRefs.current[sn];
    if (phoneEl) {
      phoneEl.focus();
      phoneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleParentPhoneKeyDown = (e, sn) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const idx = visibleOnboardRows.findIndex((r) => r.sn === sn);
    if (idx >= 0 && idx + 1 < visibleOnboardRows.length) {
      const nextSn = visibleOnboardRows[idx + 1].sn;
      const nextEl = parentNameRefs.current[nextSn];
      if (nextEl) {
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    e.currentTarget.blur();
  };

  const parsedPastedContacts = useMemo(() => parsePastedParentContacts(pasteText), [pasteText]);

  const handleApplyPastedContacts = () => {
    if (isReadOnly || parsedPastedContacts.length === 0) return;

    const targetRows =
      pasteFillMode === 'missing'
        ? visibleOnboardRows.filter((r) => !r.hasValidPhone)
        : visibleOnboardRows;

    if (targetRows.length === 0) {
      toast.error('No matching learner rows available to fill.');
      return;
    }

    const applyCount = Math.min(targetRows.length, parsedPastedContacts.length);
    setDraftContacts((prev) => {
      const next = { ...prev };
      for (let i = 0; i < applyCount; i += 1) {
        const studentRow = targetRows[i];
        const parsed = parsedPastedContacts[i];
        next[studentRow.sn] = {
          parentName: parsed.parentName || next[studentRow.sn]?.parentName || '',
          parentPhone: parsed.parentPhone || next[studentRow.sn]?.parentPhone || '',
        };
      }
      return next;
    });

    setPasteText('');
    setPasteModalOpen(false);
    scheduleContactAutoSave(700);
    toast.success(`Filled parent details for ${applyCount} learner${applyCount === 1 ? '' : 's'}`);
  };

  const handleDiscardContactChanges = () => {
    clearContactAutoSave();
    setDraftContacts(buildContactsMap(students));
    setContactSaveStatus('synced');
    toast('Unsaved contact edits discarded');
  };

  const handleJumpToAddPhone = (sn) => {
    setOnboardFilter('ALL');
    setOnboardSearch('');
    setSubTab('onboard');
    setTimeout(() => {
      const phoneEl = parentPhoneRefs.current[sn];
      if (phoneEl) {
        phoneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneEl.focus();
      }
    }, 80);
  };

  // --- SMS Center Logic ---
  const eligibleRecipients = useMemo(
    () => enrichedLearners.filter((l) => l.hasValidPhone),
    [enrichedLearners]
  );

  useEffect(() => {
    const eligibleSet = new Set(eligibleRecipients.map((r) => r.sn));
    if (recipientMode === 'all') {
      setSelectedSns(eligibleRecipients.map((r) => r.sn));
    } else {
      setSelectedSns((prev) => prev.filter((sn) => eligibleSet.has(sn)));
    }
    setPreviewSn((prev) =>
      eligibleSet.has(prev) ? prev : eligibleRecipients[0]?.sn ?? null
    );
  }, [eligibleRecipients, recipientMode]);

  const filteredSmsRecipients = useMemo(() => {
    const q = smsSearch.trim().toLowerCase();
    if (!q) return enrichedLearners;
    return enrichedLearners.filter(
      (r) =>
        String(r.parentName || '').toLowerCase().includes(q) ||
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.parentPhone || '').toLowerCase().includes(q)
    );
  }, [enrichedLearners, smsSearch]);

  const handleSwitchAudienceMode = (mode) => {
    if (mode === 'all') {
      setRecipientMode('all');
      setSelectedSns(eligibleRecipients.map((r) => r.sn));
      return;
    }
    setRecipientMode('selected');
    if (selectedSns.length === eligibleRecipients.length && eligibleRecipients.length > 1) {
      setSelectedSns([]);
    }
  };

  const selectSmsGroup = (group) => {
    if (group === 'all') {
      setRecipientMode('all');
      setSelectedSns(eligibleRecipients.map((r) => r.sn));
      return;
    }
    setRecipientMode('selected');
    if (group === 'none') {
      setSelectedSns([]);
      return;
    }
    let matched = [];
    if (group === 'top') {
      matched = eligibleRecipients.filter((r) => (r.averageScore ?? 0) >= 70);
    } else if (group === 'support') {
      matched = eligibleRecipients.filter((r) => r.averageScore !== undefined && r.averageScore < 50);
    } else if (group === 'stem') {
      matched = eligibleRecipients.filter(
        (r) =>
          (r.mathsScore !== undefined && r.mathsScore < 50) ||
          (r.scienceScore !== undefined && r.scienceScore < 50)
      );
    } else if (group === 'boys') {
      matched = eligibleRecipients.filter((r) => String(r.gender || '').toUpperCase() === 'M');
    } else if (group === 'girls') {
      matched = eligibleRecipients.filter((r) => String(r.gender || '').toUpperCase() === 'F');
    }

    setSelectedSns(matched.map((r) => r.sn));
    if (matched[0]) setPreviewSn(matched[0].sn);
    if (matched.length === 0) {
      toast('No onboarded parents matched that quick group filter.');
    }
  };

  const toggleSmsRecipient = (sn) => {
    const target = enrichedLearners.find((r) => r.sn === sn);
    if (!target || !target.hasValidPhone) {
      toast.error('Add a valid Ghanaian phone number for this parent first.');
      return;
    }
    setRecipientMode('selected');
    setPreviewSn(sn);
    setSelectedSns((prev) =>
      prev.includes(sn) ? prev.filter((item) => item !== sn) : [...prev, sn]
    );
  };

  const selectOnlySmsRecipient = (e, sn) => {
    e.stopPropagation();
    const target = enrichedLearners.find((r) => r.sn === sn);
    if (!target || !target.hasValidPhone) return;
    setRecipientMode('selected');
    setSelectedSns([sn]);
    setPreviewSn(sn);
  };

  const previewStudent = useMemo(
    () =>
      eligibleRecipients.find((r) => r.sn === previewSn) ||
      eligibleRecipients[0] ||
      enrichedLearners[0],
    [eligibleRecipients, previewSn, enrichedLearners]
  );

  const previewText = useMemo(() => {
    if (!previewStudent) return messageBody;
    return interpolateSmsTemplate(messageBody, {
      parentName: previewStudent.parentName,
      studentName: previewStudent.name,
      className: metadata?.classLevel || 'Class',
      term: viewingTerm || metadata?.term || 'Term 1',
      totalScore: previewStudent.overallTotal,
      average: previewStudent.averageScore,
      position: previewStudent.overallRank,
      mathsScore: previewStudent.mathsScore,
      scienceScore: previewStudent.scienceScore,
      englishScore: previewStudent.englishScore,
      attendance: previewStudent.attendance,
      timesOpen: metadata?.timesOpen,
      conduct: previewStudent.conduct,
      remark: previewStudent.remarks,
      reopeningDate: metadata?.nextTermBegins,
      ptaDate: metadata?.ptaDate,
      reportLink: buildParentReportUrl('k8x2m9pqab'),
      schoolName: metadata?.schoolName,
    });
  }, [messageBody, previewStudent, metadata, viewingTerm]);

  const activeSenderId = normalizeSmsSenderId(
    (isSchoolManaged ? schoolSmsSummary?.senderId : gatewayDraft?.senderId) ||
      DEFAULT_MNOTIFY_SENDER_ID
  );

  const liveGatewayConfig = useMemo(() => {
    const isLocalVite =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return {
      provider: gatewayDraft.provider || 'mnotify',
      senderId: activeSenderId,
      institutionId: institution?.id || '',
      apiKey: isSchoolManaged
        ? isLocalVite
          ? schoolSmsSummary?.apiKey || ''
          : ''
        : gatewayDraft.apiKey || '',
      dispatchSecret: gatewayDraft.dispatchSecret || '',
    };
  }, [gatewayDraft, activeSenderId, isSchoolManaged, institution?.id, schoolSmsSummary?.apiKey]);

  const handleSaveGateway = async () => {
    const cleanConfig = {
      ...gatewayDraft,
      senderId: isSchoolManaged ? activeSenderId : normalizeSmsSenderId(gatewayDraft.senderId),
      apiKey: isSchoolManaged ? '' : String(gatewayDraft.apiKey || '').trim(),
      dispatchSecret: String(gatewayDraft.dispatchSecret || '').trim(),
    };
    setGatewayDraft(cleanConfig);
    if (onSaveGatewayConfig) {
      await onSaveGatewayConfig(cleanConfig);
    }
    toast.success(
      `SMS preferences saved (${cleanConfig.provider === 'simulation' ? 'Simulation Mode' : activeSenderId || 'mNotify'})`
    );
    setShowGatewayPanel(false);
  };

  const handleSendTestSms = async () => {
    if (!isValidGhanaPhone(testPhone)) {
      toast.error('Enter a valid Ghanaian phone number (e.g. 0244123456).');
      return;
    }
    if (gatewayDraft.provider !== 'simulation' && isSchoolManaged) {
      if (!schoolSmsSummary?.isGatewayReady && !serverStatus?.configured) {
        toast.error(
          `${institution.schoolName} has no SMS API key or Sender ID configured yet. Ask your School Admin or Super Admin.`
        );
        return;
      }
      if (schoolSmsSummary?.isExhausted) {
        toast.error(
          `${institution.schoolName} has 0 SMS package credits remaining. Ask Senior Super User to top up.`
        );
        return;
      }
    }
    setSendingTest(true);
    try {
      const res = await sendSingleTestSms({
        phone: testPhone,
        metadata,
        gatewayConfig: liveGatewayConfig,
        smsPackage: isSchoolManaged ? schoolSmsSummary : null,
        institutionId: institution?.id || '',
      });
      if (res.failedCount > 0) {
        const reason = res.failures?.[0]?.reason || 'Delivery failed';
        toast.error(`Test SMS failed: ${reason}`);
      } else {
        if (res.creditsConsumed > 0 && res.mode !== 'Simulation Mode' && onRecordSmsUsage) {
          await onRecordSmsUsage(res.creditsConsumed, {
            latestMnotifyCreditLeft: res.latestMnotifyCreditLeft,
          });
        }
        if (onAddSmsLog) {
          onAddSmsLog({
            id: `sms-${Date.now()}`,
            timestamp: new Date().toLocaleString(),
            category: 'Gateway Test SMS',
            gateway: `${res.mode} (${activeSenderId || 'No Sender'})`,
            recipientCount: 1,
            deliveredCount: 1,
            creditsUsed: res.creditsConsumed || 0,
            sampleMessage: res.dispatches?.[0]?.message || `Test SMS (${activeSenderId})`,
          });
        }
        toast.success(`Test SMS delivered to ${testPhone} via ${activeSenderId}!`);
      }
    } catch (err) {
      toast.error(`Test SMS error: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const executeSmsDispatch = async (targetRecipients) => {
    if (targetRecipients.length === 0) {
      toast.error('Select at least one onboarded parent with a valid phone number.');
      return;
    }
    if (!messageBody.trim()) {
      toast.error('SMS message cannot be empty.');
      return;
    }
    if (gatewayDraft.provider !== 'simulation' && isSchoolManaged) {
      if (!schoolSmsSummary?.isGatewayReady && !serverStatus?.configured) {
        toast.error(
          `${institution.schoolName} does not have an SMS API key or Sender ID configured yet. Ask your School Admin or Super Admin to set it up.`
        );
        return;
      }
      if (schoolSmsSummary?.isExhausted) {
        toast.error(
          `${institution.schoolName} has exhausted its SMS package credits (0 left). Ask Senior Super User to top up.`
        );
        return;
      }
    }

    setIsSendingSms(true);
    let createdReportTokens = [];
    try {
      let recipientsWithLinks = targetRecipients;
      const wantsReportLink = messageBody.includes('{report_link}');

      if (wantsReportLink) {
        const isLiveProvider = liveGatewayConfig?.provider !== 'simulation';
        if (isLiveProvider && onPublishParentReports) {
          const validTargets = targetRecipients.filter((r) => isValidGhanaPhone(r.parentPhone));
          const published = await onPublishParentReports(validTargets);
          createdReportTokens = published?.createdTokens || [];
          recipientsWithLinks = targetRecipients.map((rec) => ({
            ...rec,
            reportToken: published?.linksBySn?.[rec.sn]?.token || '',
            reportLink: published?.linksBySn?.[rec.sn]?.url || '',
          }));
        } else {
          recipientsWithLinks = targetRecipients.map((rec) => ({
            ...rec,
            reportLink: buildParentReportUrl(`sim${String(rec.sn || 1).padStart(7, '0')}`),
          }));
        }
      }

      const result = await dispatchParentSmsBatch({
        recipients: recipientsWithLinks,
        messageTemplate: messageBody,
        metadata,
        viewingTerm,
        gatewayConfig: liveGatewayConfig,
        smsPackage: isSchoolManaged ? schoolSmsSummary : null,
        institutionId: institution?.id || '',
      });

      // Clean up unused snapshots for any recipients whose SMS failed to send
      if (createdReportTokens.length > 0 && onDeleteParentReports) {
        const tokensToRevoke =
          result.deliveredCount === 0
            ? createdReportTokens
            : (result.failures || []).map((f) => f.reportToken).filter(Boolean);
        if (tokensToRevoke.length > 0) {
          onDeleteParentReports(tokensToRevoke).catch(console.warn);
        }
      }

      if (result.creditsConsumed > 0 && result.mode !== 'Simulation Mode' && onRecordSmsUsage) {
        await onRecordSmsUsage(result.creditsConsumed, {
          latestMnotifyCreditLeft: result.latestMnotifyCreditLeft,
        });
      }

      const tplLabel =
        SBA_SMS_TEMPLATES.find((t) => t.id === selectedTemplateId)?.label || 'Custom Broadcast';

      if (onAddSmsLog) {
        onAddSmsLog({
          id: `sms-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          category: tplLabel,
          gateway: `${result.mode} (${activeSenderId || 'Default'})`,
          recipientCount: result.total,
          deliveredCount: result.deliveredCount,
          creditsUsed: result.creditsConsumed || 0,
          sampleMessage: result.dispatches?.[0]?.message || messageBody,
        });
      }

      if (result.failedCount > 0) {
        const firstReason = result.failures?.[0]?.reason;
        const msg = `Sent ${result.deliveredCount}/${result.total} SMS via ${activeSenderId} (${result.failedCount} failed${firstReason ? `: ${firstReason}` : ''}).`;
        if (result.deliveredCount === 0) toast.error(msg);
        else toast.success(msg);
      } else {
        const creditsNote =
          result.creditsConsumed > 0 ? ` (${result.creditsConsumed} credits used)` : '';
        toast.success(
          `Successfully sent ${result.deliveredCount} personalized SMS via ${activeSenderId}${creditsNote}!`
        );
      }
    } catch (err) {
      if (createdReportTokens.length > 0 && onDeleteParentReports) {
        onDeleteParentReports(createdReportTokens).catch(console.warn);
      }
      toast.error(`SMS dispatch error: ${err.message}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSendSelected = () => {
    const selected = eligibleRecipients.filter((r) => selectedSns.includes(r.sn));
    return executeSmsDispatch(selected);
  };

  const handleSendToAll = () => {
    setRecipientMode('all');
    setSelectedSns(eligibleRecipients.map((r) => r.sn));
    return executeSmsDispatch(eligibleRecipients);
  };

  const selectedCount = selectedSns.length;
  const allEligibleCount = eligibleRecipients.length;
  const isAllSelected = allEligibleCount > 0 && selectedCount === allEligibleCount;

  const renderContactSavePill = () => {
    if (isReadOnly) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Read-Only Term
        </span>
      );
    }
    if (contactSaveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving…
        </span>
      );
    }
    if (contactSaveStatus === 'error') {
      return (
        <button
          type="button"
          onClick={() => commitContactSave({ silent: false })}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 touch-manipulation"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Retry Save
        </button>
      );
    }
    if (contactSaveStatus === 'pending') {
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
        Contacts Synced
      </span>
    );
  };

  const showStickySaveBar =
    subTab === 'onboard' &&
    !isReadOnly &&
    (pendingContactChanges.changedCount > 0 || contactSaveStatus === 'error');

  return (
    <div className={`space-y-4 ${showStickySaveBar ? 'pb-24 sm:pb-8' : 'pb-6'}`}>
      {/* Top Banner & Sub-View Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                Parents &amp; SMS Alerts
              </h2>
              {metadata?.classLevel && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
                  {metadata.classLevel}
                </span>
              )}
              {renderContactSavePill()}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Onboard parents for <span className="font-semibold text-slate-700">{onboardStats.total}</span> enrolled learners, then send individual or group SMS notices.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {isSchoolManaged && schoolSmsSummary && (
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border ${
                  !schoolSmsSummary.hasPackage || schoolSmsSummary.isExhausted
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : schoolSmsSummary.isLowBalance
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                {schoolSmsSummary.enforceQuota
                  ? `${schoolSmsSummary.creditsRemaining.toLocaleString()} / ${schoolSmsSummary.creditsAllocated.toLocaleString()} SMS Left`
                  : `${schoolSmsSummary.packageName} (Unlimited)`}
              </span>
            )}

            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border ${
                gatewayDraft.provider === 'simulation'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : isSchoolManaged && !schoolSmsSummary?.isGatewayReady && !serverStatus?.configured
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {gatewayDraft.provider === 'simulation'
                ? 'Simulation Mode'
                : activeSenderId
                  ? 'mNotify Live'
                  : 'SMS Key Not Set'}{' '}
              • <strong className="font-mono">{activeSenderId || 'Unset'}</strong>
            </span>

            <button
              type="button"
              onClick={() => setShowTestBar((v) => !v)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 touch-manipulation"
            >
              <Send className="w-3.5 h-3.5" />
              {showTestBar ? 'Hide Test' : 'Test SMS'}
            </button>

            <button
              type="button"
              onClick={() => setShowGatewayPanel((v) => !v)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 touch-manipulation"
            >
              <Settings className="w-3.5 h-3.5" />
              {isSchoolManaged ? 'Gateway & Package' : 'Gateway Settings'}
            </button>
          </div>
        </div>

        {/* Sub-Tab Toggle Pills */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSubTab('onboard')}
            className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 touch-manipulation ${
              subTab === 'onboard'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5 truncate">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>1. Onboard Parents</span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  subTab === 'onboard' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {onboardStats.onboarded}/{onboardStats.total} ready ·{' '}
                {onboardStats.missing > 0 ? `${onboardStats.missing} missing phone` : 'All onboarded'}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-extrabold shrink-0 ${
                subTab === 'onboard'
                  ? 'bg-white/20 text-white'
                  : onboardStats.missing > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {onboardStats.onboarded}/{onboardStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('sms')}
            className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 touch-manipulation ${
              subTab === 'sms'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                : 'bg-emerald-50/60 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5 truncate">
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>2. Send SMS Alerts</span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  subTab === 'sms' ? 'text-emerald-100' : 'text-emerald-700'
                }`}
              >
                Group or 1-on-1 parent text alerts
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-extrabold shrink-0 ${
                subTab === 'sms'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {allEligibleCount}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible 1-SMS Test Bar */}
      {showTestBar && (
        <div className="bg-white rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-600 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-600">
            Verify SMS delivery with a single test text via Sender ID{' '}
            <strong className="font-mono text-emerald-700">{activeSenderId}</strong>:
          </div>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="e.g. 0244123456"
              className="flex-1 sm:w-44 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
            />
            <button
              type="button"
              disabled={sendingTest}
              onClick={handleSendTestSms}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 touch-manipulation"
            >
              {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sendingTest ? 'Sending…' : 'Send Test SMS'}
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Gateway Configuration Panel */}
      {showGatewayPanel && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-700" />
                {isSchoolManaged
                  ? `${institution.schoolName} — School SMS Gateway & Package`
                  : 'mNotify SMS Gateway Configuration'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSchoolManaged
                  ? 'API Key, Sender ID, and SMS package credits are scoped strictly to this school and managed by your School Admin or Senior Super User.'
                  : serverStatus?.configured
                    ? 'Server proxy /api/send-sms has a cloud key ready — you can leave API Key blank or enter your own class/school mNotify key.'
                    : 'Enter your mNotify API key for live texts, or use Simulation Mode to preview and log deliveries at zero cost.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGatewayPanel(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close gateway settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isSchoolManaged && schoolSmsSummary ? (
            <div className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Sender ID</div>
                  <div className="text-sm font-mono font-extrabold text-slate-900 mt-1">
                    {schoolSmsSummary.senderId || 'Not Configured'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">School API Key</div>
                  <div className="text-sm font-mono font-bold text-slate-900 mt-1">
                    {schoolSmsSummary.hasApiKey
                      ? maskApiKey(schoolSmsSummary.apiKey)
                      : 'Not Configured'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">SMS Package</div>
                  <div className="text-sm font-bold text-indigo-700 mt-1">
                    {schoolSmsSummary.packageName}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Credits Left</div>
                  <div className="text-sm font-extrabold text-emerald-700 mt-1">
                    {schoolSmsSummary.enforceQuota
                      ? `${schoolSmsSummary.creditsRemaining.toLocaleString()} / ${schoolSmsSummary.creditsAllocated.toLocaleString()}`
                      : 'Unlimited'}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    Class Testing Mode
                  </label>
                  <select
                    value={gatewayDraft.provider}
                    onChange={(e) =>
                      setGatewayDraft((prev) => ({ ...prev, provider: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="mnotify">mNotify Live SMS (Uses School Package)</option>
                    <option value="simulation">Simulation Mode (No Cost / Practice)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGatewayPanel(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGateway}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800"
                  >
                    Save Mode
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Gateway Mode</label>
                  <select
                    value={gatewayDraft.provider}
                    onChange={(e) => setGatewayDraft((prev) => ({ ...prev, provider: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="mnotify">mNotify Live SMS</option>
                    <option value="simulation">Simulation Mode (No Cost)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Sender ID (Max 11 chars)</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={gatewayDraft.senderId}
                    onChange={(e) => setGatewayDraft((prev) => ({ ...prev, senderId: e.target.value }))}
                    placeholder="e.g. SchoolSBA"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">mNotify API Key</label>
                  <input
                    type="password"
                    value={gatewayDraft.apiKey}
                    onChange={(e) => setGatewayDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter mNotify API key"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Server Dispatch PIN (Optional)</label>
                  <input
                    type="password"
                    value={gatewayDraft.dispatchSecret}
                    onChange={(e) =>
                      setGatewayDraft((prev) => ({ ...prev, dispatchSecret: e.target.value }))
                    }
                    placeholder="Only if configured on server"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGatewayPanel(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGateway}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  Save Gateway Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: MOBILE-FIRST PARENT ONBOARDING SHEET                       */}
      {/* ===================================================================== */}
      {subTab === 'onboard' && (
        <>
          {students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Learners Onboarded Yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Add your class learners in the <strong>Roster</strong> tab first, then come back here to tap and enter each parent or guardian&apos;s name and phone number.
              </p>
              {onGoToRoster && (
                <button
                  type="button"
                  onClick={onGoToRoster}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm touch-manipulation"
                >
                  <Users className="w-4 h-4" />
                  Go to Roster Tab
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Filter Chips + Search + Paste Contacts Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOnboardFilter('ALL')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                      onboardFilter === 'ALL'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    All <span className="opacity-80 ml-0.5">{onboardStats.total}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardFilter('ONBOARDED')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                      onboardFilter === 'ONBOARDED'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    Onboarded <span className="opacity-80 ml-0.5">{onboardStats.onboarded}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardFilter('MISSING')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                      onboardFilter === 'MISSING'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : onboardStats.missing > 0
                        ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 animate-pulse'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Missing Phone <span className="ml-0.5 font-extrabold">{onboardStats.missing}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={onboardSearch}
                      onChange={(e) => setOnboardSearch(e.target.value)}
                      placeholder="Search learner, parent, or phone..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                    />
                    {onboardSearch && (
                      <button
                        type="button"
                        onClick={() => setOnboardSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setPasteModalOpen(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all touch-manipulation"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>Paste Contacts</span>
                    </button>
                  )}
                </div>
              </div>

              {isReadOnly && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-amber-800 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  This archived term is read-only. Switch to the active term to edit parent details.
                </div>
              )}

              {/* Responsive Spreadsheet Table / Mobile Cards */}
              <div
                ref={onboardingWrapperRef}
                onBlur={handleOnboardingBlur}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
              >
                {/* Desktop Column Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="col-span-4 pl-1"># &amp; Enrolled Learner</div>
                  <div className="col-span-4">Parent / Guardian Name</div>
                  <div className="col-span-4">Telephone Number (Ghana SMS)</div>
                </div>

                <div className="divide-y divide-slate-100 md:max-h-[64vh] md:overflow-y-auto">
                  {visibleOnboardRows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      No learners match your current filter.
                    </div>
                  ) : (
                    visibleOnboardRows.map((row, idx) => {
                      const rawPhone = String(row.parentPhone || '');
                      const digitsCount = rawPhone.replace(/\D/g, '').length;
                      const phoneInvalid = digitsCount > 0 && !row.hasValidPhone;

                      return (
                        <div
                          key={row.sn}
                          className={`p-3 sm:px-4 sm:py-2.5 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center transition-colors ${
                            !row.hasValidPhone && digitsCount === 0
                              ? 'border-l-[3px] border-l-amber-400 bg-white'
                              : phoneInvalid
                              ? 'border-l-[3px] border-l-red-400 bg-red-50/30'
                              : idx % 2 === 1
                              ? 'bg-slate-50/40'
                              : 'bg-white'
                          }`}
                        >
                          {/* Learner Identity */}
                          <div className="md:col-span-4 flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 text-xs font-bold text-slate-400 tabular-nums shrink-0 text-center">
                                {row.sn}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                  {row.name}
                                </div>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                  String(row.gender).toUpperCase() === 'M'
                                    ? 'bg-blue-100 text-blue-700'
                                    : String(row.gender).toUpperCase() === 'F'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {row.gender || 'U'}
                              </span>
                            </div>
                          </div>

                          {/* Parent / Guardian Name Input */}
                          <div className="md:col-span-4">
                            <input
                              ref={(el) => {
                                if (el) parentNameRefs.current[row.sn] = el;
                                else delete parentNameRefs.current[row.sn];
                              }}
                              type="text"
                              readOnly={isReadOnly}
                              value={row.parentName}
                              onChange={(e) =>
                                handleContactFieldChange(row.sn, 'parentName', e.target.value)
                              }
                              onKeyDown={(e) => handleParentNameKeyDown(e, row.sn)}
                              placeholder="Tap to type parent name..."
                              enterKeyHint="next"
                              autoCapitalize="words"
                              aria-label={`Parent name for ${row.name}`}
                              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-xl border text-base sm:text-sm font-medium outline-none transition-all ${
                                isReadOnly
                                  ? 'bg-slate-50 border-transparent text-slate-600'
                                  : 'bg-slate-50/70 border-slate-200 text-slate-800 placeholder:text-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25'
                              }`}
                            />
                          </div>

                          {/* Telephone Number Input + Status Badge */}
                          <div className="md:col-span-4 relative">
                            <input
                              ref={(el) => {
                                if (el) parentPhoneRefs.current[row.sn] = el;
                                else delete parentPhoneRefs.current[row.sn];
                              }}
                              type="tel"
                              inputMode="tel"
                              readOnly={isReadOnly}
                              value={row.parentPhone}
                              onChange={(e) =>
                                handleContactFieldChange(row.sn, 'parentPhone', e.target.value)
                              }
                              onKeyDown={(e) => handleParentPhoneKeyDown(e, row.sn)}
                              placeholder="024XXXXXXX"
                              enterKeyHint="next"
                              aria-label={`Parent phone for ${row.name}`}
                              className={`w-full pl-3 pr-8 py-2 sm:py-1.5 rounded-xl border text-base sm:text-sm font-mono outline-none transition-all ${
                                phoneInvalid
                                  ? 'bg-white border-red-400 text-red-700 focus:ring-2 focus:ring-red-400/25'
                                  : row.hasValidPhone
                                  ? 'bg-emerald-50/40 border-emerald-300 text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25'
                                  : 'bg-slate-50/70 border-slate-200 text-slate-800 placeholder:text-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25'
                              }`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                              {row.hasValidPhone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : phoneInvalid ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              ) : null}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Action to Jump to Send SMS */}
                {onboardStats.onboarded > 0 && (
                  <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 font-medium">
                      <strong className="text-emerald-700">{onboardStats.onboarded}</strong> of{' '}
                      <strong>{onboardStats.total}</strong> parents ready to receive SMS alerts.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubTab('sms')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm touch-manipulation"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Compose Group / Individual SMS
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 2: GROUP & INDIVIDUAL PARENT SMS ALERT CENTER                 */}
      {/* ===================================================================== */}
      {subTab === 'sms' && (
        <div className="space-y-4">
          {onboardStats.onboarded === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-900 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                No parents have valid Ghanaian telephone numbers yet. Add at least one number in{' '}
                <strong>Onboard Parents</strong> to text parents.
              </div>
              <button
                type="button"
                onClick={() => setSubTab('onboard')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold touch-manipulation"
              >
                Onboard Parents Now
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Left Column: Composer & Live Preview */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
                {/* 1. Group vs Individual Switcher */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    1. Choose Texting Mode (Group or Individual)
                  </label>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchAudienceMode('all')}
                      className={`px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between touch-manipulation ${
                        recipientMode === 'all' && isAllSelected
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                          : 'bg-slate-50 border-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Group: All Onboarded Parents
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            recipientMode === 'all' && isAllSelected
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Every parent with a valid phone ({allEligibleCount})
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                          recipientMode === 'all' && isAllSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {allEligibleCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchAudienceMode('selected')}
                      className={`px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between touch-manipulation ${
                        recipientMode === 'selected' || !isAllSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 hover:border-amber-500'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          Individual or Custom Group
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            recipientMode === 'selected' || !isAllSelected
                              ? 'text-amber-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Tick specific parents or tap &ldquo;Only&rdquo; for 1-on-1
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                          recipientMode === 'selected' || !isAllSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedCount}/{allEligibleCount}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Template Selector */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    2. Choose SBA Message Template
                  </label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {SBA_SMS_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(tpl.id);
                          setMessageBody(tpl.body);
                        }}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors touch-manipulation ${
                          selectedTemplateId === tpl.id
                            ? 'bg-emerald-800 text-white border-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Message Editor & Quick Placeholder Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      3. Edit SMS Content
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {previewText.length} chars (
                      {previewText.length <= 160
                        ? '1 SMS page'
                        : `${Math.ceil(previewText.length / 153)} SMS pages`}
                      )
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs leading-relaxed text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {QUICK_TOKEN_CHIPS.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => setMessageBody((prev) => `${prev} ${token}`)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-[10px] font-mono font-semibold text-slate-600 hover:text-emerald-800 transition-colors touch-manipulation"
                      >
                        +{token}
                      </button>
                    ))}
                  </div>
                  {messageBody.includes('{report_link}') && (
                    <p className="mt-2 text-[11px] font-medium text-emerald-700 bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1.5">
                      Each SMS includes a unique mobile result link valid for {PARENT_REPORT_TTL_DAYS} days (automatically deactivated &amp; cleaned up afterward).
                    </p>
                  )}
                </div>

                {/* Live Interpolated Preview */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 shrink-0">
                      <Eye className="w-3.5 h-3.5" /> Live SMS Preview ({activeSenderId})
                    </span>
                    {eligibleRecipients.length > 0 && (
                      <select
                        value={previewStudent?.sn || ''}
                        onChange={(e) => setPreviewSn(Number(e.target.value))}
                        className="text-xs font-bold bg-white border border-emerald-200 rounded-lg px-2 py-1 outline-none max-w-full sm:max-w-[290px]"
                      >
                        {eligibleRecipients.map((r) => (
                          <option key={r.sn} value={r.sn}>
                            {r.sn}. {formatSmsName(r.parentName || 'Parent')} (
                            {formatSmsName(r.name)})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    {previewText}
                  </p>
                  {gatewayDraft.provider !== 'simulation' && (
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 border-t border-emerald-200/70">
                      <span>
                        Est. SMS credits:{' '}
                        <strong>
                          {selectedCount * Math.max(1, calculateSmsUnits(previewText || messageBody))}
                        </strong>{' '}
                        ({Math.max(1, calculateSmsUnits(previewText || messageBody))} unit/parent)
                      </span>
                      {isSchoolManaged && schoolSmsSummary && (
                        <span
                          className={
                            schoolSmsSummary.isExhausted
                              ? 'text-rose-700 font-bold'
                              : 'text-emerald-800 font-bold'
                          }
                        >
                          School Balance:{' '}
                          {schoolSmsSummary.enforceQuota
                            ? `${schoolSmsSummary.creditsRemaining.toLocaleString()} credits left`
                            : 'Unlimited'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {gatewayDraft.provider !== 'simulation' &&
                  isSchoolManaged &&
                  schoolSmsSummary &&
                  (!schoolSmsSummary.isGatewayReady && !serverStatus?.configured ? (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {institution.schoolName} does not have an mNotify API key or Sender ID configured yet. Ask your School Admin or Senior Super User to configure SMS settings.
                      </span>
                    </div>
                  ) : schoolSmsSummary.isExhausted ? (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {institution.schoolName} has 0 SMS package credits remaining. Ask your Senior Super User to top up the school&apos;s SMS package.
                      </span>
                    </div>
                  ) : null)}

                {/* Send Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleSendSelected}
                    disabled={isSendingSms || selectedCount === 0}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/15 transition-all touch-manipulation"
                  >
                    {isSendingSms ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isSendingSms
                      ? 'Sending SMS…'
                      : selectedCount === 0
                      ? 'Select Parent(s) to Send'
                      : isAllSelected
                      ? `Send Group SMS to All ${selectedCount} Parents`
                      : `Send SMS to ${selectedCount} Selected Parent${selectedCount === 1 ? '' : 's'}`}
                  </button>

                  {!isAllSelected && allEligibleCount > 0 && (
                    <button
                      type="button"
                      onClick={handleSendToAll}
                      disabled={isSendingSms}
                      className="py-3 px-4 rounded-xl border-2 border-emerald-700 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 font-extrabold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all touch-manipulation"
                    >
                      <Users className="w-4 h-4" />
                      Send All ({allEligibleCount})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Parent Recipient Picker */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col max-h-[680px]">
              <div className="p-4 border-b border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    Recipients ({selectedCount}/{allEligibleCount} Ready)
                  </h3>
                  <div className="flex gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => selectSmsGroup('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors touch-manipulation ${
                        isAllSelected
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      All ({allEligibleCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => selectSmsGroup('none')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 touch-manipulation"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={smsSearch}
                    onChange={(e) => setSmsSearch(e.target.value)}
                    placeholder="Search parent name, learner, or phone..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {smsSearch && (
                    <button
                      type="button"
                      onClick={() => setSmsSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Group Filter Pills */}
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('top')}
                    className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 touch-manipulation"
                  >
                    Avg ≥ 70%
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('support')}
                    className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 touch-manipulation"
                  >
                    Avg &lt; 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('stem')}
                    className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 touch-manipulation"
                  >
                    Maths/Sci &lt; 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('boys')}
                    className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 touch-manipulation"
                  >
                    Boys&apos; Parents
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('girls')}
                    className="px-2 py-1 rounded bg-pink-50 text-pink-700 hover:bg-pink-100 touch-manipulation"
                  >
                    Girls&apos; Parents
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                {filteredSmsRecipients.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No learners or parents match &ldquo;{smsSearch}&rdquo;.
                  </div>
                ) : (
                  filteredSmsRecipients.map((r) => {
                    const checked = r.hasValidPhone && selectedSns.includes(r.sn);
                    return (
                      <div
                        key={r.sn}
                        onClick={() => {
                          if (r.hasValidPhone) toggleSmsRecipient(r.sn);
                        }}
                        className={`px-4 py-2.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                          !r.hasValidPhone
                            ? 'bg-slate-50/70 text-slate-400'
                            : checked
                            ? 'bg-emerald-50/70 cursor-pointer'
                            : 'hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.hasValidPhone ? (
                            checked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold truncate text-slate-900">
                              {r.sn}. {formatSmsName(r.parentName) || 'Parent/Guardian'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Ward: <strong className="text-slate-700">{formatSmsName(r.name)}</strong>
                              {r.averageScore !== undefined
                                ? ` · Avg ${r.averageScore}% (${r.overallRank})`
                                : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.hasValidPhone ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => selectOnlySmsRecipient(e, r.sn)}
                                title="Send individually to this parent only"
                                className={`px-2 py-1 rounded text-[10px] font-extrabold border transition-colors touch-manipulation ${
                                  selectedCount === 1 && checked
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-500 hover:text-amber-700'
                                }`}
                              >
                                Only
                              </button>
                              <span className="font-mono text-[11px] font-semibold text-emerald-700">
                                {r.parentPhone}
                              </span>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJumpToAddPhone(r.sn);
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-[10px] font-bold touch-manipulation"
                            >
                              Add Phone
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Dispatch History Log */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                SMS Dispatch History ({smsLogs.length})
              </h3>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Recent alerts
              </span>
            </div>
            {smsLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No SMS alerts dispatched yet. Sent broadcasts and individual alerts will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Gateway</th>
                      <th className="px-4 py-2.5 text-center">Delivered</th>
                      <th className="px-4 py-2.5">Sample Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {smsLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono text-[11px] whitespace-nowrap text-slate-600">
                          {log.timestamp}
                        </td>
                        <td className="px-4 py-2.5 font-bold whitespace-nowrap text-slate-800">
                          {log.category}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {log.gateway}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-700">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {log.deliveredCount}/
                            {log.recipientCount}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5 text-slate-600 max-w-md truncate"
                          title={log.sampleMessage}
                        >
                          {log.sampleMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating / Sticky Mobile Save Bar for Parent Onboarding */}
      {showStickySaveBar && (
        <div className="fixed bottom-3 left-2.5 right-2.5 sm:sticky sm:bottom-4 z-30 max-w-2xl mx-auto">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/60 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  contactSaveStatus === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-xs sm:text-sm font-semibold truncate">
                {contactSaveStatus === 'error'
                  ? 'Save failed — check connection'
                  : `${pendingContactChanges.changedCount} parent contact edit${
                      pendingContactChanges.changedCount === 1 ? '' : 's'
                    } ready`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pendingContactChanges.changedCount > 0 && (
                <button
                  type="button"
                  onClick={handleDiscardContactChanges}
                  aria-label="Discard unsaved changes"
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
              )}

              <button
                type="button"
                disabled={contactSaveStatus === 'saving'}
                onClick={() => commitContactSave({ silent: false })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60 active:scale-95 transition-all shadow-sm touch-manipulation"
              >
                {contactSaveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Parent Contacts
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Line Paste Parent Contacts Modal */}
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
                <h3 className="text-base font-bold text-slate-800">Paste Parent Contacts</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paste names &amp; phone numbers copied from WhatsApp or Notes. Each line maps sequentially to the learners currently listed.
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

            <div className="flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPasteFillMode('missing')}
                className={`flex-1 py-2 px-3 rounded-xl border transition-colors ${
                  pasteFillMode === 'missing'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Fill Missing Phones Only
              </button>
              <button
                type="button"
                onClick={() => setPasteFillMode('all')}
                className={`flex-1 py-2 px-3 rounded-xl border transition-colors ${
                  pasteFillMode === 'all'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Overwrite from Row 1
              </button>
            </div>

            <textarea
              rows={7}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'1. Mr. Kofi Mensah - 0244123456\n2. Mrs. Akua Boateng, 0509876543\n3. 0241112233'}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none text-base sm:text-sm font-medium text-slate-800 placeholder:text-slate-400"
              autoFocus
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs font-semibold text-slate-500">
                {parsedPastedContacts.length > 0 ? (
                  <span className="text-emerald-700">
                    Detected {parsedPastedContacts.length} contact row
                    {parsedPastedContacts.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  'One contact per line'
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
                  disabled={parsedPastedContacts.length === 0}
                  onClick={handleApplyPastedContacts}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation"
                >
                  Apply to Table
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
