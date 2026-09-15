# Sentinel Security Journal

## 2026-09-15 - Firestore Security Rules Evaluation Crash on Non-Existent Document Get
**Vulnerability:** Calling `get()` directly on a path in Firestore Security Rules without checking document existence causes rule evaluation to crash and fail closed/unpredictably when a user document does not exist.
**Learning:** In Firestore rules, `get(/path/to/doc)` throws a runtime evaluation error if the target document does not exist. In `isTeacherAdmin()`, evaluating `get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.isAdmin` directly for authenticated users without a `teachers` document caused security evaluation failures.
**Prevention:** Always guard `get()` calls in Firestore rules with short-circuit `exists()` checks (e.g. `exists(/path) && get(/path).data.field == true`).
