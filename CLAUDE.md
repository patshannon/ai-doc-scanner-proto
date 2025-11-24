# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Document Scanner MVP - A mobile app that captures documents (photos or PDFs), uses AI to auto-generate titles and categories, and uploads them to Google Drive with organized folder structure.

**Current Architecture:** PDF-first workflow
- Frontend: Expo (React Native) mobile app that converts images to PDF before backend processing
- Backend: FastAPI service with Gemini AI for document analysis and Google Drive integration
- No TypeScript, linters, or automated tests - this is a rapid prototype

## Key Commands

### Backend Development

```bash
# Setup
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run server (default port 8000)
uvicorn app:app --reload

# Or alternatively
python app.py

# Health check
curl http://localhost:8000/healthz

# Test document processing
python test_process_document.py
```

### Frontend Development

```bash
# Setup
cd frontend
npm install

# Start Expo dev server
npm start
# or
npx expo start

# Run on specific platform
npx expo start --android
npx expo start --ios
```

### Environment Setup

**Backend** (`backend/.env`):
```
FIREBASE_PROJECT_ID=your-project-id
GEMINI_API_KEY=your-api-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
FIREBASE_SKIP_AUTH=1  # For local dev without Firebase
```

**Frontend** (`frontend/.env`):
```
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000  # or your LAN IP for device testing
EXPO_PUBLIC_USE_MOCKS=false
# Firebase web config also required (see .env.example)
```

## Architecture & System Design

### Current Workflow (Context-Aware PDF Architecture)

1. **Frontend captures image** → converts to PDF using `pdf-lib`
2. **Frontend sends PDF + Google Drive token** to `/process-document` (analysis only)
3. **Backend scans user's Drive folders** (2-3 levels deep) to understand organizational structure
4. **Backend passes folder context + PDF** to Gemini 2.5 Flash for intelligent categorization
5. **AI analyzes document AND suggests optimal folder path** based on user's existing organization
6. **Backend returns** metadata (title, category, year) + suggested path with reasoning
7. **Frontend shows suggestions** → user can review/edit before upload
8. **Frontend calls `/upload-document`** with confirmed metadata + folder path
9. **Backend creates folder path** (if needed) and uploads PDF to Drive

**Key Design Decisions:**
- All documents are converted to PDF before backend processing
- **Context-aware folder selection**: AI sees user's full folder structure before categorizing
- **Flexible categories**: AI adapts to user's organizational patterns (not limited to predefined categories)
- **Single AI call**: Folder context + document analysis happen together (more efficient than old 2-call approach)

### Module Organization

**Backend** (`backend/`):
- `app.py` - FastAPI application with `/process-document` endpoint
- `pdf_processor.py` - Gemini AI orchestration for PDF analysis
- `drive.py` - Google Drive folder management and file uploads
- `auth.py` - Firebase ID token verification
- `models.py` - Pydantic request/response schemas

**Frontend** (`frontend/src/`):
- `screens/` - React Native screens (Auth, Camera, Processing, Confirm, Done, etc.)
- `services/` - API client, Drive integration, Firebase auth, image preprocessing

### Document Categories

**Flexible Categories:** Unlike traditional document scanners, this system uses AI-driven flexible categorization that adapts to YOUR folder structure.

- If you organize by **Work/Personal/Business** → AI uses those categories
- If you organize by **Client names** → AI suggests client-specific paths
- If you organize by **Document types** (Invoices, Receipts, etc.) → AI aligns with those

**Example:** If you have `/Work/Resumes/2025` and upload a resume, AI will suggest that path instead of creating `/Business/Resume/2025`.

### API Endpoints

- `GET /healthz` - Health check
- `POST /process-document` - **Context-aware analysis**: Scans Drive folders, analyzes PDF with Gemini, returns metadata + suggested path with reasoning (REQUIRES Google Drive token)
- `POST /upload-document` - Upload confirmed PDF to user-specified folder path in Drive

**Important:** The `/process-document` endpoint now REQUIRES a Google Drive access token to scan folders and provide context to the AI.

See `backend/PROCESS_DOCUMENT_API.md` for detailed API documentation.

## Important Implementation Details

### PDF Conversion (Frontend)

Images are converted to PDF client-side before sending to backend:
- Uses `pdf-lib` to assemble JPEG pages directly
- Each capture is resized/compressed via `expo-image-manipulator`, then embedded with a light scan-style frame
- Implementation in `frontend/src/services/drive.js`

**Critical:** pdf-lib expects raw JPEG bytes/base64. Always run captures through the compression helper so you feed sanitized base64 rather than `file://` URIs.

### File System API (Expo v54+)

Expo v54+ ships a new File API, but we currently stay on the legacy helpers to avoid touching every caller:
```javascript
import { File } from 'expo-file-system';
const file = new File(uri);
const base64Data = await file.base64();
```

If you adopt the new API, convert everything to `File`/`Directory`. Otherwise keep importing from `expo-file-system/legacy` (as done in `frontend/src/services/drive.js`) so `writeAsStringAsync`/`readAsStringAsync` stay available without warnings.

### Authentication Flow

- Backend expects Firebase ID token in `Authorization: Bearer <token>` header
- For local dev: set `FIREBASE_SKIP_AUTH=1` in backend `.env` to bypass auth
- Google OAuth (for Drive) is separate from Firebase auth - users must sign in with Firebase email/password or link Google Sign-In to Firebase

### AI Model

- Uses **Gemini 2.5 Flash** via `google-generativeai` Python library
- Backend tracks token usage (input/output tokens) and estimated cost
- Cost tracking is included in response for frontend display

## Known Issues & Workarounds

### Empty/Corrupt PDFs After Upload
- **Cause:** expo-print cannot access local file URIs directly
- **Solution:** Convert images to base64 before embedding in HTML for PDF generation

### Image-Based PDFs (No Text Layer)
- **Limitation:** Gemini Vision accuracy drops when PDFs have no embedded text layer
- **Current Behavior:** AI still attempts to infer structure directly from page pixels, which can yield generic titles
- **Future Enhancement:** Add OCR preprocessing (Tesseract/Vision API) so the backend can supply supplemental text to Gemini

### 401 Errors on `/process-document`
- Backend requires Firebase ID token (not Google OAuth token)
- Quick fix for dev: set `FIREBASE_SKIP_AUTH=1` in backend `.env`
- Proper fix: ensure frontend signs in via Firebase and includes ID token in requests

## Development Guidelines

### Code Style

- **Frontend:** Plain JavaScript (no TypeScript), 2-space indent, consistent semicolons/quotes
- **Backend:** Simple Python, 4-space indent, snake_case for modules/functions, PascalCase for classes
- **No linters/formatters configured** - maintain existing style consistency

### Testing

No automated tests for this prototype. Manual testing:
- Happy path: capture image → PDF conversion → `/process-document` → Drive upload
- Test document types: invoices, receipts, contracts, tax docs, unknown types
- Edge cases: corrupted PDFs, low-quality scans, multi-page docs, non-English text

### File Naming

- Web files: `kebab-case.jsx`
- Python modules: `snake_case.py`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### Making Changes

1. Read `docs/specs.md` for product context before making changes
2. Align with `docs/backend-spec.md` or `docs/frontend-spec.md` as applicable
3. Focus changes to relevant directory (`backend/` or `frontend/`) - avoid broad refactors
4. Update `README.md` if setup/behavior changes
5. Add API changes to `backend/PROCESS_DOCUMENT_API.md`
6. Validate manually via curl/Postman or frontend integration

### Commit Guidelines

- Use clear, action-oriented commit messages
- Keep commits focused on single logical changes
- See `AGENTS.md` for repository guidelines

## Security

- Store secrets in `.env` files (never commit)
- Backend `.env.example` and frontend `.env.example` show required variables
- Avoid logging PDF text, extracted content, or PII
- Log only error diagnostics and request metrics

## Recent Major Changes

**Context-Aware Folder Selection (Current):**
- Refactored to scan user's Drive folders BEFORE document analysis
- Single unified AI call: passes folder context + PDF to Gemini simultaneously
- AI now suggests full folder paths based on user's existing organizational patterns
- Flexible categories: adapts to user's folder structure instead of predefined categories
- Google Drive access now REQUIRED (no longer optional)
- Removed `folder_matcher.py` (logic consolidated into unified AI function)
- Updated API: `/process-document` returns `suggestedPath`, `pathReason`, `isExistingPath`
- Updated frontend: displays AI reasoning and allows path editing

**Commit c622c65 (Image-to-PDF Workflow Refactor):**
- Rebuilt from OCR-only to Gemini AI pipeline
- Replaced Tesseract OCR + heuristics with direct Gemini 2.0 Flash PDF analysis
- Changed from 3-step API flow (`/ocr` → `/analyze` → `/upload`) to the streamlined `/process-document` flow
- Added automatic Google Drive folder organization
- Added token usage tracking and cost estimation

## Reference Documentation

- `README.md` - Quickstart and troubleshooting
- `AGENTS.md` - Repository guidelines and architecture decisions
- `docs/specs.md` - Original MVP plan and data contracts
- `backend/PROCESS_DOCUMENT_API.md` - Detailed API documentation
- `docs/backend-spec.md` - Backend design and implementation details
- `docs/frontend-spec.md` - Frontend flow and structure
- `docs/firebase-setup.md` - Firebase project setup instructions
