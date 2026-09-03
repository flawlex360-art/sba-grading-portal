## 2026-09-03 - Firestore Rule Evaluation Exception Guard
**Vulnerability:** In `firestore.rules`, calling `get()` on a non-existent document path causes Firestore rule evaluation to halt with an unhandled exception.
**Learning:** `isTeacherAdmin()` attempted to call `get(/databases/$(database)/documents/teachers/$(request.auth.uid))` without verifying whether the document existed, causing rule evaluation to crash for users lacking a teacher document.
**Prevention:** Always guard document field lookups with an `exists()` check prior to calling `get()` in Firestore Security Rules.
