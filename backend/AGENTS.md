# Backend Agent Guide

## Scope & Priorities
- Maintain the FastAPI `/process-document` (analysis) and `/upload-document` (Drive upload) endpoints that work on base64 PDFs with Gemini-generated metadata
- Own Gemini 2.0 Flash integration, PDF ingestion pipeline, Google Drive file/folder orchestration, and Firebase auth verification
- Keep `PROCESS_DOCUMENT_API.md` authoritative and aligned with `docs/backend-spec.md` + `docs/specs.md`

## Key Files & Modules
- `app.py` — FastAPI entrypoint + routing
- `pdf_processor.py` — PDF text extraction + Gemini prompt orchestration
- `drive.py` — Folder selection/creation and upload helpers
- `auth.py` — Firebase ID token verification + optional dev bypass via `AUTH_DISABLED`
- `models.py` — Pydantic schemas for request/response payloads
- Reference docs: `docs/backend-spec.md`, `docs/specs.md`, `backend/PROCESS_DOCUMENT_API.md`

## Setup & Commands
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```
- Health check: `curl http://localhost:8000/healthz`
- Manual flow: POST `/process-document` with `pdfData` (`data:application/pdf;base64,...`) + `Authorization: Bearer <firebase-id-token>` to retrieve metadata, then POST `/upload-document` with the confirmed fields (and optional `googleAccessToken`) to verify the Drive upload path.

## Implementation Guidelines
- Accept only PDF data URIs; validate mime prefix and enforce size ceilings (~50 MB)
- Feed uploaded PDFs directly to Gemini; handle image-only docs gracefully and consider adding OCR fallbacks when needed
- Gemini prompts should cap titles at 80 chars and map categories to the allowed list (Invoice/Receipt/Contract/Insurance/Tax/Medical/School/ID/Personal/Business/Legal/Financial/Other)
- Organize Drive uploads under `Documents/{Category}/{Year}/{Sanitized-Title}.pdf`; sanitize characters for safe Drive paths
- Keep functions small and pure; share helpers via `backend/app/services/` if logic grows
- Avoid logging PDF text or Gemini responses; log request IDs, timings, and error diagnostics only

## Auth, Config, & Secrets
- Required env vars: `FIREBASE_PROJECT_ID`, `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`; optionally `AUTH_DISABLED=true` for local testing only
- Never commit service-account JSON; rely on `.env` plus `.env.example` updates for new settings
- `auth.py` must reject missing/invalid tokens (401) unless explicit dev bypass is enabled

## Testing & Validation
- Focus on manual scenarios: invoices, receipts, contracts, tax docs, multi-page PDFs, corrupted PDFs, and image-based PDFs without text layers
- Verify Gemini title/category output, Drive folder pathing, and response JSON structure (`title`, `category`, `fileId`, `webViewLink`, `folderId`, `extractedText` preview)
- Record manual test notes in PR descriptions; no automated test harness is required today

## Change Management
- Update `backend/PROCESS_DOCUMENT_API.md` whenever request/response shapes, validation rules, or workflows change
- Sync `docs/specs.md`/`docs/backend-spec.md` snippets if behavior diverges
- Touch `README.md` (root and/or backend) when setup, env vars, or commands change

## Coordination With Frontend
- Communicate any new PDF requirements (size limits, conversion hints) via `frontend/AGENTS.md`
- Document breaking response changes early so the Expo app can adjust; keep payloads backward compatible when possible
