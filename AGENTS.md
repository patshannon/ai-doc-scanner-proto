# Agent Handbook

## Mission Snapshot (2025-11-06)
- **Phase:** Image-to-PDF conversion architecture implemented and wired to `/process-document`
- ✅ PyPDF2 extraction, Gemini 2.0 Flash title/category generation, Google Drive + Firebase auth in place
- ✅ Frontend converts images to PDF (client-side via `img2pdf`-style flow) before hitting backend
- 🔄 Outstanding: finish frontend wiring and perform manual `/process-document` end-to-end verification

## Current Focus
- Run manual tests that start with PDF capture/creation → `/process-document` → Drive upload → metadata confirmation
- Validate Gemini-generated titles/categories against invoices, receipts, contracts, tax docs, and unknown types
- Keep docs updated as surface changes (especially `PROCESS_DOCUMENT_API.md` and `docs/specs.md` excerpts)

## Directory-Specific Instructions
- **Backend work:** see `backend/AGENTS.md` for API contracts, auth constraints, and service-specific workflows
- **Frontend work:** see `frontend/AGENTS.md` for Expo/React Native flow, conversion requirements, and Firebase config expectations
- Stay scoped—backend agents should not refactor frontend, and vice versa

## Source of Truth Docs
- Always (re)read `docs/specs.md` plus the area-specific spec (`docs/backend-spec.md` or `docs/frontend-spec.md`) before editing
- Mirror API changes in `backend/PROCESS_DOCUMENT_API.md`; attach rationale in PR/commit summaries when behavior shifts
- `docs/plan.md` tracks roadmap context; skim before large changes

## Build & Run Cheatsheet
- **Frontend:** `cd frontend && npm install && npx expo start`
- **Backend setup:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- **Backend run:** `uvicorn app:app --reload` (`http://localhost:8000`); health check with `curl http://localhost:8000/healthz`
- **Manual test:** POST `/process-document` with `{ pdfData: "data:application/pdf;base64,..." }` and `Authorization: Bearer <firebase-id-token>`

## Coding Style & Naming
- Frontend: plain JavaScript, 2-space indent, maintain file-local quote/semi style, prefer utilities in `frontend/src/lib/`
- Backend: Python w/ 4-space indent, small functions, utilities under `backend/app/services/` when they emerge
- Naming: web files `kebab-case`, Python modules `snake_case`, classes `PascalCase`, constants `UPPER_SNAKE_CASE`

## Testing & Validation
- No automated tests; rely on manual flows for invoices/receipts/contracts/tax/unknowns, low-quality scans, multi-page PDFs, and non-English samples
- Verify: extracted text sanity, Gemini classification accuracy, Drive folder hierarchy + permissions, graceful handling of corrupted PDFs
- Document manual test status in PR descriptions when possible

## Security & Configuration
- Secrets live in `.env`; keep `frontend/.env.example` and `backend/.env.example` updated
- Backend requires: `FIREBASE_PROJECT_ID`, `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`
- Avoid logging PDF text or PII; log diagnostics only; enable `AUTH_DISABLED=true` solely for local debugging

## Architecture Decision — Image-to-PDF Pipeline
- Convert every capture to PDF on the client → backend only ingests `data:application/pdf;base64,...`
- PyPDF2 handles text extraction; Gemini infers title + category even if extraction is sparse
- Google Drive storage uses `Documents/{Category}/{Year}/{Sanitized-Title}.pdf`
- Future: consider OCR fallback (Tesseract/Vision) when PDFs lack text layers

## Known Gaps / Next Steps
- [ ] Frontend: finish image-to-PDF conversion + API integration (Expo `Print`/`FileSystem` flow or equivalent)
- [ ] Backend: add request logging/monitoring and consider OCR fallback hook
- [ ] Test Gemini accuracy for diverse doc sets and image-based PDFs
- [ ] Validate Drive folder structure + permissions in prod-like env

## Agent Rules of Engagement
- Keep PRs small, action-oriented, and update `README.md` if setup steps change
- Coordinate doc updates (`docs/*.md`, `PROCESS_DOCUMENT_API.md`) whenever behavior or API shape changes
- Manual validation over automation for now—note coverage gaps in review comments
