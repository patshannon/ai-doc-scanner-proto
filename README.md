# AI Document Scanner — MVP Overview

This repository tracks the planning for an MVP that lets users snap a document, auto-generate a useful title and metadata from on‑device OCR, and upload the file to Google Drive while saving a searchable index in Firestore.

## Current Status
- Frontend scaffolded under `frontend/` per `docs/frontend-spec.md` with minimal prototype screens and service stubs.
- Backend scaffolded under `backend/` with FastAPI endpoints and heuristics for `/analyze` plus a stubbed `/ensureFolderPath`.
- Specs live in `docs/` and define the intended API, flows, and data contracts.

## Prototype Scope
- Keep it simple: plain JavaScript in the frontend (no TypeScript).
- No linters/formatters and no automated tests for this prototype.
- Focus on getting the end-to-end flow working.

## Planned Architecture
- Frontend: Expo (React Native) mobile app
  - Capture → OCR (Google ML Kit) → preview metadata → upload PDF
  - Uses Firebase Auth and Firestore (client)
- Backend: FastAPI (Python)
  - Endpoint `/analyze` parses OCR text, classifies doc type, extracts fields, and suggests title/folder
  - Verifies Firebase ID tokens
- Services: Google Drive API (file upload), Firebase Auth, Firestore (metadata index)

## Key Documents
- docs/specs.md: End‑to‑end MVP plan and data contracts
- docs/frontend-spec.md: App flow, packages, data contract usage, and structure
- docs/backend-spec.md: Endpoints, models, extraction rules, and structure
 - docs/firebase-setup.md: Step-by-step Firebase project setup for the prototype

## Repository Layout
- frontend/ — Expo app (scaffolded)
- backend/ — FastAPI service
- docs/ — Specifications and planning docs

## Frontend Quickstart (Prototype)
- `cd frontend && npm install && npx expo start`
- Copy `.env.example` to `.env` and update values. For local backend testing set `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` (or your LAN IP) and leave `EXPO_PUBLIC_USE_MOCKS=false` so the Processing screen calls the FastAPI service.
- With Firebase config in place, the app shows an email/password sign-up & sign-in flow before entering the document pipeline.
- Use the Camera screen’s “Test Google OAuth” button to verify Drive access (`drive.file` scope) once you add Google client IDs to `.env`.

## Backend Quickstart (Prototype)
- `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Copy `backend/.env.example` to `.env`. For local development, set `FIREBASE_SKIP_AUTH=1` to bypass Firebase checks until credentials are configured. When ready to integrate with Firebase, set `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS`.
- Run `uvicorn app:app --reload` (default port 8000). The `/healthz` endpoint returns a simple status payload.
- Manual check: POST `/analyze` with OCR text to verify doc type, title generation, and folder suggestions align with spec.

## API Snapshot (planned)
- POST `/analyze` → returns `{ docType, title, date, tags, fields, folderPath, confidence }`
- Request body includes OCR text, optional EXIF date, optional thumbnail, and locale
- See `docs/backend-spec.md` for exact request/response shapes

## Next Steps
- Scaffold `frontend/` (Expo) and `backend/` (FastAPI) per the spec documents
- Track implementation tasks and decisions in issues/PRs

## Contributing
- See `AGENTS.md` for repository guidelines (structure, style, testing, and PR standards)
- Keep changes focused and align with the specs in `docs/`
