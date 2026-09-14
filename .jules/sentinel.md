## 2026-09-14 - Guarding Firestore `get()` with `exists()` to Prevent Security Rules Crashing

**Vulnerability:** Calling `get()` on a non-existent document path (such as `/teachers/{request.auth.uid}`) causes Firestore Security Rules evaluation to crash with a runtime error.
**Learning:** In Firestore rules, `get()` throws an error if the target document does not exist. If `request.auth.uid` has no corresponding document in `teachers`, `isTeacherAdmin()` fails abruptly.
**Prevention:** Always check `exists(path)` before attempting to read `get(path).data` in Firestore Security Rules.
