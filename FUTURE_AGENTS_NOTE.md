# 🚀 Future Agents Handover Note

**Date:** November 10, 2026
**Project:** Madifor WebSBA
**Context:** This file serves as a comprehensive state-of-the-union for any future AI agent or developer picking up this project.

## 📌 Project Architecture
- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Firebase (Firestore + Auth + Storage)
- **State Management:** Centralized in `src/App.jsx` (which pushes props down to `Dashboard.jsx`, `Gradebook.jsx`, `Roster.jsx`, `ReportEditor.jsx`, `AdminPanel.jsx`, etc.)
- **Key Concepts:**
  - **`termData` state:** Gradebooks and Rosters are completely scoped/saved per-term (`Term 1`, `Term 2`, `Term 3`).
  - **`activeTerm` vs `viewingTerm`:** The school's official `activeTerm` dictates the current term. If the user changes `viewingTerm` in the UI to an older term, the app goes into a strict `isReadOnly = true` mode, preventing accidental overwrites.
  - **JHS Multi-Class & Multi-Subject Teacher Allocation (`classAllocations`):**
    - Every class has ONE canonical `schools/{classOwnerUid}` document owned by its Class Teacher (Form Master).
    - JHS teachers (either Dedicated Subject Teachers with `role: 'subject_teacher'` and `classAssigned: 'Subject Teacher'`, or JHS Form Masters teaching extra subjects in other JHS classes) store a `classAllocations` array on their `teachers/{uid}` document:
      `[{ classUid, className, subjects: [...] }]`.
    - When logged in, teachers with multiple classes get a **Class Switcher** in the header (`sessionStorage('targetViewingClassUid')`).
    - When viewing a class where `activeClassEntry.isFormMaster === false` (`isSubjectTeacherMode === true`), navigation is strictly restricted to **`Gradebook`** (filtered to `gradebookSubjects`) and **`Report Cards`** (strictly read-only preview of all class subjects via `teacherSubjects`, with Print buttons hidden).

## 🛠️ Recent Fixes & Additions (Nov 2026)

### 1. Critical Fix: Firestore Dotted-Key `setDoc` Bug & Multi-Writer Concurrency
- **Root Cause Discovered (Nov 2026):** `setDoc(docRef, { ['terms.Term 3.students']: ... }, { merge: true })` does **NOT** interpret dots as nested paths in the Firebase Modular SDK (`v12.1.0`)—only `updateDoc` and `tx.update` interpret string paths or `FieldPath` objects. As a result, `setDoc` was creating literal top-level fields named `"terms.Term 3.students"` while `fetchTeacherData` read `rawData.terms['Term 3'].students`, causing newly added students (like `SETH AMEGAYI` in BS. 6 Term 3) and marks to appear to vanish after page refresh.
- **Fix & Live Recovery:**
  - All trapped top-level dotted fields in live Firestore were recovered and merged back into `terms[Term]` on Nov 10, 2026, and the literal dotted fields were deleted via `deleteField()`.
  - `fetchTeacherData` in `src/App.jsx` also includes an automatic in-app self-healing check in case any legacy client writes a dotted key.
  - **`handleSaveRoster`**, **`handleSaveGrades`**, and **`handleSaveStudentReport`** now exclusively use `runTransaction` / `updateDoc` with `new FieldPath('terms', activeTerm, ...)`—never `setDoc` with dotted string keys.

### 2. Multi-Writer Safety (`rosterVersion` & Per-Subject Atomic Saves)
- **Problem:** Because JHS classes are shared between a Form Master and multiple Subject Teachers:
  1. Adding/removing a student re-sorts the roster alphabetically and shifts `student.sn` (`1..N`). A subject teacher with a stale browser tab could otherwise save marks onto the wrong student S/N.
  2. Saving the entire `grades` object from one teacher's browser tab would overwrite another subject teacher's concurrent marks.
- **Fix:**
  - `handleSaveRoster` runs inside a Firestore `runTransaction`, remaps existing `grades` on the latest server state, and increments `terms[activeTerm].rosterVersion`.
  - `handleSaveGrades` runs inside a Firestore `runTransaction`, verifies that `serverRosterVersion === localRosterVersion` AND that every student's `sn -> name` matches the server roster (aborting with a clear toast error if the Form Master modified the roster), and writes **only** the modified subject path `new FieldPath('terms', activeTerm, 'grades', subjectKey)` plus `gradeMeta[subjectKey]` (`updatedByUid`, `updatedByName`, `updatedAt`).

### 3. Double-Stream Class Support (`BS. 7A`, `BS. 7B`, etc.)
- `src/constants/promotionMap.js` and `src/utils/calculations.js` now export `isJhsClass()` and `resolveNextClass()`, supporting both single-stream (`BS. 7` -> `BS. 8`) and double-stream (`BS. 7A` -> `BS. 8A`, `BS. 9B` -> `GRADUATED`) progressions.

### 4. Super Admin `Subject Management` Tab
- Added `AdminSubjectManagementTab` in `src/components/AdminPanel.jsx`:
  - Supports **Assign / Convert Existing Teacher** (including converting accidentally created duplicate BS. 7 teacher accounts into `Dedicated Subject Teacher` accounts and cleaning up their blank `schools/{uid}` docs) and **+ New Subject Teacher Login**.
  - Interactive **Class × Subject Checkbox Matrix Grid** across all JHS classes/streams.
  - **Conflict Detection & Auto-Transfer** via `writeBatch` when reassigning a `(Class, Subject)` pair from one teacher to another.
  - **Live Subject Coverage & Grading Completion Matrix** (`x/y Graded ✓` vs `Pending`).

## ⚠️ Critical Agent Warnings
- **NEVER use `setDoc(..., { 'a.b.c': val }, { merge: true })`!** Always use `updateDoc` or `tx.update` with `new FieldPath('a', 'b', 'c')` when updating nested fields inside `terms`.
- **NEVER allow `role === 'subject_teacher'` to create or own a `schools/{uid}` document.** Dedicated subject teachers only read/write the `schools/{classUid}` documents listed in their `classAllocations`.
- **Git-First Deployment:** Always deploy by committing and pushing to `main` on GitHub (`vercel-ignore-build.sh` blocks non-`main` branches).

Good luck!
- *Agent Antigravity*
