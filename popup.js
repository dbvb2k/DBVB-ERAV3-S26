// Popup script for Semantic Search Extension

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const searchStats = document.getElementById('search-stats');
const confidentialSites = document.getElementById('confidential-sites');
const saveSettingsButton = document.getElementById('save-settings');
const downloadIndexButton = document.getElementById('download-index');
const exportStats = document.getElementById('export-stats');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const backendStatus = document.getElementById('backend-status');
const notificationArea = document.getElementById('notification-area');

console.log('Popup script loaded');

// Constants
const NOTIFICATION_DURATION = 5000; // 5 seconds in milliseconds

// Tab switching functionality
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs and contents
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Load tab-specific data
    if (tabId === 'settings') {
      console.log('Loading settings tab');
      loadConfidentialSites();
    } else if (tabId === 'export') {
      console.log('Loading export tab');
      getIndexStats();
    }
  });
});

// Search functionality
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// Settings functionality
saveSettingsButton.addEventListener('click', saveConfidentialSites);

// Export functionality
downloadIndexButton.addEventListener('click', downloadIndex);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message);
    
    if (message.type === 'indexing_status') {
        console.log('Received indexing status:', message.status);
        let notificationType = 'info';
        let notificationMessage = '';
        
        switch (message.status) {
            case 'started':
                notificationMessage = `Started indexing: ${message.url}`;
                notificationType = 'info';
                break;
            case 'completed':
                notificationMessage = `Successfully indexed: ${message.url}`;
                notificationType = 'success';
                break;
            case 'error':
                notificationMessage = `Error indexing ${message.url}: ${message.error || 'Unknown error'}`;
                notificationType = 'error';
                break;
            case 'skipped':
                notificationMessage = `Skipped confidential page: ${message.url}`;
                notificationType = 'info';
                break;
            default:
                notificationMessage = `Unknown status for ${message.url}: ${message.status}`;
                notificationType = 'info';
        }
        
        addNotification(notificationMessage, notificationType);
        sendResponse({ received: true });
    }
    return true; // Keep the message channel open for async response
});

// Also listen for window messages (for postMessage)
window.addEventListener('message', (event) => {
    // Verify the message is from our extension
    if (event.source !== window) return;
    
    const message = event.data;
    if (message.type === 'indexing_status') {
        console.log('Popup received postMessage:', message.status);
        let notificationType = 'info';
        let notificationMessage = '';
        
        switch (message.status) {
            case 'started':
                notificationMessage = `Started indexing: ${message.url}`;
                notificationType = 'info';
                break;
            case 'completed':
                notificationMessage = `Successfully indexed: ${message.url}`;
                notificationType = 'success';
                break;
            case 'error':
                notificationMessage = `Error indexing ${message.url}: ${message.error || 'Unknown error'}`;
                notificationType = 'error';
                break;
            case 'skipped':
                notificationMessage = `Skipped confidential page: ${message.url}`;
                notificationType = 'info';
                break;
            default:
                notificationMessage = `Unknown status for ${message.url}: ${message.status}`;
                notificationType = 'info';
        }
        
        addNotification(notificationMessage, notificationType);
    }
});

// Function to add a notification
function addNotification(message, type = 'info') {
    console.log('Adding notification:', message, type);
    
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.error('Notification area not found');
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = message;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    const close = document.createElement('span');
    close.className = 'close';
    close.textContent = '×';
    close.onclick = () => notification.remove();
    
    notification.appendChild(content);
    notification.appendChild(timestamp);
    notification.appendChild(close);
    
    // Add to the top of the notification area
    notificationArea.insertBefore(notification, notificationArea.firstChild);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode === notificationArea) {
            notification.remove();
        }
    }, NOTIFICATION_DURATION);
}

// Function to check backend status
async function checkBackendStatus() {
  try {
    const response = await fetch('http://localhost:5000/api/health');
    if (response.ok) {
      backendStatus.textContent = 'LLM Service: ON';
      backendStatus.classList.remove('status-off');
      backendStatus.classList.add('status-on');
    } else {
      throw new Error('Backend not healthy');
    }
  } catch (error) {
    console.error('Backend status check failed:', error);
    backendStatus.textContent = 'LLM Service: OFF';
    backendStatus.classList.remove('status-on');
    backendStatus.classList.add('status-off');
  }
}

// Check backend status periodically
setInterval(checkBackendStatus, 5000); // Check every 5 seconds

// Initial backend status check
checkBackendStatus();

// Function to perform a search
async function performSearch() {
  const query = searchInput.value.trim();
  const shouldHighlight = document.getElementById('highlight-checkbox').checked;
  
  if (!query) {
    searchResults.innerHTML = '<p>Please enter a search query.</p>';
    return;
  }
  
  console.log('Searching for:', query);
  searchResults.innerHTML = '<p>Searching...</p>';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'search', query: query });
    
    if (response && response.results) {
      // Remove duplicates based on URL
      const uniqueResults = response.results.reduce((acc, current) => {
        // Check if we already have this URL
        const existingResult = acc.find(item => item.url === current.url);
        if (!existingResult) {
          // If no existing result with this URL, add it
          acc.push(current);
        } else {
          // If we have a result with this URL, keep the one with higher score
          if (current.score > existingResult.score) {
            const index = acc.indexOf(existingResult);
            acc[index] = current;
          }
        }
        return acc;
      }, []);

      // Sort results by score in descending order
      uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      searchStats.textContent = `Found ${uniqueResults.length} unique results`;
      searchResults.innerHTML = '';
      
      uniqueResults.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        // Create title element if title exists
        if (result.title) {
          const resultTitle = document.createElement('div');
          resultTitle.className = 'result-title';
          resultTitle.textContent = result.title;
          resultItem.appendChild(resultTitle);
        }
        
        const resultText = document.createElement('div');
        resultText.className = 'result-text';
        resultText.textContent = result.content;
        
        const resultUrl = document.createElement('a');
        resultUrl.className = 'result-url';
        resultUrl.href = result.url;
        resultUrl.textContent = result.url;
        
        // Add click handler for highlighting
        resultItem.addEventListener('click', async () => {
          try {
            // Get the active tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // If we're on the same page, highlight the text
            if (activeTab.url === result.url) {
              if (shouldHighlight) {
                // Try to inject the content script first
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    files: ['content.js']
                  });
                } catch (err) {
                  console.log('Content script already injected or injection failed:', err);
                }
                
                // Send highlight message
                chrome.tabs.sendMessage(activeTab.id, {
                  action: 'highlightText',
                  text: query
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.error('Error highlighting:', chrome.runtime.lastError);
                  } else if (response && response.matches) {
                    console.log(`Highlighted ${response.matches} matches`);
                  }
                });
              }
            } else {
              // Navigate to the page and set up a listener for when it loads
              const tab = await chrome.tabs.create({ url: result.url, active: true });
              
              // Wait for the page to load before highlighting
              chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                  // Remove the listener
                  chrome.tabs.onUpdated.removeListener(listener);
                  
                  if (shouldHighlight) {
                    // Inject content script and highlight
                    chrome.scripting.executeScript({
                      target: { tabId: tab.id },
                      files: ['content.js']
                    }).then(() => {
                      chrome.tabs.sendMessage(tab.id, {
                        action: 'highlightText',
                        text: query
                      });
                    }).catch(err => console.error('Error injecting content script:', err));
                  }
                }
              });
            }
          } catch (error) {
            console.error('Error handling result click:', error);
          }
        });
        
        resultItem.appendChild(resultText);
        resultItem.appendChild(resultUrl);
        searchResults.appendChild(resultItem);
      });
    } else {
      searchStats.textContent = 'No results found';
    }
  } catch (error) {
    console.error('Error during search:', error);
    searchStats.textContent = 'Error: ' + error.message;
  }
}

// Save highlight preference
document.getElementById('highlight-checkbox').addEventListener('change', function(e) {
  chrome.storage.local.set({ 'highlightEnabled': e.target.checked });
});

// Load highlight preference
chrome.storage.local.get(['highlightEnabled'], function(result) {
  document.getElementById('highlight-checkbox').checked = result.highlightEnabled || false;
});

// Function to load confidential sites
function loadConfidentialSites() {
  console.log('Loading confidential sites list');
  
  chrome.runtime.sendMessage(
    { action: 'getConfidentialSites' },
    response => {
      console.log('Got confidential sites response:', response);
      
      if (response && response.sites) {
        confidentialSites.value = response.sites.join('\n');
        console.log(`Loaded ${response.sites.length} confidential sites`);
      } else {
        console.error('Failed to load confidential sites');
      }
    }
  );
}

// Function to save confidential sites
function saveConfidentialSites() {
  const sites = confidentialSites.value
    .split('\n')
    .map(site => site.trim())
    .filter(site => site.length > 0);
  
  console.log(`Saving ${sites.length} confidential sites`);
  
  chrome.runtime.sendMessage(
    { action: 'updateConfidentialSites', sites: sites },
    response => {
      console.log('Save confidential sites response:', response);
      
      if (response && response.success) {
        console.log('Settings saved successfully');
      } else {
        console.error('Failed to save settings:', response?.error || 'Unknown error');
      }
    }
  );
}

// Function to download index
async function downloadIndex() {
    console.log('Downloading index...');
    exportStats.textContent = 'Preparing download...';
    
    try {
        const response = await fetch('http://localhost:5000/api/download-index', {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get the filename from the Content-Disposition header if available
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'semantic_search_index.zip';
        if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        
        // Create a blob from the response
        const blob = await response.blob();
        
        // Create a link element and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        exportStats.textContent = 'Index downloaded successfully!';
    } catch (error) {
        console.error('Error downloading index:', error);
        exportStats.textContent = `Error downloading index: ${error.message}`;
    }
}

// Function to get index stats
async function getIndexStats() {
  console.log('Getting index stats');
  
  exportStats.textContent = 'Loading index stats...';
  
  try {
    const response = await fetch('http://localhost:5000/api/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Index stats response:', result);
    
    if (result.status === 'success') {
      const stats = result.stats;
      const message = `Index contains ${stats.total_documents} documents with dimension ${stats.dimension}.`;
      exportStats.textContent = message;
      
      // Show download button
      downloadIndexButton.style.display = 'inline-block';
      
      // Show or hide regenerate button based on index size
      let regenerateButton = document.getElementById('regenerate-index');
      if (!regenerateButton) {
        regenerateButton = document.createElement('button');
        regenerateButton.id = 'regenerate-index';
        regenerateButton.textContent = 'Regenerate Test Data';
        regenerateButton.addEventListener('click', regenerateTestData);
        downloadIndexButton.parentNode.insertBefore(regenerateButton, downloadIndexButton.nextSibling);
      }
      
      if (stats.total_documents === 0) {
        regenerateButton.style.display = 'inline-block';
        downloadIndexButton.style.display = 'none';
      } else {
        regenerateButton.style.display = 'none';
        downloadIndexButton.style.display = 'inline-block';
      }
    } else {
      const errorMsg = result.error || 'Unknown error getting index stats';
      exportStats.textContent = `Error: ${errorMsg}`;
      console.error('Failed to get index stats:', errorMsg);
      
      // Show regenerate button when there's an error
      let regenerateButton = document.getElementById('regenerate-index');
      if (!regenerateButton) {
        regenerateButton = document.createElement('button');
        regenerateButton.id = 'regenerate-index';
        regenerateButton.textContent = 'Regenerate Test Data';
        regenerateButton.addEventListener('click', regenerateTestData);
        downloadIndexButton.parentNode.insertBefore(regenerateButton, downloadIndexButton.nextSibling);
      }
      regenerateButton.style.display = 'inline-block';
      downloadIndexButton.style.display = 'none';
    }
  } catch (error) {
    console.error('Error getting index stats:', error);
    exportStats.textContent = `Error: ${error.message}`;
    
    // Show regenerate button on error
    let regenerateButton = document.getElementById('regenerate-index');
    if (!regenerateButton) {
      regenerateButton = document.createElement('button');
      regenerateButton.id = 'regenerate-index';
      regenerateButton.textContent = 'Regenerate Test Data';
      regenerateButton.addEventListener('click', regenerateTestData);
      downloadIndexButton.parentNode.insertBefore(regenerateButton, downloadIndexButton.nextSibling);
    }
    regenerateButton.style.display = 'inline-block';
    downloadIndexButton.style.display = 'none';
  }
}

// Function to regenerate test data
async function regenerateTestData() {
  console.log('Requesting test data regeneration');
  
  exportStats.textContent = 'Regenerating test data...';
  
  try {
    const response = await fetch('http://localhost:5000/api/regenerate-test-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Regenerate test data response:', result);
    
    if (result.success) {
      exportStats.textContent = 'Test data regenerated successfully. Try searching for "machine learning", "web development", or "data science".';
      setTimeout(getIndexStats, 1000); // Refresh stats after a delay
    } else {
      const errorMsg = result.error || 'Unknown error regenerating test data';
      exportStats.textContent = `Error: ${errorMsg}`;
      console.error('Failed to regenerate test data:', errorMsg);
    }
  } catch (error) {
    console.error('Error regenerating test data:', error);
    exportStats.textContent = `Error: ${error.message}`;
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup DOM loaded');
    
    // Initialize notification area
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.error('Notification area not found in DOM');
    } else {
        console.log('Notification area initialized');
    }

    // Initialize the extension
    chrome.runtime.sendMessage({ action: 'init' }, response => {
        if (response && response.success) {
            console.log('Extension initialized successfully');
            addNotification('Extension initialized successfully', 'success');
        } else {
            console.error('Failed to initialize extension:', response?.error || 'Unknown error');
            addNotification('Failed to initialize extension', 'error');
        }
    });

    // Set up message listener for indexing status
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Popup received message:', message);
        
        if (message.type === 'indexing_status') {
            console.log('Received indexing status:', message.status);
            let notificationType = 'info';
            let notificationMessage = '';
            
            switch (message.status) {
                case 'started':
                    notificationMessage = `Started indexing: ${message.url}`;
                    notificationType = 'info';
                    break;
                case 'completed':
                    notificationMessage = `Successfully indexed: ${message.url}`;
                    notificationType = 'success';
                    break;
                case 'error':
                    notificationMessage = `Error indexing ${message.url}: ${message.error || 'Unknown error'}`;
                    notificationType = 'error';
                    break;
                case 'skipped':
                    notificationMessage = `Skipped confidential page: ${message.url}`;
                    notificationType = 'error';
                    break;
                default:
                    notificationMessage = `Unknown status for ${message.url}: ${message.status}`;
                    notificationType = 'info';
            }
            
            addNotification(notificationMessage, notificationType);
            sendResponse({ received: true });
        }
        return true; // Keep the message channel open for async response
    });
}); 