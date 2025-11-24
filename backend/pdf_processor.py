"""
Document Processing Module with Gemini Vision API

This module uses Google's Gemini 2.5 Flash with Vision capabilities
to analyze PDF documents and generate titles and categories.
"""

import io
import os
from datetime import datetime
from typing import Dict, List, Optional
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
3. The most relevant year for organizing this document (4-digit year, e.g., 2023)
   - For invoices/receipts: use the document date
   - For contracts: use the effective/start date
   - For tax documents: use the tax year
   - If no clear year exists, respond with "YEAR: null"

Format your response as:
TITLE: [your title here]
CATEGORY: [category name in lowercase]
YEAR: [4-digit year or null]"""

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
        year = None

        for line in response_text.split('\n'):
            line = line.strip()
            if line.startswith('TITLE:'):
                title = line.replace('TITLE:', '').strip()
            elif line.startswith('CATEGORY:'):
                category = line.replace('CATEGORY:', '').strip().lower()
            elif line.startswith('YEAR:'):
                year_str = line.replace('YEAR:', '').strip()
                if year_str.lower() != 'null':
                    try:
                        year = int(year_str)
                    except ValueError:
                        logger.warning(f"Could not parse year from: {year_str}")
                        year = None

        # Fallback if parsing fails
        if not title:
            title = "Untitled Document"
        if not category:
            category = "other"
        if not year:
            year = datetime.now().year
            logger.info(f"No year detected, using current year: {year}")

        # Ensure title is not too long
        if len(title) > 80:
            title = title[:77] + "..."

        logger.info(f"Generated title: '{title}', category: '{category}'")

        return {
            'title': title,
            'category': category,
            'year': year,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'estimated_cost': estimated_cost
        }

    except Exception as e:
        logger.error(f"Gemini Vision API call failed: {str(e)}")
        raise Exception(f"Failed to analyze PDF: {str(e)}")


def analyze_pdf_with_folder_context(pdf_bytes: bytes, existing_folders: List[str]) -> Dict[str, any]:
    """
    Use Gemini Vision to analyze a PDF document with awareness of existing Drive folder structure.

    This unified function analyzes the document AND selects the best storage location based on
    the user's existing organizational structure.

    Args:
        pdf_bytes: PDF file content as bytes
        existing_folders: List of existing folder paths in user's Drive (e.g., ['/Work/Resumes/2025', '/Business/Invoices'])

    Returns:
        A dict with:
            - title: Document title
            - category: Flexible category (based on folder structure)
            - year: Document year (or current year as fallback)
            - suggested_path: Best folder path (existing or new)
            - path_reason: Brief explanation of why this path was chosen
            - is_existing_path: Boolean indicating if using existing folder
            - input_tokens, output_tokens, estimated_cost: Token usage metrics

    Raises:
        Exception: If Gemini API call fails
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY environment variable is not set")

    try:
        # Use Gemini 2.5 Flash model with vision (supports PDF)
        model = genai.GenerativeModel('gemini-2.5-flash')

        # Build folder list for prompt
        folder_list = "\n".join(existing_folders) if existing_folders else "No existing folders found."

        prompt = f"""Analyze this PDF document and suggest the optimal storage location based on the user's existing folder structure.

EXISTING FOLDERS IN GOOGLE DRIVE:
{folder_list}

YOUR TASKS:
1. Generate a concise, descriptive title (max 80 characters) that captures the document's main purpose
2. Determine the document category based on content AND the existing folder structure
   - Review the folder paths above to understand how the user organizes documents
   - Choose a category that aligns with their organizational patterns
   - Categories can be flexible (e.g., if folders show 'Work', 'Business', 'Personal', use those)
3. Extract the most relevant year for organizing this document (4-digit year)
   - For invoices/receipts: use the document date
   - For contracts: use the effective/start date
   - For tax documents: use the tax year
   - If no clear year exists, use null
4. Select the BEST folder path from the existing folders OR suggest creating a new one
   - Prioritize existing folders with semantic similarity to the document type
   - Consider year-based organization (prefer 2025 folders for current documents)
   - If no good match exists, suggest a new folder path that fits the user's organizational style
5. Explain briefly why you chose this path

FORMAT YOUR RESPONSE EXACTLY AS:
TITLE: [your title here]
CATEGORY: [category name - flexible based on folders]
YEAR: [4-digit year or null]
SUGGESTED_PATH: [full folder path like /Work/Resumes/2025 or /Business/Invoices/2025]
IS_EXISTING: [true if path exists in the list above, false if creating new]
REASONING: [brief 1-sentence explanation of why this path fits]

IMPORTANT:
- If suggesting an existing path, use the EXACT path from the list above (including leading /)
- If suggesting a new path, follow the user's organizational patterns seen in existing folders
- The category should align with the folder structure you see"""

        # Upload PDF to Gemini
        pdf_file = genai.upload_file(io.BytesIO(pdf_bytes), mime_type='application/pdf')

        response = model.generate_content([prompt, pdf_file])

        # Extract token usage
        input_tokens = 0
        output_tokens = 0

        if hasattr(response, 'usage_metadata'):
            um = response.usage_metadata
            input_tokens = um.prompt_token_count
            output_tokens = um.candidates_token_count
            logger.info(f"Token usage - Input: {input_tokens}, Output: {output_tokens}")

        # Calculate cost (Gemini 2.5 Flash pricing)
        # Input: $0.075 per 1M tokens, Output: $0.30 per 1M tokens
        estimated_cost = (input_tokens * 0.075 / 1_000_000) + (output_tokens * 0.30 / 1_000_000)

        # Parse the response
        response_text = response.text.strip()
        logger.info(f"Gemini Vision response with folder context: {response_text}")

        title = None
        category = None
        year = None
        suggested_path = None
        is_existing_path = None
        reasoning = None

        for line in response_text.split('\n'):
            line = line.strip()
            if line.startswith('TITLE:'):
                title = line.replace('TITLE:', '').strip()
            elif line.startswith('CATEGORY:'):
                category = line.replace('CATEGORY:', '').strip()
            elif line.startswith('YEAR:'):
                year_str = line.replace('YEAR:', '').strip()
                if year_str.lower() != 'null':
                    try:
                        year = int(year_str)
                    except ValueError:
                        logger.warning(f"Could not parse year from: {year_str}")
                        year = None
            elif line.startswith('SUGGESTED_PATH:'):
                suggested_path = line.replace('SUGGESTED_PATH:', '').strip()
            elif line.startswith('IS_EXISTING:'):
                is_existing_str = line.replace('IS_EXISTING:', '').strip().lower()
                is_existing_path = is_existing_str == 'true'
            elif line.startswith('REASONING:'):
                reasoning = line.replace('REASONING:', '').strip()

        # Fallback values
        if not title:
            title = "Untitled Document"
        if not category:
            category = "Documents"
        if not year:
            year = datetime.now().year
            logger.info(f"No year detected, using current year: {year}")
        if not suggested_path:
            # Default fallback path
            suggested_path = f"/{category}/{year}"
            logger.warning(f"No path suggested by AI, using fallback: {suggested_path}")
        if is_existing_path is None:
            # Check if path exists in provided folders
            is_existing_path = suggested_path in existing_folders
        if not reasoning:
            reasoning = "AI-generated suggestion based on document analysis"

        # Ensure title is not too long
        if len(title) > 80:
            title = title[:77] + "..."

        logger.info(f"Generated: title='{title}', category='{category}', year={year}, path='{suggested_path}', existing={is_existing_path}")

        return {
            'title': title,
            'category': category,
            'year': year,
            'suggested_path': suggested_path,
            'path_reason': reasoning,
            'is_existing_path': is_existing_path,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'estimated_cost': estimated_cost
        }

    except Exception as e:
        logger.error(f"Gemini Vision API call failed: {str(e)}")
        raise Exception(f"Failed to analyze PDF with folder context: {str(e)}")
