"""
Document Processing Module with Gemini Vision API

This module uses Google's Gemini 2.5 Flash with Vision capabilities
to analyze PDF documents and generate titles and categories.
"""

import io
import os
from typing import Dict
import logging

from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def process_pdf_with_gemini(pdf_bytes: bytes) -> Dict[str, any]:
    """
    Use Gemini Vision to analyze a PDF document and generate title and category.

    Args:
        pdf_bytes: PDF file content as bytes

    Returns:
        A dict with title, category, input_tokens, output_tokens, estimated_cost

    Raises:
        Exception: If Gemini API call fails
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY environment variable is not set")

    try:
        # Use Gemini 2.5 Flash model with vision (supports PDF)
        model = genai.GenerativeModel('gemini-2.5-flash')

        prompt = """Analyze this PDF document and provide:
1. A concise, descriptive title (max 80 characters) that captures the main purpose of the document
2. A category from this list: invoices, receipts, contracts, insurance, tax, medical, school, id, personal, business, legal, financial, other

Format your response as:
TITLE: [your title here]
CATEGORY: [category name in lowercase]"""

        # Upload PDF to Gemini
        pdf_file = genai.upload_file(io.BytesIO(pdf_bytes), mime_type='application/pdf')
        
        response = model.generate_content([prompt, pdf_file])

        # Extract token usage from response
        input_tokens = 0
        output_tokens = 0
        
        print(f"[DEBUG] Response has usage_metadata: {hasattr(response, 'usage_metadata')}")
        
        if hasattr(response, 'usage_metadata'):
            um = response.usage_metadata
            print(f"[DEBUG] Raw usage_metadata object: {um}")
            
            # Access fields directly
            input_tokens = um.prompt_token_count
            output_tokens = um.candidates_token_count
            
            print(f"[DEBUG] Extracted input_tokens: {input_tokens}, output_tokens: {output_tokens}")
            logger.info(f"Token usage - Input: {input_tokens}, Output: {output_tokens}")
        else:
            print("[DEBUG] No usage_metadata found on response!")
        
        # Calculate cost (Gemini 2.5 Flash pricing as of Nov 2024)
        # Input: $0.075 per 1M tokens, Output: $0.30 per 1M tokens
        estimated_cost = (input_tokens * 0.075 / 1_000_000) + (output_tokens * 0.30 / 1_000_000)

        # Parse the response
        response_text = response.text.strip()
        logger.info(f"Gemini Vision response: {response_text}")
        logger.info(f"Token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${estimated_cost:.6f}")

        title = None
        category = None

        for line in response_text.split('\n'):
            line = line.strip()
            if line.startswith('TITLE:'):
                title = line.replace('TITLE:', '').strip()
            elif line.startswith('CATEGORY:'):
                category = line.replace('CATEGORY:', '').strip().lower()

        # Fallback if parsing fails
        if not title:
            title = "Untitled Document"
        if not category:
            category = "other"

        # Ensure title is not too long
        if len(title) > 80:
            title = title[:77] + "..."

        logger.info(f"Generated title: '{title}', category: '{category}'")

        return {
            'title': title,
            'category': category,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'estimated_cost': estimated_cost
        }

    except Exception as e:
        logger.error(f"Gemini Vision API call failed: {str(e)}")
        raise Exception(f"Failed to analyze PDF: {str(e)}")
