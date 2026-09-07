## 2026-09-07 - FastAPI slowapi Rate Limiting Endpoint Signatures
**Vulnerability:** Un-rate-limited backend POST endpoints allowing potential DoS or brute-force requests.
**Learning:** Decorating FastAPI route handlers with `slowapi` (`@limiter.limit(...)`) requires `request: Request` in the endpoint parameter signature so slowapi can retrieve the remote address key.
**Prevention:** Always ensure `request: Request` is present in FastAPI route handler parameters when applying rate limits.
