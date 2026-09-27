# 🚀 Future Agents Handover Note

**Date:** September 27, 2026
**Project:** Madifor WebSBA
**Context:** This file serves as a comprehensive state-of-the-union for any future AI agent or developer picking up this project.

## 📌 Project Architecture
- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Firebase (Firestore + Auth + Storage)
- **State Management:** Centralized in `App.jsx` (which pushes props down to `Dashboard.jsx`, `Gradebook.jsx`, `Roster.jsx`, `ReportEditor.jsx`, etc.)
- **Key Concepts:**
  - **`termData` state:** Gradebooks and Rosters are completely scoped/saved per-term (`Term 1`, `Term 2`, `Term 3`).
  - **`activeTerm` vs `viewingTerm`:** The school's official `activeTerm` dictates the current term. If the user changes `viewingTerm` in the UI to an older term, the app goes into a strict `isReadOnly = true` mode, preventing accidental overwrites.
  - **Promotion Engine:** Calculates promotion logic dynamically for Primary and JHS subjects.

## 🛠️ Recent Fixes & Additions (Sept 2026)

### 1. The Cumulative Promotion Engine Bug
- **Bug:** The engine in `utils/calculations.js` was previously hardcoded to only search for **JHS subjects** (e.g. "Social Studies", "Career Tech"). For Primary students taking "Our World Our People" or "History", those subjects were completely ignored, which resulted in failing scores and repeating the grade incorrectly.
- **Fix:** Refactored `ReportEditor.jsx` to dynamically pull the active teacher's specific subject mappings (`teacherSubjects`), and pass them directly into `computeCumulativePromotion()`. Now, Primary subject scores are accurately summed and averaged.
- **Manual Overrides:** The "PROMOTED TO" dropdown in the `ReportEditor` will respect any manual selection. Selecting `-- None --` forces it to snap back to the system's dynamic calculation.

### 2. Roster Syncing & "Vanishing Names" Bug
- **Bug:** Users reported that adding a student to the Roster would show them briefly, but upon page refresh, the student would vanish.
- **Root Cause:** A UI race condition. React state updated instantly, but the Firebase `setDoc` operation took a second to complete. Without any blocking UI, users would aggressively refresh to "verify", which aborted the pending HTTP request in the background.
- **Fix:** Added `react-hot-toast` promises to the `Roster.jsx` `handleAdd`, `handleRemove`, and `saveEdit` functions. The UI now shows a clear "Saving student..." loading state, and only allows the user to comfortably proceed/refresh once the green "Student added successfully!" checkmark appears.
- **Error Propagation:** Updated `App.jsx` -> `handleSaveRoster` to throw errors so that the `toast.promise` can correctly show failures.

### 3. Hard Refresh on Term Switch
- **Feature:** We implemented a forced `window.location.reload()` whenever the global Term Switcher dropdown is used.
- **Why:** The SPA memory was occasionally retaining edge-case sticky state, and the local React store could drift from the Firestore truth.
- **How it works:** The `<select>` `onChange` handler saves the target term into `sessionStorage('targetViewingTerm')`, executes the reload, and `fetchTeacherData` recovers it during boot.

### 4. Vercel Deployment & Bots
- **Housekeeping:** Created a `vercel-ignore-build.sh` script (located in the project root) that strictly restricts Vercel from deploying any branch except `main`. We previously experienced a Vercel outage where 100+ bot-preview branches exhausted all memory limits and quotas.

## 🚀 Future Roadmap & Pending Requests
The user (Madifor) has mentioned a few long-term roadmap items that have NOT been started yet:
1. **Kindergarten (KG) Support:** Needs a competency-based (EE/ME/AE/EM) 4-tier rubric instead of numerical scores, developmental learning strands, and a unique KG report card layout.
2. **Regional & Unit Director Dashboard:** Multi-school comparative performance league tables and submission compliance tracking.
3. **Multi-Tenant Custom Grading Dictionary:** Allowing different schools to define custom grading scales (e.g. 30/70 vs 50/50 SBA/Exam weightings).

## ⚠️ Critical Agent Warnings
- **Database Schema:** Be extremely careful when editing `handleSaveRoster` or `handleSaveGrades`. The entire Firestore data structure heavily relies on `terms.${activeTerm}.grades` and `terms.${activeTerm}.students`. 
- **Array Mappings:** The grade sheets map `grades[subjectKey][studentSn]`. The `student.sn` is critical. DO NOT remove the `sortAndReindex` logic without understanding how it tracks old -> new S/Ns.

Good luck! 
- *Agent Antigravity*
