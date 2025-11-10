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
  - Capture → **Image Editing** → OCR (backend-based Tesseract) → preview metadata → convert to PDF → upload to Drive
  - Uses Firebase Auth and Firestore (client)
  - **Image Editing**: Built-in editing tools for crop, rotate, brightness, contrast, and filters
  - **PDF Conversion**: Images are converted to PDF using `expo-print` before upload
- Backend: FastAPI (Python)
  - Endpoint `/analyze` parses OCR text, classifies doc type, extracts fields, and suggests title/folder
  - Endpoint `/upload` accepts both images and PDFs for Google Drive upload
  - Verifies Firebase ID tokens
- Services: Google Drive API (file upload), Firebase Auth, Firestore (metadata index)

## Key Documents
- docs/specs.md: End‑to‑end MVP plan and data contracts
- docs/frontend-spec.md: App flow, packages, data contract usage, and structure
- docs/backend-spec.md: Endpoints, models, extraction rules, and structure
- docs/firebase-setup.md: Step-by-step Firebase project setup for the prototype
- docs/IMAGE_EDITING.md: Comprehensive documentation for image editing features

## Repository Layout
- frontend/ — Expo app (scaffolded)
- backend/ — FastAPI service
- docs/ — Specifications and planning docs

## Frontend Quickstart (Prototype)
- `cd frontend && npm install`
- Copy `.env.example` to `.env` and update values. For local backend testing set `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` (or your LAN IP) and leave `EXPO_PUBLIC_USE_MOCKS=false` so the Processing screen calls the FastAPI service.
- With Firebase config in place, the app shows an email/password sign-up & sign-in flow before entering the document pipeline.
- **OCR Implementation:** The prototype uses backend-based OCR (Tesseract via Python) instead of on-device ML Kit:
  - Works immediately with Expo Go—no native builds required
  - Camera captures image → frontend sends to backend → backend performs OCR → returns text
  - For testing without a backend, set `EXPO_PUBLIC_USE_MOCKS=true` to use mock OCR data
- **PDF Conversion:** Captured images are automatically converted to PDF before upload:
  - Uses `expo-print` to generate PDFs from images
  - Images are embedded as base64 data in HTML, then converted to PDF
  - Files are uploaded to Google Drive as `.pdf` with `application/pdf` MIME type
  - Uses `expo-file-system` (v54+) `File` API for reading PDF files before upload
- Camera screen uses the device camera—grant permission on first launch, capture the document, and we'll generate an EXIF timestamp plus a lightweight thumbnail for downstream screens.
- Use the Camera screen's "Test Google OAuth" button to verify Drive access (`drive.file` scope) once you add Google client IDs to `.env`.

## Backend Quickstart (Prototype)
- **Install Tesseract OCR engine** (required for image processing):
  - macOS: `brew install tesseract`
  - Ubuntu/Debian: `sudo apt-get install tesseract-ocr`
  - Windows: Download installer from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
- `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Copy `backend/.env.example` to `.env`. For local development, set `FIREBASE_SKIP_AUTH=1` to bypass Firebase checks until credentials are configured. When ready to integrate with Firebase, set `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS`.
- **Google Drive Setup** (for file uploads):
  - **User OAuth Flow (Recommended)**: Users authorize access to their own Google Drive
    1. Configure Google OAuth client IDs in `frontend/.env` (see Frontend Quickstart)
    2. Users click "Test Google OAuth" in the app to authorize Drive access
    3. The app passes the user's OAuth token to the backend
    4. Files upload to the user's personal Google Drive
  - **Service Account Flow (Optional)**: For backend-only operations without user interaction
    1. Create a Service Account and download the JSON credentials file
    2. Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to the path of your credentials JSON file
    3. Files upload to a shared Drive or service account's Drive
- Run `uvicorn app:app --reload` (default port 8000). The `/healthz` endpoint returns a simple status payload.
- Manual check: POST `/ocr` with base64 image to test OCR, then POST `/analyze` with OCR text to verify doc type, title generation, and folder suggestions align with spec.

## Troubleshooting

- **401 on `/analyze` from the app:**
  - The backend expects a Firebase ID token in `Authorization: Bearer <idToken>`.
  - Signing in with Google OAuth (Drive access token) is not the same as a Firebase ID token.
  - Fix options:
    - Quick dev: set `FIREBASE_SKIP_AUTH=1` in `backend/.env` and restart the server.
    - Proper auth: sign in via the app's Firebase email/password screen (ensure `frontend/.env` has Firebase web config). The app will include your Firebase ID token automatically.
    - If you prefer Google Sign‑In, wire it to Firebase: exchange the Google token for a Firebase credential and call `signInWithCredential`, then the app will have a Firebase ID token.

- **Bloated or blank PDFs after upload:**
  - **Root Cause**: if captures bypass the compression helper, `pdf-lib` receives huge JPEGs and the resulting PDF can exceed Drive/API limits.
  - **Solution**: Always run captures through `generatePdfFromImages()` in `frontend/src/services/drive.js`; it iteratively downsizes each page to ~350 KB and embeds the JPEGs directly via `pdf-lib`, adding the scan-style frame/overlay before handing the file to `/process-document`.

- **expo-file-system API errors:**
  - **Error**: Deprecation warnings around `writeAsStringAsync` / `readAsStringAsync`.
  - **Cause**: Expo v54 nudges apps to the new File API.
  - **Solution**: The PDF helper now imports from `expo-file-system/legacy`, which keeps the existing read/write helpers without console noise. Follow that pattern or migrate the entire flow to the new File API in one shot.

## API Snapshot
- POST `/ocr` → performs OCR on uploaded image, returns `{ text }`
- POST `/analyze` → returns `{ docType, title, date, tags, fields, folderPath, confidence }`
- POST `/upload` → uploads file to Google Drive, returns `{ fileId, webViewLink, folderId }`
- POST `/ensureFolderPath` → ensures folder path exists in Drive, returns `{ folderPath, status }`
- Request body includes OCR text, optional EXIF date, optional thumbnail, and locale
- See `docs/backend-spec.md` for exact request/response shapes

## Next Steps
- Scaffold `frontend/` (Expo) and `backend/` (FastAPI) per the spec documents
- Track implementation tasks and decisions in issues/PRs

## Contributing
- See `AGENTS.md` for repository guidelines (structure, style, testing, and PR standards)
- Keep changes focused and align with the specs in `docs/`
