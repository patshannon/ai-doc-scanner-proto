"""
Document Processing Module with Gemini Vision API

This module uses Google's Gemini 2.5 Flash with Vision capabilities
to analyze document images and generate titles and categories.
"""

import io
import os
from typing import Tuple, Dict
import logging

from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def process_image_with_gemini(image_bytes: bytes) -> Dict[str, any]:
    """
    Use Gemini Vision to analyze a document image and generate title and category.

    Args:
        image_bytes: Image file content as bytes

    Returns:
        A dict with title, category, input_tokens, output_tokens, estimated_cost

    Raises:
        Exception: If Gemini API call fails
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY environment variable is not set")

    try:
        import PIL.Image

        # Load image
        image = PIL.Image.open(io.BytesIO(image_bytes))
        
        # Use Gemini 2.5 Flash model with vision
        model = genai.GenerativeModel('gemini-2.5-flash')

        prompt = """Analyze this document image and provide:
1. A concise, descriptive title (max 80 characters) that captures the main purpose of the document
2. A category from this list: invoices, receipts, contracts, insurance, tax, medical, school, id, personal, business, legal, financial, other

Format your response as:
TITLE: [your title here]
CATEGORY: [category name in lowercase]"""

        response = model.generate_content([prompt, image])

        # Extract token usage from response
        # The usage_metadata fields might have different names in the API
        input_tokens = 0
        output_tokens = 0
        
        print(f"[DEBUG] Response has usage_metadata: {hasattr(response, 'usage_metadata')}")
        
        if hasattr(response, 'usage_metadata'):
            um = response.usage_metadata
            print(f"[DEBUG] Raw usage_metadata object: {um}")
            print(f"[DEBUG] usage_metadata type: {type(um)}")
            print(f"[DEBUG] usage_metadata dir: {dir(um)}")
            
            # Try different possible field names
            input_tokens = getattr(um, 'prompt_token_count', 0) or getattr(um, 'input_token_count', 0)
            output_tokens = getattr(um, 'candidates_token_count', 0) or getattr(um, 'output_token_count', 0) or getattr(um, 'total_token_count', 0) - input_tokens
            
            print(f"[DEBUG] Extracted input_tokens: {input_tokens}, output_tokens: {output_tokens}")
            logger.info(f"Raw usage_metadata: {um}")
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
        raise Exception(f"Failed to analyze image: {str(e)}")
