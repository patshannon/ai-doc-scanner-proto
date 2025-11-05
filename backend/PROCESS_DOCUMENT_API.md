# Process Document API

## Overview

The `/process-document` endpoint provides a streamlined workflow for processing PDF documents with AI-powered title and category generation.

## Workflow

1. **Frontend**: User takes a picture of a document
2. **Frontend**: Convert the image to PDF format
3. **Frontend**: Send PDF via POST request to `/process-document` endpoint
4. **Backend**: Extract text from PDF
5. **Backend**: Use Gemini 2.5 Flash to generate a relevant title and category
6. **Backend**: Upload PDF to user's Google Drive with organized folder structure
7. **Backend**: Return document metadata and Google Drive link

## Endpoint Details

### POST /process-document

Process a PDF document and upload it to Google Drive.

#### Request

**Headers:**
- `Authorization: Bearer <firebase-id-token>` (required, unless `FIREBASE_SKIP_AUTH=1` for development)
- `Content-Type: application/json`

**Body:**
```json
{
  "pdfData": "data:application/pdf;base64,JVBERi0xLjQKJ...",
  "googleAccessToken": "ya29.a0AfH6SMB..." // optional
}
```

**Parameters:**
- `pdfData` (string, required): Base64-encoded PDF data URI
  - Format: `data:application/pdf;base64,<base64-data>`
  - Max size: 50MB
- `googleAccessToken` (string, optional): User's Google OAuth access token
  - If provided, uploads to user's personal Google Drive
  - If not provided, falls back to service account (if configured)

#### Response

**Success (200):**
```json
{
  "title": "Invoice for Web Development Services",
  "category": "Invoice",
  "fileId": "1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1u",
  "webViewLink": "https://drive.google.com/file/d/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1u/view",
  "folderId": "1zY2xW3vU4tS5rQ6pO7nM8lK9jI0hG1f",
  "extractedText": "INVOICE\nInvoice Number: INV-2024-001..."
}
```

**Response Fields:**
- `title` (string): AI-generated document title (max 80 characters)
- `category` (string): AI-determined category
  - Possible values: Invoice, Receipt, Contract, Insurance, Tax, Medical, School, ID, Personal, Business, Legal, Financial, Other
- `fileId` (string): Google Drive file ID
- `webViewLink` (string): Direct link to view the file in Google Drive
- `folderId` (string): Google Drive folder ID where file was uploaded
- `extractedText` (string): First 500 characters of extracted text (for reference)

**Error (400):**
```json
{
  "detail": "Invalid data URI format"
}
```

**Error (401):**
```json
{
  "detail": "Missing Authorization header"
}
```

**Error (500):**
```json
{
  "detail": "Document processing failed: <error-message>"
}
```

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
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

async function processDocument() {
  // 1. Take a picture
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled) return;

  // 2. Convert image to PDF
  const html = `
    <html>
      <body>
        <img src="${result.assets[0].uri}" style="width: 100%;" />
      </body>
    </html>
  `;

  const { uri: pdfUri } = await Print.printToFileAsync({ html });

  // 3. Read PDF as base64
  const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;

  // 4. Send to backend
  const response = await fetch('https://your-api.com/process-document', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firebaseIdToken}`,
    },
    body: JSON.stringify({
      pdfData: pdfDataUri,
      googleAccessToken: googleAccessToken, // from Google Sign-In
    }),
  });

  const data = await response.json();
  console.log('Document processed:', data);
  console.log('Title:', data.title);
  console.log('Category:', data.category);
  console.log('Google Drive link:', data.webViewLink);
}
```

## Architecture

```
┌─────────────┐
│  Frontend   │
│  (React     │
│   Native)   │
└──────┬──────┘
       │ POST /process-document
       │ {pdfData, googleAccessToken}
       ↓
┌─────────────┐
│   FastAPI   │
│   Backend   │
└──────┬──────┘
       │
       ├─────→ Extract text (PyPDF2)
       │
       ├─────→ Generate title/category (Gemini 2.5 Flash)
       │
       ├─────→ Create folder (Google Drive API)
       │
       └─────→ Upload PDF (Google Drive API)
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
1. Frontend converts image to PDF locally
2. Frontend sends PDF to `/process-document` endpoint
3. Backend extracts text, uses AI for classification, and uploads to Google Drive in one step

**Benefits:**
- ✅ Single API call instead of three
- ✅ AI-powered title and category generation (more accurate)
- ✅ PDFs are better for document archival than images
- ✅ Simplified frontend code
- ✅ Automatic folder organization

## Troubleshooting

### "GEMINI_API_KEY environment variable is not set"
Make sure you've created a `.env` file with your Gemini API key.

### "Failed to upload file: Insufficient Permission"
- If using user OAuth: Make sure the `googleAccessToken` is valid and has the correct scopes
- If using service account: Make sure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON file

### "PDF text extraction failed"
- Ensure the PDF is not corrupted
- Some PDFs (especially scanned documents) might not have extractable text. Consider using OCR first if needed.

### "Connection refused to localhost:8000"
Make sure the backend server is running:
```bash
cd backend
python app.py
```
