# Sentinel Security Journal

## 2025-08-01 - Prevent Unauthorized Client-Side Admin Registration
**Vulnerability:** Client-side registration button allowed anyone to self-register as the Senior Super User (`system@flawlex.com`) directly from the login page if the account didn't exist or was deleted, granting full access to all school tenants.
**Learning:** Administrative accounts must never be provisionable from client-facing interfaces. Standardizing administrative provisioning to out-of-band/server-side CLI tools secures the initialization phase.
**Prevention:** Remove all client-side administrative/super-user registration endpoints and buttons. Handle initialization tasks strictly via secure, authenticated CLI scripts on the server.
