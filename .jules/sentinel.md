# Sentinel Security Journal 🛡️

This journal documents critical, codebase-specific security learnings, vulnerabilities, and prevention strategies for the school grading application.

## 2026-08-07 - Input Validation and Exception Information Disclosure in Backend APIs
**Vulnerability:** The backend endpoints `/api/chat` and `/api/roster/import` leaked raw python exception tracebacks (e.g., sheet parsing errors, Gemini API connection failures) to the client through error messages. Additionally, `/api/chat` was missing input length and size checks, exposing it to denial of service (DoS) and excessive token/resource consumption risks.
**Learning:** This existed because error responses used string conversions of caught exceptions (`str(e)`) to inform clients about errors, and the endpoint relied on default schema definitions without explicitly validating length bounds or container sizes on incoming payloads.
**Prevention:** Always log internal tracebacks securely using a server-side logger (e.g. `logger.exception()`) and return clean, generic error messages to clients. Always validate maximum lengths and sizes on incoming fields (such as messages and lists) to mitigate resource exhaustion or DoS vectors.
