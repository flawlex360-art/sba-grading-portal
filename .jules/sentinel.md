## 2025-05-15 - Firestore Rule Evaluation Crash on Non-Existent Document Access

**Vulnerability:** In `firestore.rules`, `isTeacherAdmin()` called `get(/databases/$(database)/documents/teachers/$(request.auth.uid))` without checking if the document exists first.
**Learning:** Calling `get()` on a non-existent document path in Firestore Security Rules causes rule evaluation to crash with an unhandled runtime error instead of evaluating gracefully to `false`.
**Prevention:** Always guard `get()` calls in Firestore Security Rules with an `exists()` check for the document path first (`exists(...) && get(...).data.field == true`).
