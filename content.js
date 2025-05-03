// Content script to capture page content and handle search result highlighting

// Global state variables
let isExtensionConnected = true;
let isProcessing = false;
let isBackgroundReady = false;
let reconnectAttempts = 0;
let lastProcessedUrl = null;

// Constants
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Function to check if extension is still valid and background is ready
function checkExtensionConnection() {
    return new Promise((resolve) => {
        try {
            // Try to send a ping message
            chrome.runtime.sendMessage({ action: 'ping' }, response => {
                if (chrome.runtime.lastError) {
                    console.log('Extension connection lost, will retry later');
                    isExtensionConnected = false;
                    isBackgroundReady = false;
                    resolve(false);
                } else {
                    isExtensionConnected = true;
                    // Check if background is ready
                    chrome.runtime.sendMessage({ action: 'init' }, response => {
                        if (response && response.success) {
                            console.log('Background script is ready');
                            isBackgroundReady = true;
                            reconnectAttempts = 0; // Reset reconnect attempts on successful connection
                            resolve(true);
                        } else {
                            console.log('Background script not ready yet');
                            isBackgroundReady = false;
                            resolve(false);
                        }
                    });
                }
            });
        } catch (error) {
            console.log('Extension context invalidated, will retry later');
            isExtensionConnected = false;
            isBackgroundReady = false;
            resolve(false);
        }
    });
}

// Function to extract text content from the page
function extractPageContent() {
    try {
        // Get the main content
        const mainContent = document.body.innerText;
        
        // Get the page title
        const title = document.title;
        
        // Get meta description if available
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        
        // Combine all content
        const content = `
Title: ${title}
Description: ${metaDescription}
Content: ${mainContent}
        `.trim();
        
        console.log('Extracted content length:', content.length);
        return content;
    } catch (error) {
        console.error('Error extracting page content:', error);
        return '';
    }
}

// Function to highlight text on the page
function highlightText(searchText) {
    if (!searchText) {
        console.log('No search text provided');
        return 0;
    }
    
    // Check if highlighting is enabled
    chrome.storage.local.get(['highlightEnabled'], function(result) {
        if (!result.highlightEnabled) {
            console.log('Highlighting is disabled, skipping highlight');
            return 0;
        }
        
        console.log('Starting highlight for text:', searchText);
        
        try {
            // Remove existing highlights first
            removeHighlights();
            
            // Create a temporary div to hold the search text for exact matching
            const tempDiv = document.createElement('div');
            tempDiv.textContent = searchText;
            const exactSearchText = tempDiv.textContent;
            
            const searchRegex = new RegExp(escapeRegExp(exactSearchText), 'gi');
            let matchCount = 0;
            
            // Get all text nodes in the document body
            const allNodes = [];
            const walk = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        // Skip script, style, and already highlighted nodes
                        const parent = node.parentNode;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        
                        if (parent.nodeName === 'SCRIPT' || 
                            parent.nodeName === 'STYLE' || 
                            parent.nodeName === 'NOSCRIPT' ||
                            parent.classList.contains('search-result-highlight') ||
                            parent.classList.contains('search-match')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );
            
            while (walk.nextNode()) {
                allNodes.push(walk.currentNode);
            }
            
            // Process each text node
            allNodes.forEach((textNode) => {
                const text = textNode.textContent;
                if (!text.match(searchRegex)) return;
                
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                let match;
                
                searchRegex.lastIndex = 0; // Reset regex state
                
                while ((match = searchRegex.exec(text)) !== null) {
                    // Add text before the match
                    if (match.index > lastIndex) {
                        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                    }
                    
                    // Create highlighted match
                    const span = document.createElement('span');
                    span.className = 'search-match';
                    span.style.backgroundColor = '#ffeb3b';
                    span.style.color = '#000';
                    span.style.fontWeight = 'bold';
                    span.style.padding = '2px 4px';
                    span.style.borderRadius = '3px';
                    span.style.margin = '0 1px';
                    span.textContent = match[0];
                    
                    fragment.appendChild(span);
                    lastIndex = match.index + match[0].length;
                    matchCount++;
                }
                
                // Add remaining text
                if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                }
                
                // Replace original text node with our fragment
                textNode.parentNode.replaceChild(fragment, textNode);
            });
            
            console.log(`Total matches found: ${matchCount}`);
            
            // Scroll to first match if any found, but only if this is the initial highlight
            if (matchCount > 0 && !document.querySelector('.search-match')) {
                const firstMatch = document.querySelector('.search-match');
                if (firstMatch) {
                    firstMatch.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }
            
            return matchCount;
        } catch (error) {
            console.error('Error in highlightText:', error);
            return 0;
        }
    });
}

// Function to remove existing highlights
function removeHighlights() {
    console.log('Removing existing highlights');
    
    // Remove spans with search-match class
    const matches = document.querySelectorAll('.search-match');
    matches.forEach(match => {
        const parent = match.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(match.textContent), match);
            parent.normalize();
        }
    });
    
    // Also remove any search-result-highlight spans
    const highlights = document.querySelectorAll('.search-result-highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        }
    });
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Add styles for highlights if they don't exist
if (!document.querySelector('#semantic-search-styles')) {
    const style = document.createElement('style');
    style.id = 'semantic-search-styles';
    style.textContent = `
        .search-result-highlight mark.search-match {
            background-color: #ffeb3b;
            color: #000;
            font-weight: bold;
            padding: 2px 4px;
            border-radius: 3px;
            box-shadow: 0 0 3px rgba(0,0,0,0.2);
            display: inline-block;
            margin: 0 1px;
            text-decoration: none;
            position: relative;
            z-index: 1;
        }
        .search-result-highlight mark.search-match:hover {
            background-color: #fff176;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
    `;
    document.head.appendChild(style);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    try {
        if (message.action === 'getPageContent') {
            const content = extractPageContent();
            console.log('Sending content back to background script');
            sendResponse({ content });
            return true;
        }
        
        if (message.action === 'highlightText') {
            console.log('Highlighting text:', message.text);
            // Ensure we're working with the DOM after it's fully loaded
            if (document.readyState === 'complete') {
                const matches = highlightText(message.text);
                console.log(`Highlighting complete. Found ${matches} matches.`);
                sendResponse({ matches });
            } else {
                // Wait for DOM to be ready
                window.addEventListener('load', () => {
                    const matches = highlightText(message.text);
                    console.log(`Highlighting complete. Found ${matches} matches.`);
                    sendResponse({ matches });
                });
            }
            return true;
        }
        
        if (message.action === 'ping') {
            console.log('Received ping from background script');
            sendResponse({ success: true });
            return true;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
    }
    return true; // Keep the message channel open for async response
});

// Initialize the content script
console.log('Content script initialized');
checkExtensionConnection().then(isConnected => {
    if (isConnected) {
        console.log('Successfully connected to extension');
        
        // Check for pending highlight
        chrome.runtime.sendMessage({ action: 'getPendingHighlight' }, response => {
            if (response && response.text) {
                console.log('Found pending highlight:', response.text);
                highlightText(response.text);
            }
        });
    } else {
        console.log('Failed to connect to extension, will retry later');
        setTimeout(checkExtensionConnection, RECONNECT_DELAY);
    }
});

// Add keyboard event listener for Ctrl+F
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault(); // Prevent default browser search
        const searchText = window.getSelection().toString() || prompt('Enter text to search:');
        if (searchText) {
            const matchCount = highlightText(searchText);
            if (matchCount === 0) {
                alert('No matches found');
            }
        }
    }
});

// Add a mutation observer to handle dynamic content
const observer = new MutationObserver((mutations) => {
    // Check if we have any pending highlight requests
    chrome.runtime.sendMessage({ action: 'getPendingHighlight' }, response => {
        if (response && response.text) {
            highlightText(response.text);
        }
    });
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
    childList: true,
    subtree: true
}); 