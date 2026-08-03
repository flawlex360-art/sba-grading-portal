# Sentinel's Security Journal 🛡️

This journal documents critical, codebase-specific security learnings, vulnerabilities, and prevention strategies for the Flawlex Technologies SBA Portal.

## 2025-02-18 - Client-Side Administrative Self-Registration Vulnerability
**Vulnerability:** The frontend `Login.jsx` component exposed an option to register the Senior Super User account (`system@flawlex.com`) client-side directly from the login page if the account did not already exist in the Firestore database. An attacker or unauthorized visitor could attempts to log in as the system email and trigger client-side creation with arbitrary credentials, taking absolute control over the database.
**Learning:** This vulnerability existed due to an ad-hoc "initial run" or "first-time setup" convenience routine implemented client-side. Allowing administrative accounts to be bootstrapped or self-registered on the client bypasses proper multi-tenant boundaries and authentication checks. Administrative account provisioning must always be isolated out-of-band on a secure server or admin CLI script.
**Prevention:** Remove all self-registration mechanisms from client-facing interfaces. Restrict administrative user creation to server-side or out-of-band CLI scripting (`register_admin.js`), and let standard login flows fail securely without disclosing account existence or prompting registration.
