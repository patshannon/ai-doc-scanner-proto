#!/usr/bin/env python3
"""
Test script for the /process-document endpoint.

This script creates a sample PDF, converts it to base64, and sends it to the endpoint.
"""

import base64
import requests
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
import json


def create_test_pdf() -> bytes:
    """Create a simple test PDF with sample invoice content."""
    buffer = io.BytesIO()

    # Create the PDF object
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Add content
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, height - 100, "INVOICE")

    c.setFont("Helvetica", 12)
    c.drawString(100, height - 140, "Invoice Number: INV-2024-001")
    c.drawString(100, height - 160, "Date: January 15, 2024")
    c.drawString(100, height - 180, "")
    c.drawString(100, height - 200, "Bill To:")
    c.drawString(100, height - 220, "John Doe")
    c.drawString(100, height - 240, "123 Main Street")
    c.drawString(100, height - 260, "Anytown, ST 12345")
    c.drawString(100, height - 280, "")
    c.drawString(100, height - 300, "Description: Web Development Services")
    c.drawString(100, height - 320, "Amount: $1,500.00")
    c.drawString(100, height - 340, "")
    c.drawString(100, height - 360, "Total: $1,500.00")
    c.drawString(100, height - 380, "")
    c.drawString(100, height - 400, "Thank you for your business!")

    # Save the PDF
    c.save()

    # Get the PDF data
    buffer.seek(0)
    return buffer.read()


def pdf_to_data_uri(pdf_bytes: bytes) -> str:
    """Convert PDF bytes to a base64 data URI."""
    base64_data = base64.b64encode(pdf_bytes).decode('utf-8')
    return f"data:application/pdf;base64,{base64_data}"


def test_process_document():
    """Test the /process-document endpoint."""
    print("Creating test PDF...")
    pdf_bytes = create_test_pdf()
    print(f"PDF created: {len(pdf_bytes)} bytes")

    print("\nConverting to base64 data URI...")
    pdf_data_uri = pdf_to_data_uri(pdf_bytes)
    print(f"Data URI length: {len(pdf_data_uri)} characters")

    # Prepare the request
    url = "http://localhost:8000/process-document"
    analyze_payload = {
        "pdfData": pdf_data_uri,
        "googleAccessToken": None  # Will use service account if configured
    }

    print("\nSending analysis request to /process-document endpoint...")
    print(f"URL: {url}")

    try:
        headers = {
            "Authorization": "Bearer test-token"
        }
        response = requests.post(url, json=analyze_payload, headers=headers, timeout=120)

        print(f"\nResponse status code: {response.status_code}")

        if response.status_code == 200:
            analysis = response.json()
            print("\n✅ ANALYSIS SUCCESS!")
            print("\nResponse data:")
            print(json.dumps(analysis, indent=2))
            print(f"\nTitle: {analysis.get('title')}")
            print(f"Category: {analysis.get('category')}")

            upload_payload = {
                "pdfData": pdf_data_uri,
                "title": analysis.get("title") or "Test Document",
                "category": analysis.get("category") or "other",
                "year": analysis.get("year") or 2024
            }

            print("\nSending upload request to /upload-document endpoint...")
            upload_response = requests.post(
                "http://localhost:8000/upload-document",
                json=upload_payload,
                headers=headers,
                timeout=120
            )
            print(f"Upload status code: {upload_response.status_code}")
            if upload_response.status_code == 200:
                upload_result = upload_response.json()
                print("\n✅ UPLOAD SUCCESS!")
                print(json.dumps(upload_result, indent=2))
                print(f"Drive Link: {upload_result.get('driveUrl')}")
            else:
                print("\n❌ Upload failed")
                print(upload_response.text)
        else:
            print("\n❌ ERROR!")
            print(f"Response: {response.text}")

    except requests.exceptions.ConnectionError:
        print("\n❌ Connection failed!")
        print("Make sure the backend server is running on http://localhost:8000")
        print("Run: cd backend && source .venv/bin/activate && uvicorn app:app --reload")
    except Exception as e:
        print(f"\n❌ Exception occurred: {e}")


if __name__ == "__main__":
    test_process_document()
