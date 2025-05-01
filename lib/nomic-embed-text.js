/**
 * Nomic Embedding Library
 * 
 * This implementation uses the backend API to get embeddings.
 */

export const nomicEmbed = (function() {
  const BACKEND_URL = 'http://localhost:5000/api';  // Change this in production
  
  return {
    // Main method to get embeddings for text
    getEmbedding: async function(text) {
      try {
        const response = await fetch(`${BACKEND_URL}/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result.embedding;
      } catch (error) {
        console.error('Error getting embedding:', error);
        throw error;
      }
    }
  };
})();

// Make nomicEmbed available globally
// self.nomicEmbed = nomicEmbed; 