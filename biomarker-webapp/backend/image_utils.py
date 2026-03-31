"""Image utility functions."""
import base64
from pathlib import Path

def get_img_as_base64(file_path: str) -> str:
    """
    Convert image file to base64 encoding.
    Preserves original function from biomarker_webapp.py (lines 36-40)
    """
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        return base64.b64encode(data).decode()
    except FileNotFoundError:
        raise FileNotFoundError(f"Image file not found: {file_path}")

def get_base64_encoded_image(image_path: str) -> str:
    """
    Encode image to base64 data URI.
    Preserves original function from biomarker_webapp.py (lines 252-255)
    """
    try:
        with open(image_path, "rb") as img_file:
            encoded = base64.b64encode(img_file.read()).decode()
        return f"data:image/jpeg;base64,{encoded}"
    except FileNotFoundError:
        raise FileNotFoundError(f"Image file not found: {image_path}")




