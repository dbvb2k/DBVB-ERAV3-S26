// Import libraries
import { faiss } from './lib/faiss-wasm.js';
import { nomicEmbed } from './lib/nomic-embed-text.js';

// Notify the service worker that libraries are loaded
chrome.runtime.sendMessage({ action: 'librariesLoaded' }); 