# Sentinel's Security Journal 🛡️

## 2026-08-10 - Firestore Rule Evaluation Crash on Non-existent Documents
**Vulnerability:** In `firestore.rules`, calling the `get()` function directly on a path for a document that does not exist in the database causes Firestore to crash the rule evaluation process. This results in access being completely denied to legitimate users because of the rule evaluation failure.
**Learning:** Checking for user roles using a teacher document document fetch like `get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.isAdmin` failed gracefully when the document existed, but triggered an unhandled exception internally in Firestore's rule engine when the document was missing (e.g., during sign up, deleted account, or initial environment setup).
**Prevention:** Always guard `get()` operations in Firestore Security Rules by first verifying the document's existence using the `exists()` helper function. For example: `exists(/databases/$(database)/documents/teachers/$(request.auth.uid)) && get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.isAdmin == true`.
