## 2026-08-24 - Guard Firestore get() calls with exists()
**Vulnerability:** Calling `get()` directly on a document path in Firestore Security Rules without checking `exists()` first causes runtime rule evaluation crashes when the document does not exist.
**Learning:** `get()` throws a runtime exception when fetching a non-existent document path in security rules, which halts rule evaluation and leads to unexpected authorization errors or denial for valid requests.
**Prevention:** Always guard `get()` calls in Firestore rules with an `exists()` check in boolean expressions (e.g. `exists(docPath) && get(docPath).data.isAdmin == true`).
