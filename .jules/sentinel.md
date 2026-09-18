## 2025-05-18 - Guarding `get()` calls in Firestore Rules
**Vulnerability:** Calling `get()` on a non-existent document path in Firestore Security Rules causes rule evaluation failure/error, denying access or breaking rule evaluation unexpectedly.
**Learning:** In `firestore.rules`, helper functions like `isTeacherAdmin()` evaluated `get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.isAdmin == true` directly without checking if the document exists first.
**Prevention:** Always guard `get()` calls in Firestore rules with `exists(...)` checks before accessing properties on `.data`.
