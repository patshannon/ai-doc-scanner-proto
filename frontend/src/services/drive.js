import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument, rgb } from 'pdf-lib';
import { Platform } from 'react-native';

const PDF_MAX_BYTES = 50 * 1024 * 1024; // 50MB limit per backend contract
const PDF_MARGIN = 18;
const SCAN_FRAME_COLOR = rgb(0.99, 0.985, 0.96);
const SCAN_BORDER_COLOR = rgb(0.86, 0.84, 0.79);
const SCAN_OVERLAY_COLOR = rgb(1, 1, 1);
const SCAN_TARGET_WIDTH = 1500; // starting width for scan-style export
const SCAN_MIN_WIDTH = 1000; // do not shrink beyond this to preserve legibility
const SCAN_INITIAL_COMPRESSION = 0.58; // start around ~58% quality
const SCAN_MIN_COMPRESSION = 0.4; // lower bound before artifacts dominate
const SCAN_TARGET_PAGE_BYTES = 350 * 1024; // try to keep each page under ~350KB

function estimateByteSize(base64) {
  if (!base64) return 0;
  const padding = (base64.match(/=+$/) || [])[0]?.length || 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}

async function buildScanReadyAsset(uri, pageIndex) {
  if (!uri) {
    throw new Error(`Missing URI for page ${pageIndex + 1}`);
  }
  let width = SCAN_TARGET_WIDTH;
  let compression = SCAN_INITIAL_COMPRESSION;
  let lastResult = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress: compression, format: SaveFormat.JPEG, base64: true }
    );

    if (!manipulated?.base64) {
      throw new Error(`Failed to convert page ${pageIndex + 1} to base64`);
    }

    lastResult = {
      base64: manipulated.base64,
      width: manipulated.width,
      height: manipulated.height
    };

    const byteSize = estimateByteSize(lastResult.base64);
    if (
      byteSize <= SCAN_TARGET_PAGE_BYTES ||
      (width <= SCAN_MIN_WIDTH && compression <= SCAN_MIN_COMPRESSION)
    ) {
      return lastResult;
    }

    width = Math.max(SCAN_MIN_WIDTH, Math.floor(width * 0.86));
    compression = Math.max(SCAN_MIN_COMPRESSION, Math.round((compression - 0.07) * 100) / 100);
  }

  return lastResult;
}

function sanitizeFileName(value) {
  if (!value) return 'document';
  return value
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'document';
}

async function writePdfToCache(pdfDoc, title) {
  if (Platform.OS === 'web') {
    // On web, we return a Data URI directly since we can't write to the file system
    return await pdfDoc.saveAsBase64({ dataUri: true });
  }

  const base64 = await pdfDoc.saveAsBase64({ dataUri: false });
  const safeTitle = sanitizeFileName(title);
  const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const pdfPath = `${targetDir}${safeTitle}-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(pdfPath, base64, {
    encoding: 'base64'
  });
  return pdfPath;
}

export async function generatePdfFromImages(captures, title = 'document', onProgress) {
  if (!Array.isArray(captures) || captures.length === 0) {
    throw new Error('At least one capture is required to build a PDF');
  }
  if (captures.length > 10) {
    throw new Error('Multi-page builder currently supports up to 10 pages');
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < captures.length; i += 1) {
    const capture = captures[i];
    const prepared = await buildScanReadyAsset(capture?.uri, i);
    if (!prepared?.base64) {
      throw new Error(`Failed to prepare page ${i + 1}`);
    }

    const jpgImage = await pdfDoc.embedJpg(prepared.base64);
    const { width, height } = jpgImage.scale(1);
    const pageWidth = width + PDF_MARGIN * 2;
    const pageHeight = height + PDF_MARGIN * 2;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: SCAN_FRAME_COLOR
    });

    page.drawRectangle({
      x: PDF_MARGIN * 0.4,
      y: PDF_MARGIN * 0.4,
      width: pageWidth - PDF_MARGIN * 0.8,
      height: pageHeight - PDF_MARGIN * 0.8,
      color: rgb(0.996, 0.994, 0.985),
      borderWidth: 0.6,
      borderColor: SCAN_BORDER_COLOR
    });

    page.drawImage(jpgImage, {
      x: PDF_MARGIN,
      y: PDF_MARGIN,
      width,
      height,
      opacity: 0.97
    });

    page.drawRectangle({
      x: PDF_MARGIN,
      y: PDF_MARGIN,
      width,
      height,
      color: SCAN_OVERLAY_COLOR,
      opacity: 0.08
    });

    onProgress?.({ current: i + 1, total: captures.length });
  }

  const pdfUri = await writePdfToCache(pdfDoc, title);

  return {
    name: `${title}.pdf`,
    mimeType: 'application/pdf',
    uri: pdfUri,
    pageCount: captures.length
  };
}

export async function convertPdfToDataUri(pdfUri) {
  try {
    if (Platform.OS === 'web') {
      // On web, if it's already a data URI, return it
      if (pdfUri.startsWith('data:')) {
        return pdfUri;
      }
      // If it's a blob URL, we might need to fetch it (not implemented here as we return Data URI above)
      return pdfUri;
    }

    const base64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: 'base64' });
    const byteSize = estimateByteSize(base64);
    if (byteSize > PDF_MAX_BYTES) {
      throw new Error('PDF exceeds the 50MB upload limit');
    }
    return `data:application/pdf;base64,${base64}`;
  } catch (error) {
    throw new Error(`Failed to convert PDF to data URI: ${error.message}`);
  }
}
