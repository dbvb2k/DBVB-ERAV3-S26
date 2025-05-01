# Semantic Search Chrome Extension

This Chrome extension builds a semantic search index for web pages you visit, allowing you to search for content using natural language queries.

## Features

- Builds Nomic embeddings for text content from web pages you visit
- Creates a FAISS index for efficient semantic search
- Automatically skips confidential sites (Gmail, banking sites, etc.)
- Allows you to search through your browsing history semantically
- Highlights search results on the original page
- Export/download your search index

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and active

## Testing Instructions

### Initial Testing with Test Data

The extension now includes test data to help you verify functionality:

1. After installing the extension, click on its icon in the toolbar to open the popup
2. In the search tab, try searching for terms like "machine learning", "web development", or "data science"
3. You should see results from the test pages that were automatically added to your index
4. Click on a result to see it open in a new tab (note: highlighting may not work for test pages)

### Building Your Own Index

After confirming the extension works with test data:

1. Browse to various web pages (non-confidential ones)
2. The extension will automatically extract text, create embeddings, and add them to the index
3. Check the console logs (see troubleshooting section below) to confirm pages are being processed
4. After visiting several pages, try searching for terms related to those pages
5. Results should now include content from pages you've visited

### Checking the Index Stats

1. Click on the extension icon
2. Go to the "Export" tab
3. You should see statistics about your index, including the number of chunks and unique URLs

## Troubleshooting

If you encounter issues:

### View Debug Logs

1. Go to `chrome://extensions/`
2. Find the Semantic Search Extension
3. Click on "Service Worker" under "Inspect views"
4. The console will show detailed logs about what's happening

### Common Issues

- **No search results**: Check if pages are being indexed by looking at the console logs
- **Error extracting text**: This is expected in the service worker environment - we use a regex-based approach instead of DOMParser
- **Pages not being processed**: Some sites may block content scripts, or the page might be in the confidential list

### Fixing Missing Index

If your index isn't building:
1. Visit a few normal web pages like Wikipedia articles
2. Check the console logs to confirm they're being processed
3. If nothing is being indexed, try reloading the extension

## Privacy

This extension:
- Only stores data locally in your browser
- Never sends your browsing data to any external servers
- Skips indexing content from confidential sites
- Allows you to control which sites are considered confidential

## Customization

You can modify the `confidential-sites.json` file to add or remove domains you consider sensitive.

## License

MIT 