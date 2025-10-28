"""OCR processing using Tesseract."""

import base64
import io
from typing import Tuple

import pytesseract
from PIL import Image


def extract_base64_data(data_uri: str) -> bytes:
    """
    Extract base64 image data from a data URI.

    Args:
        data_uri: Data URI in format "data:image/jpeg;base64,..."

    Returns:
        Decoded image bytes

    Raises:
        ValueError: If the data URI format is invalid
    """
    if not data_uri.startswith("data:image/"):
        raise ValueError("Invalid data URI: must start with 'data:image/'")

    # Split at the comma to separate metadata from base64 data
    parts = data_uri.split(",", 1)
    if len(parts) != 2:
        raise ValueError("Invalid data URI: missing base64 data")

    try:
        return base64.b64decode(parts[1])
    except Exception as e:
        raise ValueError(f"Failed to decode base64 data: {e}") from e


def perform_ocr(image_data_uri: str) -> str:
    """
    Perform OCR on an image using Tesseract.

    Args:
        image_data_uri: Base64-encoded image data URI

    Returns:
        Extracted text from the image

    Raises:
        ValueError: If the image data is invalid
        Exception: If OCR processing fails
    """
    try:
        # Extract and decode the base64 image data
        image_bytes = extract_base64_data(image_data_uri)

        # Open the image with PIL
        image = Image.open(io.BytesIO(image_bytes))

        # Perform OCR using Tesseract
        # Use config to optimize for documents
        config = "--psm 3"  # Page segmentation mode 3 = automatic page segmentation
        text = pytesseract.image_to_string(image, config=config)

        # Clean up the text (remove excessive whitespace)
        text = text.strip()

        return text

    except ValueError:
        raise
    except Exception as e:
        raise Exception(f"OCR processing failed: {e}") from e
