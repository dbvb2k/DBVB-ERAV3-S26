# Web Indexer Backend

A Flask-based backend service for the Chrome extension that provides web page indexing, semantic search, and chatbot capabilities.

## Features

- Web page content indexing using FAISS
- Semantic search using Nomic embeddings
- Chatbot integration with Google's Gemini
- RESTful API endpoints
- CORS support for Chrome extension

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with your configuration:
```
SECRET_KEY=your-secret-key
GEMINI_API_KEY=your-gemini-api-key
```

4. Run the development server:
```bash
flask run
```

## API Endpoints

### Index Page
- **POST** `/api/index`
- Body: `{ "url": "https://example.com", "content": "page content" }`

### Search
- **POST** `/api/search`
- Body: `{ "query": "search query" }`

### Chat
- **POST** `/api/chat`
- Body: `{ "query": "chat query" }`

### Health Check
- **GET** `/api/health`

## Development

- The backend uses Flask's application factory pattern
- Services are modular and can be easily extended
- FAISS index is persisted to disk
- Gemini integration for chatbot capabilities

## Production Deployment

For production deployment:
1. Set proper environment variables
2. Use Gunicorn as the WSGI server
3. Configure proper CORS settings
4. Set up proper error handling and logging 