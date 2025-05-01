import google.generativeai as genai
from typing import Optional

class GeminiChat:
    def __init__(self, api_key: str):
        """Initialize Gemini chat service."""
        if not api_key:
            raise ValueError("Gemini API key is required")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
    
    def get_response(self, query: str, context: Optional[str] = None) -> str:
        """Get response from Gemini with optional context."""
        try:
            # Prepare prompt with context if available
            if context:
                prompt = f"""Context information:
{context}

User query: {query}

Please provide a helpful response based on the context and query."""
            else:
                prompt = query
            
            # Get response from Gemini
            response = self.model.generate_content(prompt)
            
            return response.text
        except Exception as e:
            raise Exception(f"Error getting Gemini response: {str(e)}") 