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
    if (!searchText) return 0;
    
    // Remove existing highlights first
    removeHighlights();
    
    const searchRegex = new RegExp(escapeRegExp(searchText), 'gi');
    let matches = 0;
    
    // Create a TreeWalker to find all text nodes
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip script and style nodes
                const parent = node.parentNode;
                if (parent.nodeName === 'SCRIPT' || 
                    parent.nodeName === 'STYLE' || 
                    parent.nodeName === 'NOSCRIPT' ||
                    parent.classList.contains('search-result-highlight')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    let node;
    const textNodes = [];
    
    // First, collect all matching text nodes
    while (node = walker.nextNode()) {
        const content = node.textContent;
        if (searchRegex.test(content)) {
            textNodes.push(node);
        }
    }
    
    // Then, highlight all matches
    textNodes.forEach(node => {
        const content = node.textContent;
        const span = document.createElement('span');
        span.className = 'search-result-highlight';
        span.innerHTML = content.replace(searchRegex, match => {
            matches++;
            return `<mark class="search-match">${match}</mark>`;
        });
        node.parentNode.replaceChild(span, node);
    });
    
    // If we found matches, scroll to the first one
    if (matches > 0) {
        const firstMatch = document.querySelector('.search-match');
        if (firstMatch) {
            firstMatch.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
    
    return matches;
}

// Function to remove existing highlights
function removeHighlights() {
    const highlights = document.querySelectorAll('.search-result-highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
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
            padding: 2px;
            border-radius: 2px;
            box-shadow: 0 0 2px rgba(0,0,0,0.2);
            display: inline-block;
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
            const matches = highlightText(message.text);
            sendResponse({ matches });
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
    } else {
        console.log('Failed to connect to extension, will retry later');
        setTimeout(checkExtensionConnection, RECONNECT_DELAY);
    }
}); 