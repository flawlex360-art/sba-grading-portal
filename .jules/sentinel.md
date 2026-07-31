# Sentinel's Journal

## 2025-02-18 - Prevent Client-Side Registration of Administrative Accounts
**Vulnerability:** In `Login.jsx`, a user who tries to log in with `admin@school.com` when the admin document is missing or not found is prompted to click a button that registers them as the admin, creating their administrative Firestore document and credentials client-side. This allows arbitrary initial users to provision an administrative account directly from the frontend login form if they can access the page prior to admin initialization.
**Learning:** Client-side administrative registration is insecure as anyone with initial network access can claim the administrative account. It must be strictly managed out-of-band or server-side (for example, via `register_admin.js`).
**Prevention:** Remove client-side admin self-registration from `Login.jsx` and instruct the user or admin to use the root CLI script `register_admin.js` for initial administrative provisioning.
