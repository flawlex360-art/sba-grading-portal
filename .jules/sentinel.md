# Sentinel Security Journal 🛡️

This journal documents critical codebase-specific security findings, patterns, and prevention strategies.

## 2026-08-14 - Python Backend Information Disclosure & DoS via Unrestricted File Uploads
**Vulnerability:** The backend endpoints `/api/chat` and `/api/roster/import` returned raw python exceptions (`str(e)`) directly to the client under `try-except` blocks. Additionally, `/api/roster/import` lacked constraints on file upload sizes, reading any uploaded file fully into memory.
**Learning:** These vulnerabilities existed because there was no centralized standard logging configuration to redirect exception details securely to the server-side console, leading developers to return them in client-side responses for easier debugging. Moreover, FastAPI's `UploadFile` does not automatically enforce content length validation on the server side unless explicitly handled, introducing a Denial of Service (DoS) vector.
**Prevention:**
1. Always configure a standard logger (like the `"backend"` logger) and write raw exceptions to console using `logger.error(..., exc_info=True)`.
2. Return safe, generic error messages to clients instead of `str(e)`.
3. Protect all file upload endpoints by explicitly reading contents up to a maximum defined limit (e.g., `MAX_FILE_SIZE = 5 * 1024 * 1024`) via `await file.read(limit)` and checking lengths, raising `413 Payload Too Large` if exceeded.
