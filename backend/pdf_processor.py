"""
PDF Processing Module with Gemini AI Integration

This module handles PDF text extraction and uses Google's Gemini 2.5 Flash
to generate document titles and categories.
"""

import io
import os
from typing import Tuple, Optional
import logging

from dotenv import load_dotenv
import google.generativeai as genai
from PyPDF2 import PdfReader

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text content from a PDF file.

    Args:
        pdf_bytes: PDF file content as bytes

    Returns:
        Extracted text content

    Raises:
        Exception: If PDF extraction fails
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        pdf_reader = PdfReader(pdf_file)

        text_content = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_content.append(page_text)

        full_text = "\n".join(text_content)
        logger.info(f"Extracted {len(full_text)} characters from PDF with {len(pdf_reader.pages)} pages")

        return full_text.strip()

    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {str(e)}")
        raise Exception(f"PDF text extraction failed: {str(e)}")


def generate_title_and_category(text_content: str) -> Tuple[str, str]:
    """
    Use Gemini 2.5 Flash to generate a relevant title and category for the document.

    Args:
        text_content: The extracted text from the document

    Returns:
        A tuple of (title, category)

    Raises:
        Exception: If Gemini API call fails
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY environment variable is not set")

    try:
        # Use Gemini 2.5 Flash model
        model = genai.GenerativeModel('gemini-2.0-flash-exp')

        # Create a prompt for title and category generation
        prompt = f"""Analyze the following document text and provide:
1. A concise, descriptive title (max 80 characters) that captures the main purpose of the document
2. A category from this list: Invoice, Receipt, Contract, Insurance, Tax, Medical, School, ID, Personal, Business, Legal, Financial, Other

Format your response as:
TITLE: [your title here]
CATEGORY: [category name]

Document text:
{text_content[:4000]}"""  # Limit to first 4000 chars to avoid token limits

        response = model.generate_content(prompt)

        # Parse the response
        response_text = response.text.strip()
        logger.info(f"Gemini response: {response_text}")

        title = None
        category = None

        for line in response_text.split('\n'):
            line = line.strip()
            if line.startswith('TITLE:'):
                title = line.replace('TITLE:', '').strip()
            elif line.startswith('CATEGORY:'):
                category = line.replace('CATEGORY:', '').strip()

        # Fallback if parsing fails
        if not title:
            title = "Untitled Document"
        if not category:
            category = "Other"

        # Ensure title is not too long
        if len(title) > 80:
            title = title[:77] + "..."

        logger.info(f"Generated title: '{title}', category: '{category}'")

        return title, category

    except Exception as e:
        logger.error(f"Gemini API call failed: {str(e)}")
        raise Exception(f"Failed to generate title and category: {str(e)}")


def process_pdf_document(pdf_bytes: bytes) -> Tuple[str, str, str]:
    """
    Process a PDF document: extract text and generate title and category.

    Args:
        pdf_bytes: PDF file content as bytes

    Returns:
        A tuple of (extracted_text, title, category)

    Raises:
        Exception: If processing fails
    """
    # Extract text from PDF
    text_content = extract_text_from_pdf(pdf_bytes)

    if not text_content:
        raise Exception("No text could be extracted from the PDF")

    # Generate title and category using Gemini
    title, category = generate_title_and_category(text_content)

    return text_content, title, category
