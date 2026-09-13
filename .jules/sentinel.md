## 2025-05-18 - Guard Firestore Document Fetching in Security Rules
**Vulnerability:** Calling `get()` on a non-existent document path in Firestore Security Rules causes rule evaluation to crash with an error, resulting in unexpected authorization check failures.
**Learning:** In `firestore.rules`, `isTeacherAdmin()` attempted to read `get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.isAdmin` without first checking if the teacher document exists.
**Prevention:** Always guard `get()` calls in Firestore Security Rules with `exists(...)` checks to ensure safe evaluation.
