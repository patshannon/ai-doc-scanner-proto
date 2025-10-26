# AI Document Scanner — MVP Overview

This repository tracks the planning for an MVP that lets users snap a document, auto-generate a useful title and metadata from on‑device OCR, and upload the file to Google Drive while saving a searchable index in Firestore.

## Current Status
- Planning only; implementation has not started.
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

## Repository Layout (planned)
- frontend/ — Expo app (to be scaffolded)
- backend/ — FastAPI service (to be scaffolded)
- docs/ — Specifications and planning docs

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
