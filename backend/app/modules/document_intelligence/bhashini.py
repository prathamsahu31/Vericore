import os
import requests
import logging

logger = logging.getLogger(__name__)

def translate_to_english(text: str) -> str:
    """
    Translates the given text to English using the Bhashini API.
    If the API is not configured or the request fails, it returns the original text.
    """
    if not text or not text.strip():
        return text

    # Bhashini credentials
    user_id = os.environ.get("BHASHINI_USER_ID")
    api_key = os.environ.get("BHASHINI_API_KEY")
    pipeline_id = os.environ.get("BHASHINI_PIPELINE_ID") # Sometimes required by Bhashini

    if not user_id or not api_key:
        logger.warning("Bhashini credentials not found in environment. Skipping translation.")
        return text

    try:
        # NOTE: This is a general structure for the Bhashini/ULCA API. 
        # You will need to replace the URL with the exact inference endpoint 
        # provided in your Bhashini developer dashboard.
        url = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
        
        headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": "auto", # Auto-detect source if supported, else you might need a language identifier model first
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

        # If they use UserID for authentication (like in Dhruva)
        headers["userID"] = user_id

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Parse the translated text from the response payload
        # This parsing logic depends heavily on the specific Bhashini Pipeline output structure
        translated_text = data["pipelineResponse"][0]["output"][0]["target"]
        return translated_text

    except Exception as e:
        logger.error(f"Bhashini translation failed: {e}")
        return text # Graceful fallback if translation fails
