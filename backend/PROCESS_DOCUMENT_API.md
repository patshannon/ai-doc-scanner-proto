# Process Document API

## Overview

The `/process-document` endpoint provides a streamlined workflow for processing PDF documents with AI-powered title and category generation.

## Workflow

1. **Frontend**: User takes a picture of a document
2. **Frontend**: Convert the image to PDF format
3. **Frontend**: Send the PDF to `/process-document` for AI analysis (Gemini generates title/category/year + folder suggestions)
4. **Frontend**: Shows the analysis result and allows edits (title/category/folder/year)
5. **Frontend**: Calls `/upload-document` with the confirmed metadata
6. **Backend**: Ensures the Drive folder path exists and uploads the PDF
7. **Backend**: Returns Drive IDs/links for confirmation

## Endpoint Details

### POST /process-document — Analyze PDF (no upload)

Used right after the PDF is created. Gemini analyzes the document and returns suggested metadata plus optional Drive folder insights if a Google access token is provided.

#### Request

**Headers**
- `Authorization: Bearer <firebase-id-token>` (required unless `FIREBASE_SKIP_AUTH=1`)
- `Content-Type: application/json`

**Body**
```json
{
  "pdfData": "data:application/pdf;base64,JVBERi0xLjQKJ...",
  "googleAccessToken": "ya29.a0AfH6SMB...",   // optional — enables Drive folder scan
  "selectedParentFolderId": "root-folder-id"  // optional — preselect a root folder
}
```

**Key Parameters**
- `pdfData` (required): Base64 data URI for the PDF. Must be `data:application/pdf;base64,...` and ≤ 50 MB.
- `googleAccessToken` (optional): User’s Drive token with `drive.file` and `drive.metadata.readonly` scopes. When provided, the backend scans root folders and can suggest the best parent folder.
- `selectedParentFolderId` (optional): If the frontend already knows which root folder to anchor under, pass the Drive folder ID so the backend can build the preview path accordingly.

#### Response

```json
{
  "title": "Invoice for Web Development Services",
  "category": "Invoice",
  "year": 2024,
  "inputTokens": 812,
  "outputTokens": 62,
  "estimatedCost": 0.00028,
  "suggestedParentFolder": "Finance",
  "suggestedParentFolderId": "1zY2xW3vU4tS5rQ6",
  "availableParentFolders": [
    { "id": "1zY2xW3vU4tS5rQ6", "name": "Finance", "path": "Finance" },
    { "id": "9pO7nM8lK9jI0hG1", "name": "Personal", "path": "Personal" }
  ],
  "finalFolderPath": "Finance/Invoice/2024"
}
```

Fields:
- `title`, `category`, `year`: Gemini-generated metadata
- `inputTokens`, `outputTokens`, `estimatedCost`: Usage metrics for transparency
- `suggestedParentFolder{Id}`: AI suggestion for which root folder to use (when Drive token provided)
- `availableParentFolders`: All root-level folders discovered (`FolderInfo` objects)
- `finalFolderPath`: The string path that would be used if the upload happened now (falls back to `Category/Year` when no Drive token is supplied)

Errors mirror standard FastAPI responses (`400` invalid data URI, `401` auth issues, `502` Drive scan failures, `500` Gemini errors).

---

### POST /upload-document — Upload confirmed PDF

Called after the user approves/edits the metadata. This endpoint ensures the folder path exists (optionally under a user-selected root folder) and uploads the PDF to Drive.

#### Request

**Headers**
- Same as above (`Authorization` + `Content-Type`)

**Body**
```json
{
  "pdfData": "data:application/pdf;base64,JVBERi0xLjQKJ...",
  "googleAccessToken": "ya29.a0AfH6SMB...",   // optional — defaults to service account when omitted
  "title": "Invoice for Web Development Services",
  "category": "Invoice",
  "year": 2024,
  "selectedParentFolderId": "1zY2xW3vU4tS5rQ6" // optional root folder choice
}
```

**Key Parameters**
- `title`, `category`, `year`: Required metadata coming from the confirmation screen
- `selectedParentFolderId`: Root folder ID (from `availableParentFolders`) if the user chose a specific top-level folder

#### Response

```json
{
  "driveFileId": "1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1u",
  "driveUrl": "https://drive.google.com/file/d/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1u/view",
  "finalFolderPath": "Finance/Invoice/2024"
}
```

Errors:
- `400` invalid/missing fields
- `401` missing/invalid Firebase token
- `502` Drive ensure/upload failures
- `500` unexpected server errors

## Folder Structure

Documents are automatically organized in Google Drive using the following structure:

```
Documents/
  └── {Category}/
      └── {Year}/
          └── {Sanitized-Title}.pdf
```

**Example:**
```
Documents/
  └── Invoice/
      └── 2024/
          └── Invoice_for_Web_Development_Services.pdf
```

## Categories

The AI can classify documents into the following categories:

- **Invoice**: Business invoices and billing documents
- **Receipt**: Purchase receipts and transaction records
- **Contract**: Legal contracts and agreements
- **Insurance**: Insurance policies and claims
- **Tax**: Tax documents and returns
- **Medical**: Medical records and prescriptions
- **School**: Educational documents and transcripts
- **ID**: Identification documents
- **Personal**: Personal correspondence and documents
- **Business**: General business documents
- **Legal**: Legal documents
- **Financial**: Financial statements and records
- **Other**: Documents that don't fit other categories

## Setup

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Firebase configuration
FIREBASE_PROJECT_ID=your-project-id

# Google Drive (optional, for service account)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Gemini API (required)
GEMINI_API_KEY=your-gemini-api-key

# Development only
FIREBASE_SKIP_AUTH=1
```

### Get Gemini API Key

1. Visit https://makersuite.google.com/app/apikey
2. Create a new API key
3. Add it to your `.env` file

### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Run the Server

```bash
cd backend
python app.py
```

The server will start on `http://localhost:8000`.

## Testing

### Test Script

A test script is provided to verify the endpoint:

```bash
cd backend
python test_process_document.py
```

This script:
1. Creates a sample PDF invoice
2. Converts it to base64 data URI
3. Sends it to the `/process-document` endpoint
4. Displays the response

### Manual Testing with curl

```bash
# First, create a base64-encoded PDF
base64 -i document.pdf -o document.b64

# Then send the request
curl -X POST http://localhost:8000/process-document \
  -H "Content-Type: application/json" \
  -d '{
    "pdfData": "data:application/pdf;base64,'"$(cat document.b64)"'",
    "googleAccessToken": null
  }'
```

## Frontend Integration

### Example: React Native with Expo

```typescript
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { PDFDocument } from 'pdf-lib';

async function processDocumentFlow() {
  // 1. Take a picture
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled) return;

  // 2. Compress the capture and grab base64
  const prepared = await manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1400 } }],
    { compress: 0.6, format: SaveFormat.JPEG, base64: true }
  );

  // 3. Build a tiny PDF directly with pdf-lib
  const pdfDoc = await PDFDocument.create();
  const jpgImage = await pdfDoc.embedJpg(prepared.base64);
  const { width, height } = jpgImage.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(jpgImage, { x: 0, y: 0, width, height });

  const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
  const pdfPath = `${FileSystem.cacheDirectory}capture-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(pdfPath, pdfBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;

  // 4. Analyze PDF (no upload yet)
  const analysisResponse = await fetch('https://your-api.com/process-document', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firebaseIdToken}`,
    },
    body: JSON.stringify({
      pdfData: pdfDataUri,
      googleAccessToken, // optional — enables folder suggestions
    }),
  });

  const analysis = await analysisResponse.json();
  console.log('AI Title:', analysis.title);
  console.log('AI Category:', analysis.category);

  // 5. After user edits metadata, upload via the second endpoint
  const uploadResponse = await fetch('https://your-api.com/upload-document', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firebaseIdToken}`,
    },
    body: JSON.stringify({
      pdfData: pdfDataUri,
      googleAccessToken,
      title: finalTitle,                 // user-confirmed values
      category: finalCategory,
      year: finalYear,
      selectedParentFolderId: chosenParentFolderId
    }),
  });

  const upload = await uploadResponse.json();
  console.log('Google Drive link:', upload.driveUrl);
}
```

## Architecture

```
┌─────────────┐
│  Frontend   │
│  (React     │
│   Native)   │
└──────┬──────┘
       │ POST /process-document (analysis)
       │ {pdfData, googleAccessToken?}
       │
       │ ← user edits metadata →
       │
       │ POST /upload-document (final upload)
       │ {pdfData, title, category, year, ...}
       ↓
┌─────────────┐
│   FastAPI   │
│   Backend   │
└──────┬──────┘
       │
       ├─────→ Analyze PDF (Gemini 2.5 Flash)
       │
       ├─────→ Suggest / create folder structure
       │
       └─────→ Upload PDF to Drive
                        │
                        ↓
                ┌───────────────┐
                │ Google Drive  │
                │ Documents/    │
                │   Category/   │
                │     Year/     │
                │       file    │
                └───────────────┘
```

## Differences from Old Workflow

### Old Workflow (Deprecated)
1. Frontend sends image to `/ocr` endpoint
2. Backend performs OCR with Tesseract
3. Frontend sends OCR text to `/analyze` endpoint
4. Backend uses heuristic rules to classify and extract fields
5. Frontend sends image to `/upload` endpoint
6. Backend uploads image to Google Drive

### New Workflow (Recommended)
1. Frontend converts image(s) to PDF locally
2. Frontend calls `/process-document` to get AI-generated metadata + folder suggestions
3. User tweaks metadata/folder choice if needed
4. Frontend calls `/upload-document` to persist the final PDF + metadata to Drive

**Benefits:**
- ✅ Still a single processing pipeline for PDFs
- ✅ AI-powered title/category generation
- ✅ Clear separation between “preview” and “upload” for better UX
- ✅ Automatic folder organization with optional Drive scans

## Troubleshooting

### "GEMINI_API_KEY environment variable is not set"
Make sure you've created a `.env` file with your Gemini API key.

### "Failed to upload file: Insufficient Permission"
- If using user OAuth: Make sure the `googleAccessToken` is valid and has the correct scopes
- If using service account: Make sure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON file

### "PDF analysis failed"
- Ensure the PDF is not corrupted and is encoded as `data:application/pdf;base64,...`
- Gemini Vision can struggle with extremely low-resolution scans; consider improving capture quality or adding an OCR fallback if failures persist

### "Connection refused to localhost:8000"
Make sure the backend server is running:
```bash
cd backend
python app.py
```
