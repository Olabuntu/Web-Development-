"""Cache management routes (for debugging/admin purposes)."""
from flask import Blueprint, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from utils.cache_manager import clear_cache, get_cache_info

bp = Blueprint('cache', __name__)

@bp.route('/clear', methods=['POST'])
def clear_all_cache():
    """
    Clear all cached database queries.
    This is automatically called when files are uploaded.
    """
    clear_cache()
    return jsonify({
        "success": True,
        "message": "Cache cleared. Database will reload on next request."
    })

@bp.route('/info', methods=['GET'])
def cache_info():
    """Get cache information (for debugging)."""
    info = get_cache_info()
    return jsonify({
        "success": True,
        "data": info
    })




