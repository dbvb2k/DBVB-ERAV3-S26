import numpy as np
from typing import List
import re
from nomic import embed
from flask import current_app
import os

class NomicEmbed:
    def __init__(self):
        """Initialize Nomic embedding service."""        
        self.dimension = 384  # Depending on model used
        self._initialized = False
    
    def _ensure_initialized(self):
        """Ensure API key is set in environment."""
        if not self._initialized:
            api_key = current_app.config.get('NOMIC_API_KEY')
            if not api_key:
                raise ValueError("NOMIC_API_KEY is not set in configuration")
            # Set the API key in environment variable
            os.environ['NOMIC_API_KEY'] = api_key
            self._initialized = True
    
    def _preprocess_text(self, text: str) -> List[str]:
        """Preprocess text into words."""        
        return re.findall(r'\b\w+\b', text.lower())
    
    def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for the given text using Nomic."""
        try:
            self._ensure_initialized()
            # Use the text embedding function without api_key parameter
            result = embed.text(
                texts=[text],
                model='nomic-embed-text-v1.5'
            )
            return np.array(result['embeddings'][0], dtype=np.float32)
        except Exception as e:
            raise Exception(f"Error getting embedding: {str(e)}")

# Singleton instance
nomic_embed = NomicEmbed()
