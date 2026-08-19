## 2026-08-19 - Firestore Rule Evaluation Crash on Missing Documents
**Vulnerability:** Calling `get()` on a non-existent document path in Firestore security rules causes evaluation to crash and fail closed, disrupting authorized role checks for users without profile documents.
**Learning:** In Firestore Security Rules, calling `.data` on `get()` for a document path that does not exist throws a runtime rule evaluation exception instead of returning `null` or `false`.
**Prevention:** Always guard `get(/databases/$(database)/documents/...)` calls with an `exists(/databases/$(database)/documents/...)` check first to safely evaluate document attributes.
