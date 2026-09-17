## 2025-05-20 - Unhandled Document Lookup in Firestore Security Rules
**Vulnerability:** Calling `get()` on a non-existent document path in Firestore Security Rules throws a runtime rule evaluation error, causing security rules checks to fail unexpectedly and abort authorization checks.
**Learning:** In Firestore rules, `get()` assumes the document exists. If it does not exist, evaluation terminates immediately with an error rather than returning `null` or `false`.
**Prevention:** Always check `exists(/databases/$(database)/documents/...)` prior to executing `get(...)` in Firestore Security Rules helper functions.
