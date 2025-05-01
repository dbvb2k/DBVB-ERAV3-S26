import os
from dotenv import load_dotenv
from pathlib import Path

basedir = Path(os.path.abspath(os.path.dirname(__file__)))
load_dotenv(basedir / '.env')

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    NOMIC_API_KEY = os.environ.get('NOMIC_API_KEY')
    FAISS_INDEX_PATH = str(basedir / 'data' / 'faiss_index')
    EMBEDDING_MODEL = 'nomic-embed-text-v1.5'  # Updated to match the model used in nomic_embed.py
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max content length
    
    # Create data directory if it doesn't exist
    (basedir / 'data').mkdir(parents=True, exist_ok=True) 