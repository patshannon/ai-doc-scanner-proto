"""
Folder Matching Module with Gemini AI

This module uses Google's Gemini AI to suggest the best parent folder
for a document based on the user's existing Drive folder structure.
"""

import os
import logging
from typing import Dict, List, Optional

from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def suggest_parent_folder(
    document_category: str,
    document_title: str,
    folder_structure: Dict,
    confidence_threshold: float = 0.7
) -> Optional[Dict]:
    """
    Use Gemini AI to suggest the best parent folder for a document.

    Args:
        document_category: Category of the document (e.g., "invoices", "receipts")
        document_title: Title of the document
        folder_structure: Dict with 'folders' list from scan_drive_folders()
        confidence_threshold: Minimum confidence to suggest a folder (0.0-1.0)

    Returns:
        {
            'folder_id': str,
            'folder_name': str,
            'folder_path': str,
            'confidence': float
        }
        or None if no good match found

    Raises:
        Exception: If Gemini API call fails
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY environment variable is not set")

    # Extract root-level folders (depth 0) from folder structure
    root_folders = [
        f for f in folder_structure.get('folders', [])
        if f.get('depth') == 0
    ]

    # If no folders exist, return None (use root/default path)
    if not root_folders:
        logger.info("No root folders found in Drive, using default path")
        return None

    try:
        # Use Gemini 2.5 Flash model for fast, cost-effective matching
        model = genai.GenerativeModel('gemini-2.5-flash')

        # Build folder list for prompt
        folder_list = "\n".join([f"- {f['name']}" for f in root_folders])

        prompt = f"""You are helping organize a document in Google Drive.

Document Information:
- Type: {document_category}
- Title: {document_title}

The user has these existing top-level folders in their Google Drive:
{folder_list}

Task: Determine which folder (if any) best matches this document type.

Instructions:
1. Consider semantic relationships (e.g., "invoices" might belong in "Finance", "Business", or "Work")
2. Think about how users typically organize documents (e.g., tax documents → "Finance", contracts → "Legal" or "Business")
3. Only suggest a match if you're confident it's appropriate
4. If no folder is a good match, respond with "NO_MATCH"

Format your response as:
FOLDER: [exact folder name from the list above, or NO_MATCH]
CONFIDENCE: [0.0 to 1.0, where 1.0 is extremely confident]
REASONING: [brief explanation of why this folder is appropriate]

Example responses:
FOLDER: Finance
CONFIDENCE: 0.9
REASONING: Invoices are financial documents typically stored in finance folders

FOLDER: NO_MATCH
CONFIDENCE: 0.0
REASONING: None of the existing folders are semantically related to this document type"""

        response = model.generate_content(prompt)
        response_text = response.text.strip()
        logger.info(f"Gemini folder matching response: {response_text}")

        # Parse the response
        folder_name = None
        confidence = 0.0
        reasoning = None

        for line in response_text.split('\n'):
            line = line.strip()
            if line.startswith('FOLDER:'):
                folder_name = line.replace('FOLDER:', '').strip()
            elif line.startswith('CONFIDENCE:'):
                conf_str = line.replace('CONFIDENCE:', '').strip()
                try:
                    confidence = float(conf_str)
                except ValueError:
                    logger.warning(f"Could not parse confidence: {conf_str}")
                    confidence = 0.0
            elif line.startswith('REASONING:'):
                reasoning = line.replace('REASONING:', '').strip()

        # Check if AI suggested no match or confidence too low
        if not folder_name or folder_name.upper() == "NO_MATCH" or confidence < confidence_threshold:
            logger.info(f"No confident folder match (folder={folder_name}, confidence={confidence}, threshold={confidence_threshold})")
            return None

        # Find the folder in the structure
        matched_folder = None
        for folder in root_folders:
            if folder['name'].lower() == folder_name.lower():
                matched_folder = folder
                break

        if not matched_folder:
            logger.warning(f"AI suggested folder '{folder_name}' but it doesn't exist in structure")
            return None

        result = {
            'folder_id': matched_folder['id'],
            'folder_name': matched_folder['name'],
            'folder_path': matched_folder['path'],
            'confidence': confidence,
            'reasoning': reasoning
        }

        logger.info(f"Matched folder: {result['folder_name']} (confidence: {confidence})")
        return result

    except Exception as e:
        logger.error(f"Folder matching failed: {str(e)}")
        # Don't raise exception - just return None and fall back to default path
        return None
