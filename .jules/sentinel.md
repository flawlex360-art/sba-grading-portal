# Sentinel Security Journal

## 2026-03-30 - Guarding Firestore `get()` Calls with `exists()` Checks
**Vulnerability:** In `firestore.rules`, `isTeacherAdmin()` invoked `get()` directly on a teacher document path (`/databases/$(database)/documents/teachers/$(request.auth.uid)`). When evaluated for users without a corresponding document (such as newly registered users or super admins without a teacher record), `get()` raised an unhandled runtime error in the Firestore Security Rules engine.
**Learning:** In Cloud Firestore Security Rules, calling `get()` on a non-existent document path terminates rule evaluation immediately with an error, causing unexpected permission denied responses or auth evaluation failure.
**Prevention:** Always check `exists(path)` prior to executing `get(path)` in Firestore Security Rules helper functions.
