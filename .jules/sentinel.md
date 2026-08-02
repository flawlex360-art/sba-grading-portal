# Sentinel Security Journal

## 2026-08-02 - Unprotected Collections and Syntax Error in Firestore Security Rules
**Vulnerability:** The `firestore.rules` file had an unclosed bracket syntax error making the rules invalid, completely lacked rules for the `institutions` and `archives` collections, and lacked role-based access controls for the `isSeniorSuperUser` administrative role.
**Learning:** Incomplete rule definition leaves new collections unprotected or completely inaccessible depending on default policy (usually defaulting to deny), while lacking roles like `isSeniorSuperUser` breaks administrative capabilities. Unmatched braces render the entire configuration file syntactically broken and undeployable.
**Prevention:** Always ensure all collections in the database are explicitly guarded with matched read/write rules. Implement a validation stage in CI/CD pipelines to parse Firestore security rules syntax and test authorizations before deployment.
