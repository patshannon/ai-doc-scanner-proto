# Frontend Spec — Expo React Native

## Scope & Goals
- Capture a document image, run on-device OCR (Google ML Kit), suggest metadata (via backend), let user confirm, then upload a PDF to Google Drive. (Searchable indexing is deferred out of scope for now.)

> **Implementation note:** The working prototype now skips the ML Kit/OCR leg and instead compiles PDFs locally, calls `/process-document` for Gemini metadata, then `/upload-document` once the user confirms. The remainder of this spec reflects the earlier ML Kit plan.

## Tech Stack
- Expo (React Native), plain JavaScript (no TypeScript)
- Packages: `expo-camera`, `expo-image-manipulator`, `expo-print`
- Firebase: `@react-native-firebase/app`, `auth`
- Networking: `fetch` or `axios`

## App Flow
1. **CameraScreen** — capture document photos (capture-only for now), show a live thumbnail rail, and enforce the 5-page cap before proceeding.
2. **PageReviewScreen** — preview each page, reorder, delete, or jump back to the camera; users must review here before processing.
3. **ProcessingScreen** — stitch all pages into a multi-page PDF, convert to a data URI, then call `/process-document`.
4. **ConfirmScreen** — show AI-generated metadata (title/category/year/folder + page count) and allow edits.
5. **UploadScreen** — send the confirmed PDF payload to `/process-document` for upload + metadata persistence, then surface Drive link/status.
6. **Done/Home** — return to the home screen and reset local capture state.

### Multi-page Capture Rules
- The frontend only captures photos through the camera flow (no gallery import yet).
- Users can capture up to **5 pages** per document; the UI surfaces the current count and a warning once the cap is hit.
- Page Review allows drag-free reordering via move up/down controls, quick deletes, and full-screen previews so users can confirm the PDF structure before processing.
- `generatePdfFromImages` now uses `pdf-lib` to embed adaptive JPEGs (≈1.5k → 1.0k px width capped around 350 KB/page) directly into the PDF with a light scan-style frame/overlay, keeping the payload lean before it’s base64’d for `/process-document`.

## Data Contract (Backend `/analyze`)
Request
```json
{
  "ocrText": "string",
  "exifDate": "2025-10-26T13:05:00-03:00",
  "thumbBase64": "data:image/jpeg;base64,...",
  "locale": "en-CA"
}
```
Response
```json
{
  "docType": "invoice|receipt|contract|insurance|tax|medical|school|id|other",
  "title": "2025-10-26_Invoice_Acorn-Design_#8123",
  "date": "2025-10-26",
  "tags": ["finance","invoice","acorn-design"],
  "fields": {"invoiceNumber":"8123","vendor":"Acorn Design","total":543.20,"currency":"CAD"},
  "folderPath": "Documents/Invoices/2025",
  "confidence": 0.84
}
```

## Auth & Permissions
- Google Sign-In → obtain Firebase ID token → send as `Authorization: Bearer <idToken>` on API requests.
- Drive: request `https://www.googleapis.com/auth/drive.file`.

## Local Dev
- Env: `.env` with API base URL, Firebase config.
- Commands: `npx expo start` (development), run on simulator/device.

## Project Structure (suggested)
```
frontend/
  app.json
  package.json
  src/
    screens/{Camera,Processing,Confirm,Upload,Done}.jsx
    services/{api.js,drive.js,firebase.js,ocr.js}
    components/*
```

## Errors & Telemetry
- Do not log OCR text. Surface user-friendly errors for camera, OCR, upload, and API validation failures. Record non-PII metrics where possible.
