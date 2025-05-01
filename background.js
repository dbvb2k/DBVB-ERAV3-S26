// Import necessary libraries
import { faiss } from './lib/faiss-wasm.js';
import { nomicEmbed } from './lib/nomic-embed-text.js';

// Global variables
let confidentialSites = [];
let faissIndex = null;
let urlToDocMap = {};
let isInitialized = false;
let librariesLoaded = false;
const BACKEND_URL = 'http://localhost:5000/api';  // Change this in production

// Log the startup
console.log('Background script started!');

// Function to load libraries
function loadLibraries() {
  return new Promise((resolve, reject) => {
    try {
      // Create a new tab to load the libraries
      chrome.tabs.create({ url: chrome.runtime.getURL('lib-loader.html'), active: false }, (tab) => {
        // Listen for the librariesLoaded message
        const listener = (message, sender) => {
          if (message.action === 'librariesLoaded' && sender.tab.id === tab.id) {
            // Remove the listener
            chrome.runtime.onMessage.removeListener(listener);
            // Close the tab
            chrome.tabs.remove(tab.id);
            // Mark libraries as loaded
            librariesLoaded = true;
            resolve(true);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    } catch (error) {
      console.error('Error in loadLibraries:', error);
      reject(error);
    }
  });
}

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  if (details.reason === 'install') {
    try {
      // Load libraries first
      await loadLibraries();

      // Fetch the default confidential sites list
      const response = await fetch(chrome.runtime.getURL('confidential-sites.json'));
      const sites = await response.json();
      
      // Store in local storage
      chrome.storage.local.set({ confidentialSites: sites }, () => {
        console.log('Default confidential sites list initialized.');
      });
    } catch (error) {
      console.error('Error initializing extension:', error);
      
      // Fallback to hardcoded list
      const defaultSites = [
        'mail.google.com',
        'gmail.com',
        'web.whatsapp.com',
        'drive.google.com',
        'docs.google.com',
        'sheets.google.com',
        'bank',
        'account',
        'login',
        'signin'
      ];
      
      chrome.storage.local.set({ confidentialSites: defaultSites }, () => {
        console.log('Fallback confidential sites list initialized.');
      });
    }
  }
});

// Extract text from HTML
function extractTextFromHTML(html) {
  try {
    // We can't use DOMParser in service workers, so we'll use a simple text extraction approach
    // This is a simplified extraction that removes HTML tags
    const textContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                           .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                           .replace(/<[^>]*>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim();
    
    console.log(`Extracted ${textContent.length} characters of text`);
    return textContent;
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

// Create overlapping text chunks for better search results
function createTextChunks(text, chunkSize, overlapSize) {
  const chunks = [];
  let i = 0;
  
  while (i < text.length) {
    const chunk = text.substring(i, i + chunkSize);
    if (chunk.length < 50) break; // Skip very small chunks
    chunks.push(chunk);
    i += (chunkSize - overlapSize);
  }
  
  return chunks;
}

// Function to force regenerate test data (clear existing index and add test data)
async function regenerateTestData() {
  console.log('Regenerating test data...');
  
  try {
    // Reset the index and document map
    faissIndex = await faiss.createIndex(384);
    urlToDocMap = {};
    console.log('Reset index and document map');
    
    // Add test data
    await addTestData(true);
    
    return { success: true };
  } catch (error) {
    console.error('Error regenerating test data:', error);
    return { success: false, error: error.message };
  }
}

// Add test data to get started (for development purposes)
async function addTestData(forceAdd = false) {
  if (!faissIndex) {
    console.error('Cannot add test data - FAISS index is not initialized');
    return;
  }
  
  // Check if data already exists
  const urlMapSize = Object.keys(urlToDocMap).length;
  console.log(`Current index size: ${urlMapSize} items`);
  
  if (urlMapSize > 0 && !forceAdd) {
    console.log('Index already has data, skipping test data creation');
    return;
  }

  console.log('Adding test data to index...');
  
  const testPages = [
    {
      url: 'https://example.com/test1',
      content: 'This is a test page about machine learning and artificial intelligence. Neural networks are becoming increasingly important in modern technology.'
    },
    {
      url: 'https://example.com/test2',
      content: 'Web development involves creating and maintaining websites. HTML, CSS, and JavaScript are the core technologies for building web pages.'
    },
    {
      url: 'https://example.com/test3',
      content: 'Data science combines statistics, math, programming, and domain expertise to extract insights from data.'
    }
  ];
  
  try {
    for (const page of testPages) {
      // Generate embedding
      const embedding = await nomicEmbed.getEmbedding(page.content);
      
      // Add to FAISS index
      const id = faissIndex.addWithIds([embedding], [faissIndex.ntotal])[0];
      
      // Store mapping
      urlToDocMap[id] = {
        url: page.url,
        text: page.content,
        startIndex: 0
      };
      
      console.log(`Added test page: ${page.url}`);
    }
    
    // Save updated index
    await saveIndex();
    console.log('Test data added and saved to index');
  } catch (error) {
    console.error('Error adding test data:', error);
    throw error;
  }
}

// Initialize the extension
async function initializeExtension() {
  if (isInitialized) return;
  
  console.log('Initializing extension...');
  
  // Load confidential sites list
  await loadConfidentialSites();
  
  // Initialize FAISS index
  await initializeFaissIndex();
  
  // Add test data for development
  await addTestData();
  
  isInitialized = true;
  console.log('Extension initialized successfully');
}

// Load the list of confidential sites from storage
async function loadConfidentialSites() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['confidentialSites'], (result) => {
      if (result.confidentialSites) {
        confidentialSites = result.confidentialSites;
        console.log('Loaded confidential sites from storage:', confidentialSites.length, 'sites');
      } else {
        // Default confidential sites
        confidentialSites = [
          'mail.google.com',
          'gmail.com',
          'web.whatsapp.com',
          'drive.google.com',
          'docs.google.com',
          'sheets.google.com',
          'bank',
          'account',
          'login',
          'signin'
        ];
        // Save default list
        chrome.storage.local.set({ confidentialSites });
        console.log('Created default confidential sites list');
      }
      resolve();
    });
  });
}

// Initialize FAISS index
async function initializeFaissIndex() {
  return new Promise(async (resolve) => {
    console.log('Initializing FAISS index...');
    
    chrome.storage.local.get(['faissIndexData', 'urlToDocMap'], async (result) => {
      if (result.faissIndexData && result.urlToDocMap) {
        try {
          // Load existing index
          faissIndex = await faiss.deserializeIndex(result.faissIndexData);
          urlToDocMap = result.urlToDocMap;
          console.log('FAISS index loaded from storage, containing', Object.keys(urlToDocMap).length, 'items');
        } catch (error) {
          console.error('Error loading FAISS index:', error);
          // Create new index if loading fails
          faissIndex = await faiss.createIndex(384); // Nomic embedding dimension
          urlToDocMap = {};
          console.log('Created new FAISS index due to loading error');
        }
      } else {
        // Create new index
        faissIndex = await faiss.createIndex(384); // Nomic embedding dimension
        urlToDocMap = {};
        console.log('Created new FAISS index (no existing index found)');
      }
      resolve();
    });
  });
}

// Check if a URL is confidential
function isConfidentialSite(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check if the hostname matches any confidential site
    for (const site of confidentialSites) {
      if (hostname.includes(site)) {
        console.log(`Skipping confidential site: ${url} (matched pattern: ${site})`);
        return true;
      }
    }
    
    // Check if the pathname contains any confidential keywords
    for (const site of confidentialSites) {
      if (urlObj.pathname.includes(site)) {
        console.log(`Skipping confidential site: ${url} (matched pattern in path: ${site})`);
        return true;
      }
    }
    
    console.log(`Site is not confidential, processing: ${url}`);
    return false;
  } catch (e) {
    console.error('Error parsing URL:', e, url);
    return true; // Treat as confidential if there's an error
  }
}

// Process page content
async function processPageContent(url, content) {
  console.log(`Received page for processing: ${url}`);
  
  if (isConfidentialSite(url)) {
    console.log('Skipping confidential site:', url);
    return;
  }
  
  try {
    // Send to backend for indexing
    const response = await fetch(`${BACKEND_URL}/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        content: content
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Successfully indexed page: ${url}`);
      return { success: true };
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error processing page content:', error);
    return { success: false, error: error.message };
  }
}

// Save the FAISS index and URL mapping to storage
async function saveIndex() {
  try {
    const serializedIndex = await faissIndex.serialize();
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        faissIndexData: serializedIndex,
        urlToDocMap: urlToDocMap
      }, () => {
        console.log('FAISS index saved to storage successfully');
        resolve();
      });
    });
  } catch (error) {
    console.error('Error serializing and saving index:', error);
    throw error;
  }
}

// Search the index
async function searchIndex(query) {
  console.log(`Searching for: "${query}"`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        limit: 10  // Limit results to prevent duplicates
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Filter out duplicate URLs and test data
      const seenUrls = new Set();
      const filteredResults = result.results.filter(item => {
        if (seenUrls.has(item.url) || item.url.includes('example.com/test')) {
          return false;
        }
        seenUrls.add(item.url);
        return true;
      });
      
      console.log(`Found ${filteredResults.length} unique results`);
      return filteredResults;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error searching index:', error);
    return [];
  }
}

// Chat with Gemini
async function chatWithGemini(query) {
  console.log(`Chat query: "${query}"`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Got response from Gemini');
      return result.response;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error chatting with Gemini:', error);
    return null;
  }
}

// Update confidential sites list
function updateConfidentialSites(newSites) {
  confidentialSites = newSites;
  chrome.storage.local.set({ confidentialSites });
  console.log('Updated confidential sites list:', newSites.length, 'sites');
  return true;
}

// Function to get page content
async function getPageContent(tab) {
    return new Promise((resolve, reject) => {
        // First check if the tab exists and is accessible
        chrome.tabs.get(tab.id, (tabInfo) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting tab info:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }

            // Check if the tab is still valid
            if (!tabInfo || !tabInfo.url) {
                reject(new Error('Invalid tab'));
                return;
            }

            // Now try to send the message
            chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Error getting page content:', chrome.runtime.lastError);
                    // If the content script isn't ready, inject it and try again
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    }).then(() => {
                        // Try again after a short delay
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, response => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else if (response && response.content) {
                                    resolve(response.content);
                                } else {
                                    reject(new Error('No content received from page'));
                                }
                            });
                        }, 500);
                    }).catch(error => {
                        reject(error);
                    });
                } else if (response && response.content) {
                    resolve(response.content);
                } else {
                    reject(new Error('No content received from page'));
                }
            });
        });
    });
}

// Function to send indexing status to popup
async function sendIndexingStatus(status, url, error = null) {
    console.log(`Sending indexing status: ${status} for ${url}`);
    
    const message = {
        type: 'indexing_status',
        status: status,
        url: url,
        error: error
    };

    try {
        // Try to send message to popup
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Expected error (popup may be closed):', chrome.runtime.lastError.message);
                    resolve(false);
                } else {
                    console.log('Notification sent successfully:', status);
                    resolve(true);
                }
            });
        });

        // If popup is not open, store the message for later
        if (!response) {
            console.log('Popup not open, storing message for later');
            // Store the message in chrome.storage.local
            chrome.storage.local.get(['pendingNotifications'], (result) => {
                const pendingNotifications = result.pendingNotifications || [];
                pendingNotifications.push(message);
                chrome.storage.local.set({ pendingNotifications });
            });
        }
    } catch (error) {
        console.error('Error sending indexing status:', error);
    }
}

// Function to check and send pending notifications when popup opens
function checkPendingNotifications() {
    chrome.storage.local.get(['pendingNotifications'], (result) => {
        const pendingNotifications = result.pendingNotifications || [];
        if (pendingNotifications.length > 0) {
            console.log(`Found ${pendingNotifications.length} pending notifications`);
            pendingNotifications.forEach(notification => {
                chrome.runtime.sendMessage(notification);
            });
            // Clear pending notifications
            chrome.storage.local.set({ pendingNotifications: [] });
        }
    });
}

// Listen for popup opening
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        console.log('Popup connected');
        checkPendingNotifications();
    }
});

// Function to index a page
async function indexPage(tab) {
    if (!tab || !tab.url) {
        console.error('Invalid tab or URL');
        return;
    }

    const url = tab.url;
    console.log('Starting to index page:', url);
    
    try {
        // Check if page is confidential first
        if (isConfidentialSite(url)) {
            console.log('Page is confidential, skipping:', url);
            await sendIndexingStatus('skipped', url);
            return;
        }

        // Send started notification
        await sendIndexingStatus('started', url);
        
        // Get page content
        const content = await getPageContent(tab);
        if (!content || content.length === 0) {
            throw new Error('No content extracted from page');
        }
        console.log('Got page content, length:', content.length);
        
        // Send to backend for indexing
        console.log('Sending to backend for indexing:', url);
        const response = await fetch(`${BACKEND_URL}/index`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                title: tab.title || '',
                content: content
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Backend indexing response:', result);
        
        if (result.success) {
            console.log('Indexing completed successfully:', url);
            await sendIndexingStatus('completed', url);
        } else {
            throw new Error(result.error || 'Unknown error from backend');
        }
    } catch (error) {
        console.error('Error indexing page:', error);
        await sendIndexingStatus('error', url, error.message);
    }
}

// Listen for tab updates to index new pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only index when the page is fully loaded and has a valid URL
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.startsWith('http') && 
        !tab.url.includes('chrome-extension://')) {
        
        console.log('Tab updated, checking if should index:', tab.url);
        
        // Check if we should index this page
        if (!isConfidentialSite(tab.url)) {
            console.log('Starting indexing for page:', tab.url);
            indexPage(tab).catch(err => {
                console.error('Error in tab update handler:', err);
            });
        } else {
            console.log('Skipping confidential page:', tab.url);
            sendIndexingStatus('skipped', tab.url);
        }
    }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.action === 'indexPage') {
        console.log('Received indexPage message:', message.url);
        indexPage({
            url: message.url,
            title: message.title
        }).then(() => {
            try {
                sendResponse({ success: true });
            } catch (err) {
                console.log('Error sending response:', err);
            }
        }).catch(error => {
            console.error('Error in indexPage handler:', error);
            try {
                sendResponse({ success: false, error: error.message });
            } catch (err) {
                console.log('Error sending error response:', err);
            }
        });
        return true; // Keep the message channel open for async response
    }
    
    if (message.action === 'ping') {
        console.log('Ping received from content script');
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'processPage') {
        processPageContent(message.url, message.content)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicate async response
    }
    
    if (message.action === 'search') {
        console.log('Search request received:', message.query);
        searchIndex(message.query)
            .then(results => {
                console.log(`Sending ${results.length} search results`);
                sendResponse({ results });
            })
            .catch(error => {
                console.error('Error during search:', error);
                sendResponse({ error: error.message });
            });
        return true; // Indicate async response
    }
    
    if (message.action === 'chat') {
        console.log('Chat request received:', message.query);
        chatWithGemini(message.query)
            .then(response => {
                console.log('Sending chat response');
                sendResponse({ response });
            })
            .catch(error => {
                console.error('Error during chat:', error);
                sendResponse({ error: error.message });
            });
        return true; // Indicate async response
    }
    
    if (message.action === 'updateConfidentialSites') {
        const success = updateConfidentialSites(message.sites);
        sendResponse({ success });
    }
    
    if (message.action === 'getConfidentialSites') {
        sendResponse({ sites: confidentialSites });
    }
    
    if (message.action === 'init') {
        console.log('Init request received from popup');
        if (!librariesLoaded) {
            loadLibraries()
                .then(() => {
                    console.log('Libraries loaded successfully');
                    sendResponse({ success: true });
                })
                .catch(error => {
                    console.error('Error loading libraries:', error);
                    sendResponse({ success: false, error: error.message });
                });
        } else {
            sendResponse({ success: true });
        }
        return true; // Indicate async response
    }
});

// Initialize when the extension is loaded
console.log('Initializing extension on load...');
initializeExtension(); 