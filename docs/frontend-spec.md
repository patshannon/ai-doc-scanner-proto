# Frontend Spec — Expo React Native

## Scope & Goals
- Capture a document image, run on-device OCR (Google ML Kit), suggest metadata (via backend), let user confirm, then upload a PDF to Google Drive and persist an index in Firestore.

## Tech Stack
- Expo (React Native), plain JavaScript (no TypeScript)
- Packages: `expo-camera`, `expo-image-manipulator`, `expo-print`
- Firebase: `@react-native-firebase/app`, `auth`, `firestore`
- Networking: `fetch` or `axios`

## App Flow
1. CameraScreen: capture → crop/rotate/enhance.
2. ProcessingScreen: run ML Kit OCR (offline) → build request → POST `/analyze`.
3. ConfirmScreen: show docType/title/date/tags → allow edits.
4. UploadScreen: generate PDF, upload to Drive (scope `drive.file`).
5. DoneScreen: show success and link; write Firestore record.

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
- Firestore: enforce per-user read/write via rules.

## Firestore Document (reference)
```json
{
  "fileId":"drive-id","name":"2025-10-26_Invoice_...pdf","docType":"invoice","docDate":"2025-10-26",
  "tags":["finance","invoice","acorn-design"],
  "fields":{"invoiceNumber":"8123","vendor":"Acorn Design","total":543.2,"currency":"CAD"},
  "textHash":"sha256(ocrTextNormalized)","confidence":0.84,
  "createdAt":173,"updatedAt":173
}
```

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
