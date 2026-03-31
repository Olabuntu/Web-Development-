"""Statistics routes."""
from flask import Blueprint, jsonify
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.stats_service import get_unique_sequenced_accessions

bp = Blueprint('stats', __name__)

@bp.route('/accessions', methods=['GET'])
def get_accession_count():
    """Get unique accession count."""
    try:
        count = get_unique_sequenced_accessions()
        return jsonify({"success": True, "count": count})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/files', methods=['GET'])
def get_file_statistics():
    """Get file statistics."""
    try:
        from services.file_service import get_all_files_from_database
        all_files = get_all_files_from_database()
        
        total_files = len(all_files)
        total_biomarkers = sum(data['file'].shape[0] for data in all_files.values())
        total_accessions = sum(data['file'].shape[1] - 11 for data in all_files.values())
        
        return jsonify({
            "success": True,
            "data": {
                "total_files": total_files,
                "total_biomarkers": total_biomarkers,
                "total_accessions": total_accessions
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

