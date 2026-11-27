import {
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  FieldPath,
  Timestamp,
} from 'firebase/firestore';
import {
  SCHOOL_LEVELS,
  KG_LEARNING_AREAS,
  DEFAULT_KG_SUBJECT_MAP,
  DEFAULT_PRIMARY_SUBJECT_MAP,
  DEFAULT_JHS_SUBJECT_MAP,
  filterActiveSubjectsForLevel,
  isJhsClass,
  resolveSchoolLevel,
} from '../constants/curriculum.js';
import { DEFAULT_MNOTIFY_SENDER_ID, normalizeSmsSenderId } from './mnotifyHelpers.js';
import { normalizeDateOfBirth, normalizeStudentName } from './rosterHelpers.js';
import {
  buildParentReportSnapshot,
  buildParentReportUrl,
  generateReportToken,
  getParentReportDocId,
  partitionExpiredReportLinks,
  resolveHeadTeacherName,
} from './parentReportHelpers.js';

export {
  SCHOOL_LEVELS,
  DEFAULT_KG_SUBJECT_MAP,
  DEFAULT_PRIMARY_SUBJECT_MAP,
  DEFAULT_JHS_SUBJECT_MAP,
  resolveSchoolLevel,
  resolveHeadTeacherName,
};

/**
 * Normalizes a class SMS gateway configuration object with safe defaults.
 * @param {object|null|undefined} rawConfig
 * @returns {{ provider: string, senderId: string, apiKey: string, dispatchSecret: string }}
 */
export function normalizeGatewayConfig(rawConfig) {
  if (rawConfig && typeof rawConfig === 'object') {
    return {
      provider: rawConfig.provider || 'mnotify',
      senderId: normalizeSmsSenderId(rawConfig.senderId || DEFAULT_MNOTIFY_SENDER_ID),
      apiKey: rawConfig.apiKey || '',
      dispatchSecret: rawConfig.dispatchSecret || '',
    };
  }
  return {
    provider: 'mnotify',
    senderId: DEFAULT_MNOTIFY_SENDER_ID,
    apiKey: '',
    dispatchSecret: '',
  };
}

/**
 * Resolves subject maps and lists for a Form Master class from its teacher profile.
 * @param {object|null|undefined} teacherProfile
 * @returns {{ subjectMap: object, subjectsList: string[], teacherSubjects: Array<{name: string, key: string}> }}
 */
export function buildTeacherSubjectInfo(teacherProfile) {
  const resolvedLevel = resolveSchoolLevel(teacherProfile?.assignedClass, teacherProfile?.level);
  const subjects = filterActiveSubjectsForLevel(teacherProfile?.subjects, resolvedLevel);
  if (Array.isArray(subjects) && subjects.length > 0) {
    const subjectMap = {};
    subjects.forEach((sub) => {
      subjectMap[sub.name] = sub.key;
    });
    return {
      level: resolvedLevel,
      subjectMap,
      subjectsList: subjects.map((s) => s.name),
      teacherSubjects: subjects,
    };
  }

  let fallback;
  if (resolvedLevel === SCHOOL_LEVELS.KG) {
    fallback = { ...DEFAULT_KG_SUBJECT_MAP };
  } else if (resolvedLevel === SCHOOL_LEVELS.JHS) {
    fallback = { ...DEFAULT_JHS_SUBJECT_MAP };
  } else {
    fallback = { ...DEFAULT_PRIMARY_SUBJECT_MAP };
  }

  return {
    level: resolvedLevel,
    subjectMap: fallback,
    subjectsList: Object.keys(fallback),
    teacherSubjects: Object.entries(fallback).map(([name, key]) => ({ name, key })),
  };
}

/**
 * Builds the list of classes accessible to a logged-in teacher.
 * - Class Teachers (Form Masters) get their own home class first (`isFormMaster: true`),
 *   plus any additional JHS classes allocated to them as a visiting Subject Teacher (`isFormMaster: false`).
 * - Dedicated Subject Teachers (`role === 'subject_teacher'`) get only their allocated JHS classes (`isFormMaster: false`).
 * @param {object|null|undefined} profile
 * @param {string|null|undefined} uid
 * @returns {Array<{ classUid: string, className: string, isFormMaster: boolean, allocatedSubjects: Array<{name: string, key: string}>|null }>}
 */
export function buildAccessibleClasses(profile, uid) {
  if (!profile || !uid) return [];
  const list = [];
  const allocMap = profile.classAllocations || {};
  const isDedicatedSubjectTeacher = profile.role === 'subject_teacher';

  // 1. If the teacher is a Form Master / Class Teacher, add their home class first
  if (!isDedicatedSubjectTeacher && profile.assignedClass && profile.assignedClass !== 'Subject Teacher') {
    const homeIsJhs = isJhsClass(profile.assignedClass);
    const homeAlloc = homeIsJhs ? allocMap[uid] : null;
    list.push({
      classUid: uid,
      className: profile.assignedClass,
      isFormMaster: true,
      allocatedSubjects:
        homeIsJhs && Array.isArray(homeAlloc?.subjects) && homeAlloc.subjects.length > 0
          ? homeAlloc.subjects
          : null,
    });
  }

  // 2. Add any additional JHS classes allocated to this teacher (strictly JHS classes only)
  const canHaveSubjectAllocations =
    isDedicatedSubjectTeacher ||
    !profile.assignedClass ||
    profile.assignedClass === 'Subject Teacher' ||
    isJhsClass(profile.assignedClass);

  if (canHaveSubjectAllocations) {
    Object.entries(allocMap).forEach(([targetUid, alloc]) => {
      const cUid = alloc?.classUid || targetUid;
      if (!cUid) return;
      if (list.some((item) => item.classUid === cUid)) return;
      if (alloc?.className && !isJhsClass(alloc.className)) return;
      if (Array.isArray(alloc?.subjects) && alloc.subjects.length > 0) {
        list.push({
          classUid: cUid,
          className: alloc.className || 'Assigned Class',
          isFormMaster: false,
          allocatedSubjects: alloc.subjects,
        });
      }
    });
  }

  return list;
}

/**
 * Resolves full class subjects (for Report Cards / Broadsheet / Overview) and Gradebook subjects
 * for the currently active class view.
 *
 * IMPORTANT: Class Teachers (Form Masters) viewing their own home class (`!isSubjectTeacherMode`)
 * ALWAYS receive full Gradebook access (`gradebookSubjects = fullClassSubjects`) so they can enter
 * marks for ALL subjects in their class, even if they also teach specific JHS subjects.
 * Gradebook tabs are restricted to `allocatedSubjects` ONLY in Subject Teacher mode
 * (dedicated Subject Teachers, or when a Form Master switches to another teacher's JHS class).
 *
 * @param {object} params
 * @returns {{
 *   level: string,
 *   subjectMap: Record<string, string>,
 *   subjectsList: string[],
 *   teacherSubjects: Array<{name: string, key: string}>,
 *   gradebookSubjects: Array<{name: string, key: string}>
 * }}
 */
export function resolveActiveTeacherSubjects({
  userProfile = null,
  classOwnerProfile = null,
  activeClassEntry = null,
  metadata = null,
  isSubjectTeacherMode = false,
} = {}) {
  const ownerProf = classOwnerProfile || userProfile;
  const effectiveClassName =
    activeClassEntry?.className ||
    metadata?.classLevel ||
    userProfile?.assignedClass ||
    'BS. 7';
  const resolvedLevel = resolveSchoolLevel(
    effectiveClassName,
    ownerProf?.level || metadata?.level
  );
  let fullClassSubjects = [];

  const filteredOwnerSubjects = filterActiveSubjectsForLevel(
    ownerProf?.subjects,
    resolvedLevel
  );
  if (filteredOwnerSubjects.length > 0) {
    fullClassSubjects = [...filteredOwnerSubjects];
  } else {
    const fallbackMap =
      resolvedLevel === SCHOOL_LEVELS.KG
        ? DEFAULT_KG_SUBJECT_MAP
        : resolvedLevel === SCHOOL_LEVELS.PRIMARY
          ? DEFAULT_PRIMARY_SUBJECT_MAP
          : DEFAULT_JHS_SUBJECT_MAP;
    fullClassSubjects = Object.entries(fallbackMap).map(([name, key]) => ({
      name,
      key,
    }));
  }

  // Ensure any allocated subjects (e.g. French or Arabic) for the active class are included in fullClassSubjects
  const cleanedAllocSubjects = filterActiveSubjectsForLevel(
    activeClassEntry?.allocatedSubjects,
    resolvedLevel
  );
  if (cleanedAllocSubjects.length > 0) {
    cleanedAllocSubjects.forEach((allocSub) => {
      if (allocSub?.key && !fullClassSubjects.some((s) => s.key === allocSub.key)) {
        fullClassSubjects = [...fullClassSubjects, allocSub];
      }
    });
  }

  const fullMap = {};
  fullClassSubjects.forEach((sub) => {
    fullMap[sub.name] = sub.key;
  });

  // Restrict Gradebook tabs ONLY when operating in Subject Teacher mode (not for a Class Teacher in their own class!)
  const gradebookSubjects =
    isSubjectTeacherMode && cleanedAllocSubjects.length > 0
      ? cleanedAllocSubjects
      : fullClassSubjects;

  return {
    level: resolvedLevel,
    subjectMap: fullMap,
    subjectsList: fullClassSubjects.map((s) => s.name),
    teacherSubjects: fullClassSubjects,
    gradebookSubjects,
  };
}

/**
 * Merges class metadata with institution/teacher fallbacks for reports and SMS alerts.
 * @param {object} params
 * @returns {object}
 */
export function buildClassTermMetadata({ classData, selectedTeacher, institution, selectedTerm }) {
  const baseMeta =
    classData?.metadata && typeof classData.metadata === 'object' ? classData.metadata : {};
  const academicYear = baseMeta.academicYear || baseMeta.year || institution?.academicYear || '';
  const classLevel = baseMeta.classLevel || selectedTeacher?.assignedClass || '';
  return {
    ...baseMeta,
    schoolName: institution?.schoolName || baseMeta.schoolName || '',
    headTeacherName: resolveHeadTeacherName(institution, baseMeta),
    academicYear,
    year: baseMeta.year || academicYear,
    classLevel,
    level: resolveSchoolLevel(classLevel, selectedTeacher?.level || baseMeta.level),
    term: selectedTerm || baseMeta.term || 'Term 1',
  };
}

/**
 * Replaces a single learner entry by `sn` (or appends it if missing) inside a roster array.
 * @param {Array<object>} studentsList
 * @param {object} updatedStudent
 * @returns {Array<object>}
 */
export function mergeStudentReportUpdate(studentsList = [], updatedStudent) {
  const safeList = Array.isArray(studentsList) ? studentsList : [];
  if (!updatedStudent || updatedStudent.sn === undefined || updatedStudent.sn === null) {
    return safeList;
  }
  let found = false;
  const next = safeList.map((stu) => {
    if (stu.sn === updatedStudent.sn) {
      found = true;
      return updatedStudent;
    }
    return stu;
  });
  return found ? next : [...safeList, updatedStudent];
}

/**
 * Applies parent contact patches to the target term and propagates matched learner names across all terms.
 * @param {object} serverTerms
 * @param {string} activeTerm
 * @param {object} contactUpdatesBySn
 * @param {Array<object>} fallbackStudents
 * @returns {Record<string, Array<object>>}
 */
function applyStudentOnboardingPatch(stu, patch) {
  const next = {
    ...stu,
    parentName: patch.parentName || '',
    parentPhone: patch.parentPhone || '',
  };
  if (Object.prototype.hasOwnProperty.call(patch, 'dateOfBirth')) {
    const cleanDob = normalizeDateOfBirth(patch.dateOfBirth);
    if (cleanDob) {
      next.dateOfBirth = cleanDob;
    } else {
      delete next.dateOfBirth;
    }
    delete next.dob;
  }
  return next;
}

export function applyParentContactUpdatesToTerms(
  serverTerms = {},
  activeTerm = 'Term 1',
  contactUpdatesBySn = {},
  fallbackStudents = []
) {
  const safeTerms = serverTerms && typeof serverTerms === 'object' ? serverTerms : {};
  const activeStudents = Array.isArray(safeTerms[activeTerm]?.students)
    ? safeTerms[activeTerm].students
    : Array.isArray(fallbackStudents)
      ? fallbackStudents
      : [];

  const contactByNormName = new Map();
  const nextActiveStudents = activeStudents.map((stu) => {
    const patch = contactUpdatesBySn[stu.sn];
    if (!patch) return stu;
    const cleanNameKey = normalizeStudentName(stu.name);
    if (cleanNameKey) {
      const termPatch = {
        parentName: patch.parentName || '',
        parentPhone: patch.parentPhone || '',
      };
      if (Object.prototype.hasOwnProperty.call(patch, 'dateOfBirth')) {
        termPatch.dateOfBirth = normalizeDateOfBirth(patch.dateOfBirth);
      }
      contactByNormName.set(cleanNameKey, termPatch);
    }
    return applyStudentOnboardingPatch(stu, patch);
  });

  const updatedTermStudentsMap = { [activeTerm]: nextActiveStudents };

  Object.keys(safeTerms).forEach((termKey) => {
    if (termKey === activeTerm) return;
    const list = safeTerms[termKey]?.students;
    if (!Array.isArray(list) || list.length === 0 || contactByNormName.size === 0) return;
    let modified = false;
    const nextList = list.map((stu) => {
      const matchPatch = contactByNormName.get(normalizeStudentName(stu.name));
      if (!matchPatch) return stu;
      modified = true;
      return applyStudentOnboardingPatch(stu, matchPatch);
    });
    if (modified) {
      updatedTermStudentsMap[termKey] = nextList;
    }
  });

  return updatedTermStudentsMap;
}

/**
 * Transactionally saves a single learner's edited report card fields in a class document.
 * Preserves concurrent edits to other learners on the server.
 * @param {object} params
 * @returns {Promise<Array<object>|null>}
 */
export async function saveStudentReportTransaction({
  db,
  targetDocId,
  termKey,
  updatedStudent,
  fallbackStudents = [],
}) {
  if (!db || !targetDocId || !termKey || !updatedStudent) return null;

  const schoolRef = doc(db, 'schools', targetDocId);
  let nextStudents = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(schoolRef);
    const sData = snap.exists() ? snap.data() : {};
    const serverStudents = Array.isArray(sData?.terms?.[termKey]?.students)
      ? sData.terms[termKey].students
      : fallbackStudents;

    nextStudents = mergeStudentReportUpdate(serverStudents, updatedStudent);
    if (snap.exists()) {
      tx.update(schoolRef, new FieldPath('terms', termKey, 'students'), nextStudents);
    } else {
      tx.set(schoolRef, { terms: { [termKey]: { students: nextStudents } } }, { merge: true });
    }
  });

  return nextStudents;
}

/**
 * Transactionally saves parent contact updates on the selected term and cross-propagates across terms.
 * @param {object} params
 * @returns {Promise<Record<string, Array<object>>|null>}
 */
export async function saveParentContactsTransaction({
  db,
  targetDocId,
  activeTerm,
  contactUpdatesBySn,
  fallbackStudents = [],
}) {
  if (!db || !targetDocId || !contactUpdatesBySn || Object.keys(contactUpdatesBySn).length === 0) {
    return null;
  }

  const schoolRef = doc(db, 'schools', targetDocId);
  let updatedTermStudentsMap = {};

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(schoolRef);
    const sData = snap.exists() ? snap.data() : {};
    const serverTerms = sData.terms ? structuredClone(sData.terms) : {};

    updatedTermStudentsMap = applyParentContactUpdatesToTerms(
      serverTerms,
      activeTerm,
      contactUpdatesBySn,
      fallbackStudents
    );

    if (snap.exists()) {
      const fieldPathUpdates = [];
      Object.entries(updatedTermStudentsMap).forEach(([tKey, tStudents]) => {
        fieldPathUpdates.push(new FieldPath('terms', tKey, 'students'), tStudents);
      });
      tx.update(schoolRef, ...fieldPathUpdates);
    } else {
      tx.set(
        schoolRef,
        { terms: { [activeTerm]: { students: updatedTermStudentsMap[activeTerm] || [] } } },
        { merge: true }
      );
    }
  });

  return updatedTermStudentsMap;
}

/**
 * Opportunistically deletes expired 30-day parent report snapshot documents from Firestore.
 * @param {object} params
 * @returns {Promise<Array<object>>}
 */
export async function cleanupExpiredParentReportsInDoc({ db, targetDocId, rawLinks = [] }) {
  const { activeLinks, expiredTokens } = partitionExpiredReportLinks(rawLinks, Date.now());
  if (!db || !targetDocId || expiredTokens.length === 0) {
    return activeLinks;
  }

  try {
    const toDeleteNow = expiredTokens.slice(0, 100);
    const remainingExpiredSet = new Set(expiredTokens.slice(100));
    const keptRemaining = (Array.isArray(rawLinks) ? rawLinks : []).filter((item) =>
      remainingExpiredSet.has(String(item?.token || '').trim().toLowerCase())
    );
    const nextTracking = [...activeLinks, ...keptRemaining];

    const batch = writeBatch(db);
    toDeleteNow.forEach((tok) => {
      const snapDocId = getParentReportDocId(tok);
      if (snapDocId) {
        batch.delete(doc(db, 'schools', snapDocId));
      }
    });
    batch.update(doc(db, 'schools', targetDocId), {
      activeParentReportLinks: nextTracking,
    });
    await batch.commit();
  } catch (err) {
    console.warn('Expired parent report cleanup warning:', err);
  }

  return activeLinks;
}

/**
 * Publishes per-learner 30-day parent mobile report snapshots and updates tracking links on the class doc.
 * @param {object} params
 * @returns {Promise<{ linksBySn: object, createdTokens: string[], activeLinks: Array<object> }>}
 */
export async function publishParentReportsInDoc({
  db,
  targetDocId,
  targetLearners = [],
  activeLinks = [],
  metadata = {},
  institution = null,
  viewingTerm = 'Term 1',
  teacherUid = '',
  origin,
}) {
  if (!db || !targetDocId || !Array.isArray(targetLearners) || targetLearners.length === 0) {
    return { linksBySn: {}, createdTokens: [], activeLinks: Array.isArray(activeLinks) ? activeLinks : [] };
  }

  const nowMs = Date.now();
  const cleanActiveLinks = await cleanupExpiredParentReportsInDoc({
    db,
    targetDocId,
    rawLinks: activeLinks,
  });
  const existingTokensSet = new Set(cleanActiveLinks.map((item) => item.token));

  const linksBySn = {};
  const createdTokens = [];
  const newTrackingEntries = [];
  const writeOps = [];

  for (const learner of targetLearners) {
    let token = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateReportToken(10);
      if (!existingTokensSet.has(candidate)) {
        token = candidate;
        existingTokensSet.add(candidate);
        break;
      }
    }
    if (!token) token = generateReportToken(12);

    const snapshotData = buildParentReportSnapshot({
      learner,
      metadata,
      institution,
      viewingTerm,
      teacherUid,
      token,
      nowMs,
    });
    snapshotData.expireAt = Timestamp.fromMillis(snapshotData.expiresAtMs);

    const snapDocId = getParentReportDocId(token);
    if (!snapDocId) continue;

    writeOps.push({ snapDocId, snapshotData });
    createdTokens.push(token);
    linksBySn[learner.sn] = {
      token,
      url: buildParentReportUrl(token, origin),
    };
    newTrackingEntries.push({
      token,
      expiresAtMs: snapshotData.expiresAtMs,
      studentSn: learner.sn,
      term: snapshotData.term,
    });
  }

  for (let i = 0; i < writeOps.length; i += 40) {
    const chunk = writeOps.slice(i, i + 40);
    const batch = writeBatch(db);
    chunk.forEach(({ snapDocId, snapshotData }) => {
      batch.set(doc(db, 'schools', snapDocId), snapshotData);
    });
    await batch.commit();
  }

  const { activeLinks: finalActiveLinks, expiredTokens: overflowTokens } =
    partitionExpiredReportLinks([...cleanActiveLinks, ...newTrackingEntries], nowMs);

  try {
    if (overflowTokens.length > 0) {
      const purgeBatch = writeBatch(db);
      overflowTokens.slice(0, 100).forEach((oldTok) => {
        const oldDocId = getParentReportDocId(oldTok);
        if (oldDocId) purgeBatch.delete(doc(db, 'schools', oldDocId));
      });
      purgeBatch.update(doc(db, 'schools', targetDocId), {
        activeParentReportLinks: finalActiveLinks,
      });
      await purgeBatch.commit();
    } else {
      await updateDoc(doc(db, 'schools', targetDocId), {
        activeParentReportLinks: finalActiveLinks,
      });
    }
  } catch (err) {
    console.warn('Parent report tracking update warning:', err);
  }

  return { linksBySn, createdTokens, activeLinks: finalActiveLinks };
}

/**
 * Deletes unused parent report snapshots (e.g. if an SMS dispatch fails) and updates class tracking.
 * @param {object} params
 * @returns {Promise<Array<object>>}
 */
export async function deleteParentReportsInDoc({ db, targetDocId, tokens = [], activeLinks = [] }) {
  const safeLinks = Array.isArray(activeLinks) ? activeLinks : [];
  const cleanTokens = [
    ...new Set(
      (Array.isArray(tokens) ? tokens : [])
        .map((t) => String(t || '').trim().toLowerCase())
        .filter((t) => Boolean(getParentReportDocId(t)))
    ),
  ];

  if (!db || !targetDocId || cleanTokens.length === 0) return safeLinks;

  const deleteSet = new Set(cleanTokens);
  const nextTracking = safeLinks.filter(
    (item) => !deleteSet.has(String(item?.token || '').trim().toLowerCase())
  );

  try {
    for (let i = 0; i < cleanTokens.length; i += 200) {
      const chunk = cleanTokens.slice(i, i + 200);
      const batch = writeBatch(db);
      chunk.forEach((tok) => {
        const snapDocId = getParentReportDocId(tok);
        if (snapDocId) batch.delete(doc(db, 'schools', snapDocId));
      });
      if (i + 200 >= cleanTokens.length) {
        batch.update(doc(db, 'schools', targetDocId), {
          activeParentReportLinks: nextTracking,
        });
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('Failed to delete unused parent report snapshots:', err);
  }

  return nextTracking;
}

/**
 * Prepends an SMS dispatch log entry (bounded to the latest 50) on a class document.
 * @param {object} params
 * @returns {Promise<Array<object>>}
 */
export async function appendSmsLogInDoc({ db, targetDocId, prevLogs = [], newLog }) {
  const updatedLogs = [newLog, ...(Array.isArray(prevLogs) ? prevLogs : [])].slice(0, 50);
  if (db && targetDocId) {
    try {
      await setDoc(doc(db, 'schools', targetDocId), { smsLogs: updatedLogs }, { merge: true });
    } catch (e) {
      console.error('SMS log sync error:', e);
    }
  }
  return updatedLogs;
}

/**
 * Transactionally increments school SMS package creditsUsed and optional live wallet balance.
 * @param {object} params
 * @returns {Promise<object|null>}
 */
export async function recordInstitutionSmsUsageTransaction({
  db,
  institutionId,
  creditsConsumed = 0,
  extra = {},
}) {
  const delta = Math.max(0, Math.round(Number(creditsConsumed) || 0));
  if (!db || !institutionId || delta <= 0) return null;

  const instRef = doc(db, 'institutions', institutionId);
  const nowIso = new Date().toISOString();
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(instRef);
      const current = snap.exists() ? snap.data() : {};
      const prevPkg =
        current?.smsPackage && typeof current.smsPackage === 'object' ? current.smsPackage : {};
      const nextUsed = Math.max(0, Math.round(Number(prevPkg.creditsUsed || 0) + delta));
      const nextPkg = {
        ...prevPkg,
        packageId: prevPkg.packageId || 'custom',
        packageName: prevPkg.packageName || 'School Package',
        creditsAllocated: Math.max(0, Math.round(Number(prevPkg.creditsAllocated) || 0)),
        creditsUsed: nextUsed,
        enforceQuota: prevPkg.enforceQuota !== false,
        lastUsedAt: nowIso,
        updatedAt: nowIso,
        ...(extra?.latestMnotifyCreditLeft !== null && extra?.latestMnotifyCreditLeft !== undefined
          ? { lastMnotifyBalance: Number(extra.latestMnotifyCreditLeft) }
          : {}),
      };
      tx.set(instRef, { smsPackage: nextPkg }, { merge: true });
      return nextPkg;
    });
  } catch (e) {
    console.error('SMS credit deduction error:', e);
    return null;
  }
}
