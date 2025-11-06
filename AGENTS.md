# Repository Guidelines

## Project Status (2025-11-06)
**Phase:** Backend Processing Rebuilt with Gemini AI Integration
- ✅ PDF text extraction with PyPDF2
- ✅ Gemini 2.0 Flash model for AI-powered title & category generation
- ✅ Google Drive integration for document upload and folder organization
- ✅ Firebase authentication with ID token verification
- 🔄 Frontend integration in progress; manual testing of `/process-document` endpoint needed

## Project Structure & Module Organization
- `frontend/` — Client app (React Native/Expo, JavaScript). Captures images/PDFs and sends to backend.
- `backend/` — Python FastAPI server with Gemini AI, PDF processing, and Google Drive integration.
  - `app.py` — Main FastAPI application with `/process-document` endpoint.
  - `pdf_processor.py` — PDF text extraction and Gemini-based title/category generation.
  - `drive.py` — Google Drive folder management and document upload.
  - `auth.py` — Firebase ID token verification.
  - `models.py` — Pydantic request/response schemas.
- `docs/` — Product and technical specs. See `docs/specs.md` for full context.
- `README.md` — Keep quickstart instructions up to date.

## Build and Development Commands
- Frontend (prototype):
  - `cd frontend && npm install && npx expo start` — Start Expo dev server.
- Backend (prototype):
  - Setup: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
  - Run: `uvicorn app:app --reload` (listens on `http://localhost:8000`)
  - Health check: `curl http://localhost:8000/healthz`
  - Test document processing: POST to `/process-document` with `{ pdfData: "data:application/pdf;base64,..." }` and `Authorization: Bearer <firebase-id-token>`

## Coding Style & Naming Conventions
- Frontend: plain JavaScript (no TypeScript). 2‑space indent. Keep semicolon and quote style consistent within files. No linters/formatters configured.
- Backend: simple Python. 4‑space indent. Follow common sense readability. No linters/formatters configured.
- Naming: web files `kebab-case`, Python modules `snake_case`, classes `PascalCase`, constants `UPPER_SNAKE_CASE`.
- Keep functions small; prefer utilities in `frontend/src/lib/` and `backend/app/services/`.

## Testing Guidelines
- No automated tests for the prototype. Do manual checks:
  - Happy path: capture/upload PDF → `/process-document` → Gemini generates title & category → Drive upload succeeds.
  - Test with: invoices, receipts, contracts, tax documents, and unknown document types.
  - Edge cases: corrupted PDFs, scanned images (low quality), multi-page documents, non-English text.
  - Verify: extracted text accuracy, category classification, Drive folder organization.

## Commit & Pull Request Guidelines
- Use clear, action‑oriented commit messages (Conventional Commits optional).
- PRs include a concise description, linked issues (if any), and screenshots for UI changes.
- Keep PRs focused and reviewable. Update `README.md` if setup or behavior changes.

## Security & Configuration Tips
- Store secrets in `.env` (not committed). Provide `frontend/.env.example` and `backend/.env.example`.
- Required env vars (backend):
  - `FIREBASE_PROJECT_ID` — Firebase project ID
  - `GEMINI_API_KEY` — Google Generative AI API key (for Gemini 2.0 Flash)
  - `GOOGLE_APPLICATION_CREDENTIALS` — Path to Firebase service account JSON (for Drive & Firestore)
- Avoid logging PDF text, extracted content, or PII; log only error diagnostics and request metrics.
- Disable auth in dev mode via `AUTH_DISABLED=true` if needed for local testing.

## Recent Backend Changes (Commit 9000527)
### What Changed
- **Rebuilt PDF processing** from OCR-only to full Gemini AI pipeline:
  - Text extraction now uses PyPDF2 (supports native PDFs without OCR dependency).
  - AI-powered title & category generation via Gemini 2.0 Flash (replaces heuristics).
  - Automatic Google Drive upload with folder organization.
- **New endpoint:** `POST /process-document` accepts base64-encoded PDF, returns title, category, Drive fileId & link.
- **Updated auth:** Firebase ID token verification required (with dev bypass support).

### Dependencies Added
- `google-generativeai` — Gemini API client
- `PyPDF2` — PDF text extraction
- `google-cloud-firestore`, `google-auth` — Cloud services

### Next Steps / Known Gaps
- [ ] Frontend: implement PDF capture/encoding and API integration
- [ ] Test Gemini category accuracy and title generation with diverse document types
- [ ] Verify Drive folder structure and permissions in production
- [ ] Add request logging & monitoring for API health
- [ ] Consider adding document preview/thumbnail generation

## Agent-Specific Instructions
- Read `docs/specs.md` before changes and align with `docs/backend-spec.md` and `docs/frontend-spec.md`.
- For backend: focus on `backend/` directory. For frontend: focus on `frontend/` directory. Avoid broad refactors.
- Add concise doc updates in `PROCESS_DOCUMENT_API.md` (backend) or relevant docs/ files for API changes.
- No automated tests in prototype; validate manually via curl/Postman or frontend integration tests.
