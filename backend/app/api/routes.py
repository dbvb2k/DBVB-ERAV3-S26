from flask import jsonify, request, current_app, send_file
from app.api import bp
from app.services.embedding import get_embedding
from app.services.faiss_index import FaissIndex
from app.services.gemini_chat import GeminiChat
import os
import logging
import json
from pathlib import Path
import tempfile
import shutil
import zipfile
import uuid
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize services
faiss_index = None
gemini_chat = None

def init_services():
    """Initialize services within application context."""
    global faiss_index, gemini_chat
    if faiss_index is None:
        faiss_index = FaissIndex(current_app.config['FAISS_INDEX_PATH'])
    if gemini_chat is None:
        gemini_chat = GeminiChat(current_app.config['GEMINI_API_KEY'])

@bp.route('/index', methods=['POST'])
def index_page():
    """Index a web page's content."""
    init_services()
    data = request.get_json()
    
    if not data or 'url' not in data or 'content' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        # Get embedding for the content
        embedding = get_embedding(data['content'])
        
        # Add to FAISS index
        doc_id = faiss_index.add(embedding, {
            'url': data['url'],
            'content': data['content']
        })
        
        return jsonify({
            'success': True,
            'doc_id': doc_id
        })
    except Exception as e:
        logger.error(f'Error indexing page: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/search', methods=['POST'])
def search():
    """Search the index for similar content."""
    init_services()
    data = request.get_json()
    
    if not data or 'query' not in data:
        return jsonify({'error': 'Missing query'}), 400
    
    try:
        # Get embedding for the query
        query_embedding = get_embedding(data['query'])
        
        # Search the index
        results = faiss_index.search(query_embedding, k=5)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        logger.error(f'Error searching: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/chat', methods=['POST'])
def chat():
    """Chat with Gemini about the indexed content."""
    init_services()
    data = request.get_json()
    
    if not data or 'query' not in data:
        return jsonify({'error': 'Missing query'}), 400
    
    try:
        # Get relevant context from the index
        query_embedding = get_embedding(data['query'])
        context_results = faiss_index.search(query_embedding, k=3)
        
        # Prepare context for Gemini
        context = "\n".join([result['content'] for result in context_results])
        
        # Get response from Gemini
        response = gemini_chat.get_response(data['query'], context)
        
        return jsonify({
            'success': True,
            'response': response
        })
    except Exception as e:
        logger.error(f'Error in chat: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    init_services()
    return jsonify({
        'status': 'healthy',
        'index_size': faiss_index.size()
    })

@bp.route('/embed', methods=['POST'])
def get_text_embedding():
    """Get embedding for the given text."""
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing text'}), 400
    
    try:
        # Get embedding for the text
        embedding = get_embedding(data['text'])
        
        return jsonify({
            'success': True,
            'embedding': embedding.tolist()
        })
    except Exception as e:
        logger.error(f'Error getting embedding: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/regenerate-test-data', methods=['POST'])
def regenerate_test_data():
    """Regenerate test data in the index."""
    init_services()
    
    try:
        # Clear existing index
        faiss_index.clear()
        
        # Test data
        test_pages = [
            {
                'url': 'https://example.com/test1',
                'content': 'This is a test page about machine learning and artificial intelligence. Neural networks are becoming increasingly important in modern technology.'
            },
            {
                'url': 'https://example.com/test2',
                'content': 'Web development involves creating and maintaining websites. HTML, CSS, and JavaScript are the core technologies for building web pages.'
            },
            {
                'url': 'https://example.com/test3',
                'content': 'Data science combines statistics, math, programming, and domain expertise to extract insights from data.'
            }
        ]
        
        # Add test data to index
        for page in test_pages:
            embedding = get_embedding(page['content'])
            faiss_index.add(embedding, page)
        
        return jsonify({
            'success': True,
            'message': 'Test data regenerated successfully'
        })
    except Exception as e:
        logger.error(f'Error regenerating test data: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/download-index', methods=['GET'])
def download_index():
    """Download the current FAISS index and metadata."""
    init_services()
    
    try:
        # Create a temporary directory
        temp_dir = tempfile.mkdtemp()
        temp_dir_path = Path(temp_dir)
        
        try:
            # Create a unique filename for the zip
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            zip_filename = f'index_data_{timestamp}_{unique_id}.zip'
            zip_path = temp_dir_path / zip_filename
            
            # Create and populate the zip file
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                # Add the FAISS index file
                if faiss_index.index_path.exists():
                    zipf.write(faiss_index.index_path, 'faiss_index.bin')
                
                # Add the metadata file
                if faiss_index.index_path.with_suffix('.json').exists():
                    zipf.write(faiss_index.index_path.with_suffix('.json'), 'metadata.json')
                
                # Add stats file
                stats = {
                    'total_documents': faiss_index.size(),
                    'dimension': faiss_index.dimension,
                    'timestamp': str(Path(faiss_index.index_path).stat().st_mtime if faiss_index.index_path.exists() else None)
                }
                stats_path = temp_dir_path / 'stats.json'
                with open(stats_path, 'w') as f:
                    json.dump(stats, f, indent=2)
                zipf.write(stats_path, 'stats.json')
            
            # Create a copy of the zip file to send
            download_name = f'semantic_search_index_{timestamp}.zip'
            
            # Send the file and clean up after sending
            response = send_file(
                str(zip_path),  # Convert Path to string
                mimetype='application/zip',
                as_attachment=True,
                download_name=download_name
            )
            
            # Add cleanup callback
            @response.call_on_close
            def cleanup():
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.error(f'Error cleaning up temporary directory: {str(e)}')
            
            return response
            
        except Exception as e:
            # Clean up on error
            shutil.rmtree(temp_dir)
            raise
            
    except Exception as e:
        logger.error(f'Error preparing index download: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/stats', methods=['GET'])
def get_stats():
    """Get statistics about the index."""
    init_services()
    
    try:
        stats = {
            'total_documents': faiss_index.size(),
            'dimension': faiss_index.dimension,
            'index_size_bytes': os.path.getsize(faiss_index.index_path) if faiss_index.index_path.exists() else 0
        }
        
        return jsonify({
            'status': 'success',
            'stats': stats
        })
    except Exception as e:
        logger.error(f'Error getting stats: {str(e)}')
        return jsonify({'error': str(e)}), 500

@bp.route('/check-indexed', methods=['POST'])
def check_indexed():
    """Check if a page is already indexed."""
    init_services()
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({'error': 'Missing URL'}), 400
    
    try:
        # Check if URL exists in the index
        is_indexed = faiss_index.contains_url(data['url'])
        
        return jsonify({
            'success': True,
            'isIndexed': is_indexed
        })
    except Exception as e:
        logger.error(f'Error checking if page is indexed: {str(e)}')
        return jsonify({'error': str(e)}), 500 