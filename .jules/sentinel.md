## 2025-02-19 - Firestore Security Rules Crash on Non-existent Document Lookups
**Vulnerability:** In `firestore.rules`, checking properties on a document fetched with `get()` where the document does not exist will cause Firestore security rule evaluation to crash, leading to unexpected access denials or errors.
**Learning:** Calling `get()` directly on a path (such as `/databases/$(database)/documents/teachers/$(request.auth.uid)`) assumes the document is guaranteed to exist. If a user signs in but their profile document has not yet been created, the lookup fails catastrophically rather than returning false.
**Prevention:** Always guard `get()` calls in Firestore rules with an `exists()` check first, using logical AND (`&&`) for short-circuit evaluation.
