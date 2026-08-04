# Sentinel Security Journal

## 2025-02-13 - Broken Firestore Security Rules and Missing Access Controls for Institutions & Archives
**Vulnerability:** A missing outer closing brace (`}`) in `firestore.rules` caused a syntax error, preventing rules compilation and deployment. Additionally, access controls were completely missing for the `institutions` and `archives` collections, meaning any client-side queries/writes to those collections were either rejected by default or lacked proper restriction, leaving tenant data unprotected in production.
**Learning:** Security rules often fall out of sync or contain syntax errors when collections are added incrementally on the client-side without updating or verifying the Firestore rule configuration file. Also, the outermost scope of rules must always be closed to ensure they deploy correctly.
**Prevention:** Always parse, validate, and verify that all Firestore rules are complete, syntactically correct, and cover every collection queried by the application before deploying changes. Always include explicit rules for newly introduced database collections.
