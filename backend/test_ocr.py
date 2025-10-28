#!/usr/bin/env python3
"""Test script for OCR endpoint."""

import base64
import io
import json

import requests
from PIL import Image, ImageDraw, ImageFont


def create_test_image() -> str:
    """Create a simple test image with text and return as base64 data URI."""
    # Create a white image
    img = Image.new("RGB", (800, 400), color="white")
    draw = ImageDraw.Draw(img)

    # Draw some text
    text_lines = [
        "INVOICE",
        "Acorn Design",
        "Invoice No: 8123",
        "Total Due: $543.20",
        "Date: 2025-10-26",
    ]

    y_position = 50
    for line in text_lines:
        # Use default font (no custom font needed for test)
        draw.text((50, y_position), line, fill="black")
        y_position += 50

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    img_bytes = buffer.getvalue()
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")

    return f"data:image/jpeg;base64,{img_b64}"


def test_ocr_endpoint():
    """Test the /ocr endpoint with a test image."""
    print("Creating test image...")
    image_data_uri = create_test_image()

    print("Sending OCR request to backend...")
    response = requests.post(
        "http://127.0.0.1:8000/ocr",
        json={"image": image_data_uri},
        headers={"Content-Type": "application/json"},
    )

    print(f"Status Code: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("\nOCR Result:")
        print("=" * 50)
        print(result["text"])
        print("=" * 50)
    else:
        print(f"Error: {response.text}")


if __name__ == "__main__":
    test_ocr_endpoint()
