## 2025-08-09 - [Firestore Rule Crash Prevention]
**Vulnerability:** Rule evaluation crash on non-existent document paths.
**Learning:** Calling `get()` directly on a non-existent document path in `firestore.rules` triggers a rule evaluation exception, which terminates the rule assessment process and denies authorization arbitrarily or causes security rule inconsistencies.
**Prevention:** Always guard `get()` calls in firestore rules with an `exists()` check on the target document path first.

## 2025-08-09 - [Secure Error Handling & Input Validation]
**Vulnerability:** Information leakage through verbose stack trace disclosure & Denial of Service through resource abuse.
**Learning:** Exposing raw exception details (`str(e)`) in API response messages leaks backend implementation details to end-users. Lacking request size/length constraints opens endpoints to denial of service attacks via token draining or excessive memory allocation.
**Prevention:** Catch exception context using standard server-side Python `logging`, return secure and generic user-facing errors, and strictly enforce limits on input parameters and payload upload sizes.
