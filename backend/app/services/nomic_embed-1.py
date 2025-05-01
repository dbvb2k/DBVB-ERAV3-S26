import numpy as np
from typing import List
import re
import os
from nomic import embed
from flask import current_app

class NomicEmbed:
    def __init__(self):
        """Initialize Nomic embedding service."""
        self.dimension = 384
        self._initialized = False
    
    def _ensure_initialized(self):
        """Ensure Nomic client is initialized with API key."""
        if not self._initialized:
            api_key = current_app.config.get('NOMIC_API_KEY')
            if not api_key:
                raise ValueError("NOMIC_API_KEY is not set in configuration")
            # Initialize the client with the API key
            embed.init(api_key=api_key)
            self._initialized = True
    
    def _preprocess_text(self, text: str) -> List[str]:
        """Preprocess text into words."""
        # Convert to lowercase and split into words
        words = re.findall(r'\b\w+\b', text.lower())
        return words
    
    def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for the given text using Nomic."""
        try:
            self._ensure_initialized()
            # Get embedding from Nomic API
            embedding = embed.embed_text(text)
            return np.array(embedding, dtype=np.float32)
        except Exception as e:
            raise Exception(f"Error getting embedding: {str(e)}")

# Create a singleton instance
nomic_embed = NomicEmbed() 