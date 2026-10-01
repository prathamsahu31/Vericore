import logging
import os
import re

logger = logging.getLogger(__name__)

# Simple heuristic: if >60% of characters are ASCII letters/digits/punctuation,
# the text is very likely English and doesn't need translation.
_ASCII_LETTER = re.compile(r'[a-zA-Z]')

# Bhashini-supported source languages (ISO 639-1 codes).
# We try Hindi first since that's the most common non-English language in
# Indian government procurement documents.
_SUPPORTED_LANGUAGES = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or"]


def _looks_english(text: str) -> bool:
    """Quick heuristic: if most alphabetic characters are ASCII, skip translation."""
    if not text or len(text.strip()) < 20:
        return True  # too short to judge — don't waste an API call
    alpha_chars = [c for c in text if c.isalpha()]
    if not alpha_chars:
        return True  # numbers/symbols only
    ascii_alpha = sum(1 for c in alpha_chars if ord(c) < 128)
    return (ascii_alpha / len(alpha_chars)) > 0.6


def translate_to_english(text: str, source_language: str = "hi") -> str:
    """
    Translates the given text to English using the Bhashini API.
    If the API is not configured or the request fails, it returns the original text.

    Args:
        text: The text to translate.
        source_language: ISO 639-1 code for the source language (default: "hi" for Hindi).
                         Ignored if the text appears to already be in English.
    """
    if not text or not text.strip():
        return text

    # Skip translation for text that's already English
    if _looks_english(text):
        return text

    # Bhashini credentials
    user_id = os.environ.get("BHASHINI_USER_ID")
    api_key = os.environ.get("BHASHINI_API_KEY")

    if not user_id or not api_key:
        logger.warning("Bhashini credentials not found in environment. Skipping translation.")
        return text

    # Imported here, not at the top: every PDF read passes through this module,
    # and requests is only needed once Bhashini is configured.
    import requests

    try:
        url = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

        headers = {
            "Authorization": api_key,
            "Content-Type": "application/json",
            "userID": user_id,
        }

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_language,
                            "targetLanguage": "en"
                        }
                    }
                }
            ],
            "inputData": {
                "input": [
                    {"source": text}
                ]
            }
        }

        response = requests.post(url, json=payload, headers=headers, timeout=15)
        response.raise_for_status()

        data = response.json()

        # Parse the translated text from the response payload
        translated_text = data["pipelineResponse"][0]["output"][0]["target"]
        return translated_text

    except Exception as e:
        logger.error(f"Bhashini translation failed (source_language={source_language}): {e}")
        return text  # Graceful fallback if translation fails
