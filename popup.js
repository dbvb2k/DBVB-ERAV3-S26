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
const NOTIFICATION_DURATION = 3000; // 3 seconds in milliseconds

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

    // Load settings when opening the popup
    loadConfidentialSites();

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

    // Connect to background script
    const port = chrome.runtime.connect({ name: 'popup' });
    
    // Listen for messages from background script
    port.onMessage.addListener((message) => {
        console.log('Popup received port message:', message);
        handleIndexingStatus(message);
    });
    
    // Handle disconnection
    port.onDisconnect.addListener(() => {
        console.log('Disconnected from background script');
    });

    // Also listen for direct messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Popup received direct message:', message);
        if (message.type === 'indexing_status') {
            handleIndexingStatus(message);
        }
        sendResponse({ received: true });
        return true; // Keep the message channel open for async response
    });

    // Function to handle indexing status messages
    function handleIndexingStatus(message) {
        console.log('Processing indexing status message:', message);
        // Update the status display
        updateStatus(message.status, message.url, message.error);
        
        // Add notification
        let notificationType = 'info';
        let notificationMessage = '';
        
        switch (message.status) {
            case 'skipped':
                if (message.error && message.error === 'Page already indexed') {
                    notificationMessage = `Page skipped: already indexed (${message.url})`;
                    notificationType = 'info';
                } else {
                    notificationMessage = `Skipped confidential page: ${message.url}`;
                    notificationType = 'error';
                }
                // Ensure the error message is displayed
                if (message.error) {
                    const errorElement = document.getElementById('error-message');
                    if (errorElement) {
                        errorElement.textContent = message.error;
                        errorElement.style.display = 'block';
                        console.log('Displayed error message for skipped page:', message.error);
                    } else {
                        console.error('Error element not found in DOM');
                    }
                }
                break;
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
            default:
                notificationMessage = `Unknown status for ${message.url}: ${message.status}`;
                notificationType = 'info';
        }
        
        // Add notification
        console.log('Adding notification:', notificationMessage, 'Type:', notificationType);
        addNotification(notificationMessage, notificationType);
    }

    // Add test button to settings tab
    const settingsTab = document.getElementById('settings-tab');
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Confidential Site Detection';
    testButton.onclick = async () => {
        const testUrl = 'https://mail.google.com';
        console.log('Testing confidential site detection for:', testUrl);
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'testConfidentialSite',
                url: testUrl
            });
            console.log('Test response:', response);
            if (response.isConfidential) {
                addNotification(`Test successful: ${testUrl} is confidential (matched: ${response.matchedPattern})`, 'success');
            } else {
                addNotification(`Test failed: ${testUrl} was not detected as confidential`, 'error');
            }
        } catch (error) {
            console.error('Test error:', error);
            addNotification(`Test error: ${error.message}`, 'error');
        }
    };
    settingsTab.insertBefore(testButton, settingsTab.firstChild);
});

// Function to add a notification
function addNotification(message, type = 'info') {
    console.log('Adding notification:', message, 'Type:', type);
    
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
    console.log('Notification added to DOM');
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentNode === notificationArea) {
            notification.remove();
            console.log('Notification auto-removed');
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
      return true;
    } else {
      throw new Error('Backend not healthy');
    }
  } catch (error) {
    console.error('Backend status check failed:', error);
    backendStatus.textContent = 'LLM Service: OFF';
    backendStatus.classList.remove('status-on');
    backendStatus.classList.add('status-off');
    return false;
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

  // Check LLM service status before proceeding
  const isServiceRunning = await checkBackendStatus();
  if (!isServiceRunning) {
    alert('LLM Service is down. Please start the service first before searching.');
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
            
            // If we're on the same page
            if (activeTab.url === result.url) {
              if (shouldHighlight) {
                // Inject content script first
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    files: ['content.js']
                  });
                  
                  // Send highlight message after content script is injected
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
                } catch (err) {
                  console.log('Content script already injected or injection failed:', err);
                }
              }
            } else {
              // Navigate to the page
              const tab = await chrome.tabs.create({ url: result.url, active: true });
              
              if (shouldHighlight) {
                // Store the search query for highlighting after page load
                chrome.storage.local.set({ pendingHighlight: { text: query } });
                
                // Wait for the page to load before highlighting
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                  if (tabId === tab.id && info.status === 'complete') {
                    // Remove the listener
                    chrome.tabs.onUpdated.removeListener(listener);
                    
                    // Inject content script and highlight
                    chrome.scripting.executeScript({
                      target: { tabId: tab.id },
                      files: ['content.js']
                    }).then(() => {
                      // Add a small delay to ensure content script is initialized
                      setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, {
                          action: 'highlightText',
                          text: query
                        }, (response) => {
                          if (chrome.runtime.lastError) {
                            console.error('Error highlighting:', chrome.runtime.lastError);
                            // Retry highlighting after a longer delay if it fails
                            setTimeout(() => {
                              chrome.tabs.sendMessage(tab.id, {
                                action: 'highlightText',
                                text: query
                              }, (retryResponse) => {
                                if (chrome.runtime.lastError) {
                                  console.error('Error highlighting on retry:', chrome.runtime.lastError);
                                } else if (retryResponse && retryResponse.matches) {
                                  console.log(`Highlighted ${retryResponse.matches} matches on retry`);
                                }
                              });
                            }, 1000);
                          } else if (response && response.matches) {
                            console.log(`Highlighted ${response.matches} matches`);
                          }
                        });
                      }, 500);
                    }).catch(err => {
                      console.error('Error injecting content script:', err);
                      // Retry content script injection after a delay
                      setTimeout(() => {
                        chrome.scripting.executeScript({
                          target: { tabId: tab.id },
                          files: ['content.js']
                        }).then(() => {
                          // Try highlighting again after content script is injected
                          setTimeout(() => {
                            chrome.tabs.sendMessage(tab.id, {
                              action: 'highlightText',
                              text: query
                            });
                          }, 500);
                        }).catch(retryErr => console.error('Error injecting content script on retry:', retryErr));
                      }, 1000);
                    });
                  }
                });
              }
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
async function loadConfidentialSites() {
    console.log('Loading confidential sites list');
    
    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { action: 'getConfidentialSites' },
                response => {
                    if (chrome.runtime.lastError) {
                        console.error('Error getting confidential sites:', chrome.runtime.lastError);
                        resolve({ sites: [] });
                    } else {
                        resolve(response);
                    }
                }
            );
        });
        
        console.log('Got confidential sites response:', response);
        
        if (response && Array.isArray(response.sites)) {
            confidentialSites.value = response.sites.join('\n');
            console.log(`Loaded ${response.sites.length} confidential sites`);
        } else {
            console.error('Invalid response format for confidential sites');
            confidentialSites.value = '';
        }
    } catch (error) {
        console.error('Error loading confidential sites:', error);
        confidentialSites.value = '';
    }
}

// Function to save confidential sites
async function saveConfidentialSites() {
    const sites = confidentialSites.value
        .split('\n')
        .map(site => site.trim())
        .filter(site => site.length > 0);
    
    console.log(`Saving ${sites.length} confidential sites`);
    
    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { action: 'updateConfidentialSites', sites: sites },
                response => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving confidential sites:', chrome.runtime.lastError);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                }
            );
        });
        
        console.log('Save confidential sites response:', response);
        
        if (response && response.success) {
            console.log('Settings saved successfully');
            addNotification('Settings saved successfully', 'success');
        } else {
            const errorMsg = response?.error || 'Unknown error';
            console.error('Failed to save settings:', errorMsg);
            addNotification(`Failed to save settings: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        addNotification(`Error saving settings: ${error.message}`, 'error');
    }
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

// Function to update status display
function updateStatus(status, url, error = null) {
    const statusElement = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const errorElement = document.getElementById('error-message');
    
    if (!statusElement || !statusText || !errorElement) {
        console.error('Status elements not found in DOM');
        return;
    }
    
    // Clear previous status
    statusElement.className = '';
    statusText.textContent = '';
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    
    // Update status based on type
    switch (status) {
        case 'started':
            statusElement.classList.add('indexing');
            statusText.textContent = 'Indexing page...';
            break;
            
        case 'completed':
            statusElement.classList.add('completed');
            statusText.textContent = 'Page indexed successfully!';
            break;
            
        case 'error':
            statusElement.classList.add('error');
            statusText.textContent = 'Error indexing page';
            if (error) {
                errorElement.textContent = error;
                errorElement.style.display = 'block';
            }
            break;
            
        case 'skipped':
            statusElement.classList.add('skipped');
            statusText.textContent = 'Page skipped';
            if (error) {
                errorElement.textContent = error;
                errorElement.style.display = 'block';
            }
            // Reset status after 3 seconds
            setTimeout(() => {
                statusElement.className = 'idle';
                statusText.textContent = 'Ready to search';
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }, NOTIFICATION_DURATION);
            break;
            
        default:
            statusElement.classList.add('idle');
            statusText.textContent = 'Ready to search';
    }
    
    console.log('Updated status display:', status, 'for URL:', url);
}

async function getConfidentialSites() {
    console.log('Requesting confidential sites list...');
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getConfidentialSites' });
        console.log('Got confidential sites response:', response);
        if (response && response.sites) {
            console.log('Loaded', response.sites.length, 'confidential sites');
            return response.sites;
        } else {
            console.warn('No sites in response:', response);
            return [];
        }
    } catch (error) {
        console.error('Error getting confidential sites:', error);
        return [];
    }
} 