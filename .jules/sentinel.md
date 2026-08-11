# Sentinel Security Journal

## 2026-08-11 - Firestore Security Rules Evaluation Crash and Missing Rules for Core Collections
**Vulnerability:**
1. Calling the Firestore Rules `get()` helper function on a path that does not exist in the database causes rule evaluation to crash immediately with an error (and implicitly denies all access or allows unintended fallback behavior depending on structure). In our case, `isTeacherAdmin()` checked `.data.isAdmin` on `/teachers/$(request.auth.uid)` without first verifying if the teacher document existed in Firestore.
2. The core collections `institutions` and `archives` lacked any defined security rules, meaning that by default they might have been wide open or improperly secured, exposing critical administrative configuration and academic archives.

**Learning:**
1. Firestore rules are strictly evaluated. Accessing any nested property on a non-existent resource reference in Rules is a runtime exception rather than a silent null/undefined check.
2. When introducing new core features or collections (like school-wide rollovers/archives), corresponding security rules must always be added to the security rules definition file to maintain defense-in-depth and avoid default permission fallbacks.

**Prevention:**
1. Always guard `get()` calls in Firestore Rules with preceding `exists()` checks on the same document path to prevent rule evaluation crash.
2. Maintain explicit, property-validated security definitions for every database collection, splitting read, create, and update/delete privileges using the `resource` and `request.resource` contexts.
