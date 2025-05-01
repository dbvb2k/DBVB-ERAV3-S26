/**
 * FAISS-WASM - WebAssembly wrapper for Facebook AI Similarity Search (FAISS)
 * 
 * This is a minimal implementation for the Chrome extension.
 * In a real implementation, you would load the actual FAISS WASM binary.
 */

// This is a placeholder implementation - in a real extension you would use
// the actual FAISS WebAssembly module from:
// https://github.com/kyamagu/faiss-wasm

export const faiss = (function() {
  let nextId = 0;
  let vectors = {}; // Simple in-memory storage for vectors
  let dimensions = 0;
  
  // Simple cosine similarity implementation
  function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  return {
    // Create a new index
    createIndex: async function(d) {
      dimensions = d;
      vectors = {};
      nextId = 0;
      
      return {
        ntotal: 0,
        
        // Add vectors to the index
        addWithIds: function(vecs, ids) {
          const addedIds = [];
          
          for (let i = 0; i < vecs.length; i++) {
            const id = ids ? ids[i] : nextId++;
            vectors[id] = vecs[i];
            addedIds.push(id);
            this.ntotal++;
          }
          
          return addedIds;
        },
        
        // Search for similar vectors
        search: function(query, k) {
          const scores = [];
          
          // Calculate similarity for each vector
          for (const id in vectors) {
            if (vectors.hasOwnProperty(id)) {
              const similarity = cosineSimilarity(query, vectors[id]);
              scores.push({ id: parseInt(id), score: similarity });
            }
          }
          
          // Sort by similarity (highest first)
          scores.sort((a, b) => b.score - a.score);
          
          // Return top k ids
          return scores.slice(0, k).map(result => result.id);
        },
        
        // Serialize the index - synchronous version
        serialize: function() {
          // For our mock implementation, just convert directly to a string
          return JSON.stringify({
            dimensions: dimensions,
            vectors: vectors,
            nextId: nextId
          });
        }
      };
    },
    
    // Deserialize a saved index
    deserializeIndex: async function(data) {
      // If data is a string, parse it
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      dimensions = parsed.dimensions;
      vectors = parsed.vectors;
      nextId = parsed.nextId;
      
      return {
        ntotal: Object.keys(vectors).length,
        
        addWithIds: function(vecs, ids) {
          const addedIds = [];
          
          for (let i = 0; i < vecs.length; i++) {
            const id = ids ? ids[i] : nextId++;
            vectors[id] = vecs[i];
            addedIds.push(id);
            this.ntotal++;
          }
          
          return addedIds;
        },
        
        search: function(query, k) {
          const scores = [];
          
          // Calculate similarity for each vector
          for (const id in vectors) {
            if (vectors.hasOwnProperty(id)) {
              const similarity = cosineSimilarity(query, vectors[id]);
              scores.push({ id: parseInt(id), score: similarity });
            }
          }
          
          // Sort by similarity (highest first)
          scores.sort((a, b) => b.score - a.score);
          
          // Return top k ids
          return scores.slice(0, k).map(result => result.id);
        },
        
        // Serialize the index
        serialize: function() {
          return JSON.stringify({
            dimensions: dimensions,
            vectors: vectors,
            nextId: nextId
          });
        }
      };
    }
  };
})();

// Make faiss available globally
// self.faiss = faiss; 