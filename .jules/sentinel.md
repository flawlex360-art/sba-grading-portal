## 2026-09-10 - Firestore Security Rules Unhandled Non-Existent Document Access
**Vulnerability:** Calling `get()` on a non-existent document path in Firestore Security Rules causes rule evaluation to crash/fail immediately.
**Learning:** In `firestore.rules`, `isTeacherAdmin()` evaluated `get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.isAdmin == true` without checking if the teacher document existed first, causing errors when evaluating rules for newly authenticated users or non-teacher accounts.
**Prevention:** Always guard `get()` calls in Firestore Security Rules with an `exists()` check to ensure the document exists before accessing its properties.
