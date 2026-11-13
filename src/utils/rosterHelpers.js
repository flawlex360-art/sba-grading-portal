/**
 * Pure utility helpers for interactive Roster state management,
 * WhatsApp/Notes multi-line paste parsing, alphabetical sorting,
 * and grade-safe S/N remapping (`snMap`).
 */

/**
 * Normalize a learner's name for canonical storage and comparison.
 * Collapses repeated spaces and uppercases without altering mid-edit cursor state.
 */
export function normalizeStudentName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Normalize gender value into canonical `'M' | 'F' | 'U'`.
 */
export function normalizeGender(raw) {
  if (typeof raw !== 'string') return 'U';
  const upper = raw.trim().toUpperCase();
  if (upper === 'M' || upper === 'MALE' || upper === 'BOY' || upper === 'B') return 'M';
  if (upper === 'F' || upper === 'FEMALE' || upper === 'GIRL' || upper === 'G') return 'F';
  return 'U';
}

/**
 * Parse a multi-line pasted list (e.g., from WhatsApp, Notes, or Excel column)
 * into clean `{ name, gender }` entries. Strips numbering prefixes and optional
 * trailing gender tags such as `, M`, `- F`, `(Female)`, or tab-separated `M/F`.
 */
export function parsePastedRosterText(text) {
  if (typeof text !== 'string') return [];

  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];

  for (const rawLine of rawLines) {
    // Strip common leading list numbering or bullet characters (e.g. "1.", "12)", "- ", "• ")
    let cleaned = rawLine.replace(/^\s*(?:\d{1,3}[\.\)\-:\s]+|[-•*]+\s*)/, '').trim();
    if (!cleaned) continue;

    let gender = 'U';

    // Detect explicit delimiter-separated gender tag at the end of the line
    // (tab, comma, dash/slash, parentheses) or explicit whole word MALE/FEMALE/BOY/GIRL
    const delimitedMatch = cleaned.match(
      /(?:\t|\s*,\s*|\s+[-–/|]\s*|\s*\()\s*(MALE|FEMALE|BOY|GIRL|M|F)\s*\)?\s*$/i
    );
    const wordMatch = !delimitedMatch
      ? cleaned.match(/\s+\b(MALE|FEMALE|BOY|GIRL)\b\s*$/i)
      : null;

    const match = delimitedMatch || wordMatch;
    if (match) {
      gender = normalizeGender(match[1]);
      cleaned = cleaned.slice(0, match.index).trim();
    }

    // Strip any leftover trailing tab/comma/dash if a blank column trailed the name
    cleaned = cleaned.replace(/[\t,;:\-–/|]+$/, '').trim();
    const name = normalizeStudentName(cleaned);

    if (name.length > 0) {
      parsed.push({ name, gender });
    }
  }

  return parsed;
}

/**
 * Remove internal UI tracking properties so Firestore receives clean student objects
 * while retaining every domain field (attendance, conduct, interest, remarks, etc.).
 */
export function stripInternalRowFields(studentObj) {
  if (!studentObj || typeof studentObj !== 'object') return {};
  const copy = { ...studentObj };
  delete copy._rowId;
  delete copy._origSn;
  delete copy._origName;
  delete copy._origGender;
  delete copy._rawData;
  return copy;
}

/**
 * Compute the exact Firestore roster payload and grade-remapping `snMap`.
 *
 * Rules:
 * - Blank-named enrolled rows are flagged in `blankEnrolledRowIds` instead of
 *   silently deleting the student and their grades.
 * - If only gender values changed on untouched enrolled rows (`!needsReorder`),
 *   row S/Ns stay untouched and `snMap` is `null` so rows never jump during
 *   rapid M/F tapping.
 * - If learners were added, deleted, or renamed (`needsReorder`), all active
 *   learners are sorted A-Z, renumbered `1..N`, and `snMap` maps every surviving
 *   learner's previous S/N -> new S/N so `serverGrades` stays aligned.
 */
export function buildRosterCommitPayload({
  enrolledRows = [],
  draftRows = [],
  originalStudents = [],
}) {
  const blankEnrolledRowIds = [];
  const cleanEnrolled = [];

  for (const row of enrolledRows) {
    const normalizedName = normalizeStudentName(row.name);
    if (!normalizedName) {
      blankEnrolledRowIds.push(row._rowId);
      continue;
    }
    cleanEnrolled.push({
      ...row,
      name: normalizedName,
      gender: normalizeGender(row.gender),
    });
  }

  if (blankEnrolledRowIds.length > 0) {
    return {
      hasError: true,
      errorType: 'blank-enrolled-name',
      blankEnrolledRowIds,
      hasChanges: false,
    };
  }

  const cleanDrafts = [];
  for (const draft of draftRows) {
    const normalizedName = normalizeStudentName(draft.name);
    if (!normalizedName) continue;
    cleanDrafts.push({
      _rowId: draft._rowId,
      _origSn: null,
      _rawData: null,
      name: normalizedName,
      gender: normalizeGender(draft.gender),
    });
  }

  const hasDeletion = cleanEnrolled.length < originalStudents.length;
  const hasAddition = cleanDrafts.length > 0;
  const hasRename = cleanEnrolled.some((row) => row.name !== row._origName);
  const hasGenderChange = cleanEnrolled.some((row) => row.gender !== row._origGender);
  const needsReorder = hasDeletion || hasAddition || hasRename;

  if (!needsReorder && !hasGenderChange) {
    return {
      hasError: false,
      hasChanges: false,
      needsReorder: false,
      hasStructuralChanges: false,
      roster: null,
      snMap: null,
      committedDraftIds: [],
    };
  }

  if (!needsReorder) {
    // Only gender values were toggled on existing rows; keep S/N order stable
    const updatedRoster = [...cleanEnrolled]
      .sort((a, b) => (a._origSn ?? 0) - (b._origSn ?? 0))
      .map((row) => {
        const base = stripInternalRowFields(row._rawData);
        return {
          ...base,
          sn: row._origSn,
          name: row.name,
          gender: row.gender,
        };
      });

    return {
      hasError: false,
      hasChanges: true,
      needsReorder: false,
      hasStructuralChanges: false,
      roster: updatedRoster,
      snMap: null,
      committedDraftIds: [],
    };
  }

  const combined = [...cleanEnrolled, ...cleanDrafts];

  // Deterministic alphabetical sort with stable tie-breaker on original S/N
  combined.sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    const snA = a._origSn ?? Number.MAX_SAFE_INTEGER;
    const snB = b._origSn ?? Number.MAX_SAFE_INTEGER;
    return snA - snB;
  });

  const snMap = {};
  const nextRoster = combined.map((item, idx) => {
    const newSn = idx + 1;
    if (item._origSn != null) {
      snMap[item._origSn] = newSn;
    }
    const base = stripInternalRowFields(item._rawData);
    return {
      ...base,
      sn: newSn,
      name: item.name,
      gender: item.gender,
    };
  });

  return {
    hasError: false,
    hasChanges: true,
    needsReorder: true,
    hasStructuralChanges: true,
    roster: nextRoster,
    snMap,
    committedDraftIds: cleanDrafts.map((d) => d._rowId),
  };
}
