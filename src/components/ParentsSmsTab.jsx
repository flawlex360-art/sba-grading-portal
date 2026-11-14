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
  CheckCircle2,
  ShieldCheck,
  Search,
  UserCheck,
  X,
  Check,
  AlertCircle,
  Loader2,
  ClipboardList,
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
  normalizeParentName,
  normalizePhoneInput,
  normalizeSmsSenderId,
  parsePastedParentContacts,
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
  const [serverStatus, setServerStatus] = useState(null);

  const isSchoolManaged = Boolean(institution?.id);
  const schoolSmsSummary = useMemo(
    () => (isSchoolManaged ? getSchoolSmsPackageSummary(institution) : null),
    [isSchoolManaged, institution]
  );
  const gatewayProvider = gatewayConfig?.provider || 'mnotify';

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
    (isSchoolManaged ? schoolSmsSummary?.senderId : gatewayConfig?.senderId) ||
      DEFAULT_MNOTIFY_SENDER_ID
  );

  const liveGatewayConfig = useMemo(() => {
    const isLocalVite =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return {
      provider: gatewayProvider,
      senderId: activeSenderId,
      institutionId: institution?.id || '',
      apiKey: isSchoolManaged
        ? isLocalVite
          ? schoolSmsSummary?.apiKey || ''
          : ''
        : gatewayConfig?.apiKey || '',
      dispatchSecret: gatewayConfig?.dispatchSecret || '',
    };
  }, [
    gatewayProvider,
    gatewayConfig?.apiKey,
    gatewayConfig?.dispatchSecret,
    activeSenderId,
    isSchoolManaged,
    institution?.id,
    schoolSmsSummary?.apiKey,
  ]);

  const executeSmsDispatch = async (targetRecipients) => {
    if (targetRecipients.length === 0) {
      toast.error('Select at least one onboarded parent with a valid phone number.');
      return;
    }
    if (!messageBody.trim()) {
      toast.error('SMS message cannot be empty.');
      return;
    }
    if (gatewayProvider !== 'simulation' && isSchoolManaged) {
      if (!schoolSmsSummary?.isGatewayReady && !serverStatus?.configured) {
        toast.error(
          `SMS service is not yet activated for ${institution.schoolName}. Ask your Senior Super User to configure SMS.`
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
          gateway: isSchoolManaged ? result.mode : `${result.mode} (${activeSenderId || 'Default'})`,
          recipientCount: result.total,
          deliveredCount: result.deliveredCount,
          creditsUsed: result.creditsConsumed || 0,
          sampleMessage: result.dispatches?.[0]?.message || messageBody,
        });
      }

      if (result.failedCount > 0) {
        const firstReason = result.failures?.[0]?.reason;
        const senderNote = isSchoolManaged ? '' : ` via ${activeSenderId}`;
        const msg = `Sent ${result.deliveredCount}/${result.total} SMS${senderNote} (${result.failedCount} failed${firstReason ? `: ${firstReason}` : ''}).`;
        if (result.deliveredCount === 0) toast.error(msg);
        else toast.success(msg);
      } else {
        const creditsNote =
          result.creditsConsumed > 0 ? ` (${result.creditsConsumed} credits used)` : '';
        const senderNote = isSchoolManaged ? '' : ` via ${activeSenderId}`;
        toast.success(
          `Successfully sent ${result.deliveredCount} personalized SMS${senderNote}${creditsNote}!`
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
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          Read-Only
        </span>
      );
    }
    if (contactSaveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving
        </span>
      );
    }
    if (contactSaveStatus === 'error') {
      return (
        <button
          type="button"
          onClick={() => commitContactSave({ silent: false })}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-950/60 touch-manipulation"
        >
          <AlertCircle className="w-3 h-3" />
          Retry Save
        </button>
      );
    }
    if (contactSaveStatus === 'pending') {
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

  const showStickySaveBar =
    subTab === 'onboard' &&
    !isReadOnly &&
    (pendingContactChanges.changedCount > 0 || contactSaveStatus === 'error');

  return (
    <div className={`space-y-4 ${showStickySaveBar ? 'pb-24 sm:pb-8' : 'pb-6'}`}>
      {/* Minimalist Top Header & Sub-View Switcher */}
      <div className="glass-card rounded-xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Parents &amp; SMS
            </h2>
            {metadata?.classLevel && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/70 dark:border-zinc-700/70">
                {metadata.classLevel}
              </span>
            )}
            {renderContactSavePill()}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {isSchoolManaged && schoolSmsSummary && (
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border tabular-nums ${
                  !schoolSmsSummary.hasPackage || schoolSmsSummary.isExhausted
                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50'
                    : schoolSmsSummary.isLowBalance
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                {schoolSmsSummary.enforceQuota
                  ? `${schoolSmsSummary.creditsRemaining.toLocaleString()} / ${schoolSmsSummary.creditsAllocated.toLocaleString()} SMS Left`
                  : schoolSmsSummary.packageName}
              </span>
            )}

            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border ${
                gatewayProvider === 'simulation'
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                  : isSchoolManaged && !schoolSmsSummary?.isGatewayReady && !serverStatus?.configured
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50'
                  : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <ShieldCheck
                className={`w-3.5 h-3.5 ${
                  gatewayProvider === 'simulation'
                    ? 'text-amber-600 dark:text-amber-400'
                    : isSchoolManaged && !schoolSmsSummary?.isGatewayReady && !serverStatus?.configured
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              {gatewayProvider === 'simulation' ? (
                'Simulation Mode'
              ) : isSchoolManaged ? (
                schoolSmsSummary?.isGatewayReady || serverStatus?.configured
                  ? 'SMS Ready'
                  : 'SMS Not Activated'
              ) : (
                <>
                  {activeSenderId ? 'SMS Ready' : 'SMS Unset'} ·{' '}
                  <strong className="font-mono">{activeSenderId || 'Unset'}</strong>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Clean Segmented Sub-Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setSubTab('onboard')}
            className={`px-3 py-2 rounded-md text-left transition-all flex items-center justify-between gap-2 touch-manipulation ${
              subTab === 'onboard'
                ? 'bg-white dark:bg-[#0c0c0f] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/70 dark:border-zinc-700/70'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <div className="min-w-0 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold truncate">
                1. Onboard Parents
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                subTab === 'onboard'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {onboardStats.onboarded}/{onboardStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('sms')}
            className={`px-3 py-2 rounded-md text-left transition-all flex items-center justify-between gap-2 touch-manipulation ${
              subTab === 'sms'
                ? 'bg-white dark:bg-[#0c0c0f] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/70 dark:border-zinc-700/70'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <div className="min-w-0 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold truncate">
                2. Send SMS Alerts
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                subTab === 'sms'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {allEligibleCount}
            </span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: PARENT CONTACTS                                           */}
      {/* ===================================================================== */}
      {subTab === 'onboard' && (
        <>
          {students.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No Learners Yet
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Add learners in the <strong>Roster</strong> tab first, then enter each guardian&apos;s name and phone number here.
              </p>
              {onGoToRoster && (
                <button
                  type="button"
                  onClick={onGoToRoster}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold touch-manipulation"
                >
                  <Users className="w-3.5 h-3.5" />
                  Go to Roster
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Filter Chips + Search + Paste Contacts Toolbar */}
              <div className="glass-card rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOnboardFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                      onboardFilter === 'ALL'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                    }`}
                  >
                    All <span className="opacity-75 ml-0.5 tabular-nums">{onboardStats.total}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardFilter('ONBOARDED')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                      onboardFilter === 'ONBOARDED'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Onboarded{' '}
                    <span className="opacity-75 ml-0.5 tabular-nums">{onboardStats.onboarded}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardFilter('MISSING')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                      onboardFilter === 'MISSING'
                        ? 'bg-amber-600 text-white'
                        : onboardStats.missing > 0
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                        : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    Missing Phone{' '}
                    <span className="ml-0.5 font-bold tabular-nums">{onboardStats.missing}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={onboardSearch}
                      onChange={(e) => setOnboardSearch(e.target.value)}
                      placeholder="Search learner, parent, or phone..."
                      className="w-full pl-8 pr-8 py-1.5 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-[#09090b] focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
                    />
                    {onboardSearch && (
                      <button
                        type="button"
                        onClick={() => setOnboardSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setPasteModalOpen(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 transition-all touch-manipulation"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span>Paste Contacts</span>
                    </button>
                  )}
                </div>
              </div>

              {isReadOnly && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  Archived term is read-only. Switch to the active term to edit parent details.
                </div>
              )}

              {/* Responsive Spreadsheet Table */}
              <div
                ref={onboardingWrapperRef}
                onBlur={handleOnboardingBlur}
                className="glass-card rounded-xl overflow-hidden"
              >
                <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2.5 bg-zinc-100/95 dark:bg-zinc-900/95 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <div className="col-span-4 pl-1"># &amp; Learner</div>
                  <div className="col-span-4">Parent / Guardian Name</div>
                  <div className="col-span-4">Telephone Number</div>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 md:max-h-[64vh] md:overflow-y-auto">
                  {visibleOnboardRows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      No learners match your current filter.
                    </div>
                  ) : (
                    visibleOnboardRows.map((row) => {
                      const rawPhone = String(row.parentPhone || '');
                      const digitsCount = rawPhone.replace(/\D/g, '').length;
                      const phoneInvalid = digitsCount > 0 && !row.hasValidPhone;

                      return (
                        <div
                          key={row.sn}
                          className={`p-3 sm:px-4 sm:py-2.5 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 ${
                            !row.hasValidPhone && digitsCount === 0
                              ? 'border-l-2 border-l-amber-400'
                              : phoneInvalid
                              ? 'border-l-2 border-l-red-500 bg-red-50/20 dark:bg-red-950/15'
                              : ''
                          }`}
                        >
                          {/* Learner Identity */}
                          <div className="md:col-span-4 flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 text-xs font-medium text-zinc-400 dark:text-zinc-500 tabular-nums shrink-0 text-center">
                                {row.sn}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                  {row.name}
                                </div>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                  String(row.gender).toUpperCase() === 'M'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400'
                                    : String(row.gender).toUpperCase() === 'F'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
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
                              placeholder="Parent or guardian name..."
                              enterKeyHint="next"
                              autoCapitalize="words"
                              aria-label={`Parent name for ${row.name}`}
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-base sm:text-sm font-medium outline-none transition-all ${
                                isReadOnly
                                  ? 'bg-transparent border-transparent text-zinc-500 dark:text-zinc-400'
                                  : 'bg-zinc-50/70 dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-[#09090b] focus:border-zinc-400 dark:focus:border-zinc-600'
                              }`}
                            />
                          </div>

                          {/* Telephone Number Input + Status Icon */}
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
                              className={`w-full pl-3 pr-8 py-1.5 rounded-lg border text-base sm:text-sm font-mono outline-none transition-all ${
                                phoneInvalid
                                  ? 'bg-white dark:bg-[#09090b] border-red-400 dark:border-red-700 text-red-700 dark:text-red-400'
                                  : row.hasValidPhone
                                  ? 'bg-zinc-50/70 dark:bg-[#09090b] border-emerald-300/80 dark:border-emerald-800/60 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-[#09090b] focus:border-zinc-400'
                                  : 'bg-zinc-50/70 dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-[#09090b] focus:border-zinc-400'
                              }`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                              {row.hasValidPhone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                  <div className="px-4 py-2.5 bg-zinc-50/70 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
                      <strong className="text-zinc-800 dark:text-zinc-200">{onboardStats.onboarded}</strong> of{' '}
                      <strong className="text-zinc-800 dark:text-zinc-200">{onboardStats.total}</strong> ready for SMS
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubTab('sms')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold touch-manipulation"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Compose SMS
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 2: GROUP & INDIVIDUAL SMS                                    */}
      {/* ===================================================================== */}
      {subTab === 'sms' && (
        <div className="space-y-4">
          {onboardStats.onboarded === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-300 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                No parents have valid Ghanaian phone numbers yet.
              </div>
              <button
                type="button"
                onClick={() => setSubTab('onboard')}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold touch-manipulation"
              >
                Onboard Parents
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-12 gap-4 sm:gap-5">
            {/* Left Column: Composer & Live Preview */}
            <div className="lg:col-span-7 space-y-4">
              <div className="glass-card rounded-xl p-4 sm:p-5 space-y-4">
                {/* 1. Group vs Individual Switcher */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                    1. Recipients Mode
                  </label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchAudienceMode('all')}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-all flex items-center justify-between touch-manipulation ${
                        recipientMode === 'all' && isAllSelected
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          All Onboarded
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            recipientMode === 'all' && isAllSelected
                              ? 'text-zinc-300 dark:text-zinc-600'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          All {allEligibleCount} valid contacts
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
                          recipientMode === 'all' && isAllSelected
                            ? 'bg-white/15 dark:bg-zinc-900/15'
                            : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {allEligibleCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchAudienceMode('selected')}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-all flex items-center justify-between touch-manipulation ${
                        recipientMode === 'selected' || !isAllSelected
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          Selected / 1-on-1
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            recipientMode === 'selected' || !isAllSelected
                              ? 'text-zinc-300 dark:text-zinc-600'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          Tick parents or tap Only
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
                          recipientMode === 'selected' || !isAllSelected
                            ? 'bg-white/15 dark:bg-zinc-900/15'
                            : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {selectedCount}/{allEligibleCount}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Template Selector */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                    2. Message Template
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
                        className={`text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-colors touch-manipulation ${
                          selectedTemplateId === tpl.id
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
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
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      3. Message Content
                    </label>
                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
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
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#09090b] text-base sm:text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 outline-none focus:bg-white dark:focus:bg-[#09090b] focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {QUICK_TOKEN_CHIPS.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => setMessageBody((prev) => `${prev} ${token}`)}
                        className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-300 transition-colors touch-manipulation"
                      >
                        +{token}
                      </button>
                    ))}
                  </div>
                  {messageBody.includes('{report_link}') && (
                    <p className="mt-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-lg px-2.5 py-1.5">
                      Each SMS includes a unique mobile result link valid for {PARENT_REPORT_TTL_DAYS} days.
                    </p>
                  )}
                </div>

                {/* Live Interpolated Preview */}
                <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 shrink-0">
                      <Eye className="w-3.5 h-3.5" />{' '}
                      {isSchoolManaged ? 'Live Preview' : `Live Preview (${activeSenderId})`}
                    </span>
                    {eligibleRecipients.length > 0 && (
                      <select
                        value={previewStudent?.sn || ''}
                        onChange={(e) => setPreviewSn(Number(e.target.value))}
                        className="text-xs font-medium bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 outline-none max-w-full sm:max-w-[290px]"
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
                  <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
                    {previewText}
                  </p>
                  {gatewayProvider !== 'simulation' && (
                    <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/80 dark:border-zinc-800">
                      <span>
                        Est. credits:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {selectedCount * Math.max(1, calculateSmsUnits(previewText || messageBody))}
                        </strong>{' '}
                        ({Math.max(1, calculateSmsUnits(previewText || messageBody))} unit/parent)
                      </span>
                      {isSchoolManaged && schoolSmsSummary && (
                        <span
                          className={
                            schoolSmsSummary.isExhausted
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300 font-medium'
                          }
                        >
                          Balance:{' '}
                          {schoolSmsSummary.enforceQuota
                            ? `${schoolSmsSummary.creditsRemaining.toLocaleString()} left`
                            : 'Unlimited'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {gatewayProvider !== 'simulation' &&
                  isSchoolManaged &&
                  schoolSmsSummary &&
                  (!schoolSmsSummary.isGatewayReady && !serverStatus?.configured ? (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        SMS service is not activated yet for {institution.schoolName}. Ask your Senior Super User to activate SMS settings.
                      </span>
                    </div>
                  ) : schoolSmsSummary.isExhausted ? (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {institution.schoolName} has 0 SMS package credits remaining. Ask your Senior Super User to top up the school&apos;s SMS package.
                      </span>
                    </div>
                  ) : null)}

                {/* Send Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleSendSelected}
                    disabled={isSendingSms || selectedCount === 0}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all touch-manipulation"
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
                      ? `Send Group SMS (${selectedCount})`
                      : `Send SMS to ${selectedCount} Selected`}
                  </button>

                  {!isAllSelected && allEligibleCount > 0 && (
                    <button
                      type="button"
                      onClick={handleSendToAll}
                      disabled={isSendingSms}
                      className="py-2.5 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all touch-manipulation"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Send All ({allEligibleCount})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Parent Recipient Picker */}
            <div className="lg:col-span-5 glass-card rounded-xl overflow-hidden flex flex-col max-h-[680px]">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    Recipients ({selectedCount}/{allEligibleCount})
                  </h3>
                  <div className="flex gap-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => selectSmsGroup('all')}
                      className={`px-2.5 py-1 rounded-md transition-colors touch-manipulation ${
                        isAllSelected
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      All ({allEligibleCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => selectSmsGroup('none')}
                      className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 touch-manipulation"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={smsSearch}
                    onChange={(e) => setSmsSearch(e.target.value)}
                    placeholder="Search parent, learner, or phone..."
                    className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#09090b] text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:bg-white dark:focus:bg-[#09090b] focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                  {smsSearch && (
                    <button
                      type="button"
                      onClick={() => setSmsSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Minimal Group Filter Chips */}
                <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('top')}
                    className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
                  >
                    Avg ≥ 70%
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('support')}
                    className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
                  >
                    Avg &lt; 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('stem')}
                    className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
                  >
                    Maths/Sci &lt; 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('boys')}
                    className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
                  >
                    Boys
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSmsGroup('girls')}
                    className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 touch-manipulation"
                  >
                    Girls
                  </button>
                </div>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-y-auto flex-1">
                {filteredSmsRecipients.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
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
                            ? 'bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500'
                            : checked
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/15 cursor-pointer'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.hasValidPhone ? (
                            checked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                            )
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-zinc-900 dark:text-zinc-100">
                              {r.sn}. {formatSmsName(r.parentName) || 'Parent/Guardian'}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {formatSmsName(r.name)}
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
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors touch-manipulation ${
                                  selectedCount === 1 && checked
                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400'
                                }`}
                              >
                                Only
                              </button>
                              <span className="font-mono text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
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
                              className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 text-[10px] font-semibold touch-manipulation"
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
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <History className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                Dispatch History ({smsLogs.length})
              </h3>
            </div>
            {smsLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                No SMS alerts dispatched yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-100/90 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400 uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Gateway</th>
                      <th className="px-4 py-2.5 text-center">Delivered</th>
                      <th className="px-4 py-2.5">Sample Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {smsLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                        <td className="px-4 py-2.5 font-mono text-[11px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                          {log.timestamp}
                        </td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                          {log.category}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/70 dark:border-zinc-700">
                            {log.gateway}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-emerald-700 dark:text-emerald-400">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {log.deliveredCount}/
                            {log.recipientCount}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 max-w-md truncate"
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

      {/* Minimalist Floating Save Bar for Parent Contacts */}
      {showStickySaveBar && (
        <div className="fixed bottom-3 left-2.5 right-2.5 sm:sticky sm:bottom-4 z-30 max-w-2xl mx-auto">
          <div className="bg-zinc-900/95 dark:bg-zinc-100/95 backdrop-blur-md text-white dark:text-zinc-900 rounded-xl shadow-lg border border-zinc-800 dark:border-zinc-200 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  contactSaveStatus === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-xs sm:text-sm font-medium truncate">
                {contactSaveStatus === 'error'
                  ? 'Save failed — check connection'
                  : `${pendingContactChanges.changedCount} contact edit${
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
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 dark:text-zinc-600 hover:text-white dark:hover:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 transition-all touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
              )}

              <button
                type="button"
                disabled={contactSaveStatus === 'saving'}
                onClick={() => commitContactSave({ silent: false })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 active:scale-95 transition-all touch-manipulation"
              >
                {contactSaveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Contacts
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
          className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPasteModalOpen(false)}
        >
          <div
            className="glass-card bg-white dark:bg-[#0c0c0f] w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Paste Parent Contacts
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  One contact per line, mapped sequentially to listed learners.
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

            <div className="flex gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPasteFillMode('missing')}
                className={`flex-1 py-1.5 px-3 rounded-lg border transition-colors ${
                  pasteFillMode === 'missing'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                Fill Missing Phones
              </button>
              <button
                type="button"
                onClick={() => setPasteFillMode('all')}
                className={`flex-1 py-1.5 px-3 rounded-lg border transition-colors ${
                  pasteFillMode === 'all'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
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
              className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#09090b] focus:bg-white dark:focus:bg-[#09090b] focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-base sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
              autoFocus
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {parsedPastedContacts.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {parsedPastedContacts.length} contact row
                    {parsedPastedContacts.length === 1 ? '' : 's'} detected
                  </span>
                ) : (
                  'One contact per line'
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
                  disabled={parsedPastedContacts.length === 0}
                  onClick={handleApplyPastedContacts}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation"
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
