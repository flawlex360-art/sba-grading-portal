## 2026-09-08 - Guarding Firestore Document Reads Against Non-Existent Document Crashes
**Vulnerability:** Un-guarded `get()` call in Firestore security rules rule evaluation logic (`firestore.rules`).
**Learning:** In Firestore Security Rules, calling `get()` on a non-existent document path throws a runtime evaluation exception, causing rule evaluation to fail and immediately reject access or fail unexpectedly.
**Prevention:** Always check `exists(...)` on the document path before invoking `get(...)` in Firestore Security Rules helper functions.
