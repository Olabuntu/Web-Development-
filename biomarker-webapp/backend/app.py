"""Main Flask application."""
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sys
import os
import logging

sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from routes import auth, files, search, converter, stats, cache

# Pre-load cache on startup (like Streamlit's initial cache load)
def preload_cache():
    """Pre-load database cache on startup in background thread for faster initial response."""
    import threading
    
    def _preload():
        """Background thread function to preload cache."""
        try:
            with app.app_context():
                from services.file_service import get_all_files_from_database
                from services.stats_service import get_unique_sequenced_accessions
                
                logging.info("Pre-loading database cache in background...")
                get_all_files_from_database()  # Cache all files
                get_unique_sequenced_accessions()  # Cache accession count
                logging.info("Database cache pre-loaded successfully")
        except Exception as e:
            logging.warning(f"Could not pre-load cache: {e}")
            logging.info("Cache will be populated on first request")
    
    # Start preloading in background thread (daemon thread so it doesn't block shutdown)
    thread = threading.Thread(target=_preload, daemon=True)
    thread.start()
    logging.info("Application starting... Cache will be pre-loaded in background.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config.from_object(Config)
CORS(app, origins=Config.CORS_ORIGINS)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"  # Use in-memory storage (use Redis in production)
)

# Register blueprints
app.register_blueprint(auth.bp, url_prefix='/api/auth')
app.register_blueprint(files.bp, url_prefix='/api/files')
app.register_blueprint(search.bp, url_prefix='/api/search')
app.register_blueprint(converter.bp, url_prefix='/api/convert')
app.register_blueprint(stats.bp, url_prefix='/api/statistics')
app.register_blueprint(cache.bp, url_prefix='/api/cache')

# Initialize auth limiter after blueprints are registered
auth.init_limiter(app)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "version": "1.0.0"})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend files."""
    if path != "" and path != "/" and not path.startswith('api'):
        try:
            return send_from_directory(app.static_folder, path)
        except:
            pass
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Create necessary directories (in BASE_DIR, not current working directory)
    from pathlib import Path
    base_dir = Path(__file__).parent.parent
    for dir_name in ['uploads', 'hapmap', 'Vcf', 'Dosage', 'output']:
        dir_path = base_dir / dir_name
        dir_path.mkdir(exist_ok=True)
    
    # Pre-load cache on startup (like Streamlit's initial load)
    preload_cache()
    
    print(f"Starting server on http://{Config.HOST}:{Config.PORT}")
    app.run(debug=Config.DEBUG, host=Config.HOST, port=Config.PORT)

