# Frontend Agent Guide

## Scope & Priorities
- Expo React Native prototype that captures docs, converts every capture to PDF locally, POSTs to `/process-document` for analysis, then `/upload-document` for the final Drive upload
- Handle Firebase auth (Google Sign-In) to obtain ID tokens + optional Drive OAuth token
- Present Gemini-generated title/category suggestions for confirmation, then surface Drive links after upload

## Key Files & Docs
- `App.js`, `src/screens/*`, `src/services/*` for camera, OCR (if needed), API, Drive, and Firebase glue
- `docs/frontend-spec.md` for UX flow + data contract, `docs/specs.md` for end-to-end context
- Cross-check payload expectations with `backend/PROCESS_DOCUMENT_API.md`

## Setup & Commands
```bash
cd frontend
npm install
npx expo start
```
- Provide `.env` with API base URL, Firebase config, and Google OAuth client IDs; mirror required keys in `frontend/.env.example`

## Implementation Guidelines
- Capture → crop/enhance using `expo-camera` + `expo-image-manipulator`
- Keep capture-only flow for now and enforce a 5-page max per document; Camera shows thumbnail rail + cap messaging, while PageReview lets users preview/reorder/delete before processing
- Convert image(s) to PDF using `expo-print` or equivalent; ensure exports follow `data:application/pdf;base64,<payload>` and stay <50 MB
- Send `{ pdfData, googleAccessToken? }` with `Authorization: Bearer <firebase-id-token>` header; handle 401/400 gracefully
- Cache minimal state (title/category edits, folder hints) locally before upload; avoid storing PDF text or sensitive data in logs
- Maintain 2-space indentation, plain JavaScript; keep shared helpers in `src/lib/` or `src/services/`

## Auth & Cloud Integration
- Use Firebase Auth to grab ID tokens on every request; refresh when expired
- Obtain Google Drive access token when user-driven uploads are required; fall back to backend service account otherwise
- Respect scopes: `https://www.googleapis.com/auth/drive.file`

## Testing & Validation
- Manually cover flows for invoices, receipts, contracts, tax docs, and edge cases (multi-page, low light, non-English)
- Verify PDF conversion fidelity, backend round-trip, and Drive link rendering
- Capture screenshots/GIFs for UI changes and attach to PRs

## Change Management & Coordination
- Update `README.md` + `docs/frontend-spec.md` when flow, deps, or env vars change
- Notify backend agents via `backend/AGENTS.md` when request payloads or retry logic changes
- Keep feature work targeted; avoid backend refactors from the frontend workspace
