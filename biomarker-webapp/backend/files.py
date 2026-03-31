"""File management routes."""
from flask import Blueprint, request, jsonify, send_file
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.file_service import get_all_files_from_database, process_file_upload
from utils.file_utils import delete_all_files
from services.auth_service import require_auth, get_current_user, verify_credentials

bp = Blueprint('files', __name__)

@bp.route('/all', methods=['GET'])
def get_all_files():
    """Get all files from database (cached for performance)."""
    try:
        # This will use cached data if available (like @st.cache_resource in original)
        all_files = get_all_files_from_database()
        file_list = [
            {
                "file_name": name,
                "metadata": data['metadata'],
                "shape": list(data['file'].shape)
            }
            for name, data in all_files.items()
        ]
        return jsonify({"success": True, "data": file_list})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/upload', methods=['POST'])
@require_auth  # Require authentication for file uploads
def upload_file():
    """
    Upload file to database.
    Requires authentication - only logged-in users can upload files.
    """
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    
    file = request.files['file']
    metadata = request.form.get('metadata', '')
    
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400
    
    # Save uploaded file
    file_path = os.path.join('uploads', file.filename)
    os.makedirs('uploads', exist_ok=True)
    file.save(file_path)
    
    try:
        result = process_file_upload(file_path, metadata, file.filename)
        # Add user info to result
        from services.auth_service import get_current_user
        result['uploaded_by'] = get_current_user()
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/<int:file_id>', methods=['GET'])
def get_file(file_id):
    """Get specific file by ID."""
    # Implementation for getting file by ID
    return jsonify({"success": False, "error": "Not implemented"}), 501

@bp.route('/delete', methods=['DELETE'])
@require_auth  # Require authentication for file deletion
def delete_file():
    """Delete file from database by filename (with password confirmation)."""
    try:
        data = request.json or {}
        file_name = data.get('file_name')
        password = data.get('password')
        
        if not file_name:
            return jsonify({"success": False, "error": "File name not provided"}), 400
        
        if not password:
            return jsonify({"success": False, "error": "Password is required to delete file"}), 400
        
        # Verify password again before allowing delete
        username = get_current_user()
        if not username or not verify_credentials(username, password):
            return jsonify({"success": False, "error": "Invalid password"}), 403
        
        from database.db_connection import connect_database, close_database
        from utils.cache_manager import clear_cache
        
        conn, cursor = connect_database()
        try:
            # Delete from database (using 'files' table as per file_service.py)
            cursor.execute("DELETE FROM files WHERE FileName = %s", (file_name,))
            conn.commit()
            
            if cursor.rowcount > 0:
                # Clear cache after deletion
                clear_cache()
                return jsonify({"success": True, "message": f"File '{file_name}' deleted successfully"})
            else:
                return jsonify({"success": False, "error": f"File '{file_name}' not found"}), 404
        finally:
            close_database(conn, cursor)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/metadata', methods=['PUT'])
@require_auth
def update_metadata():
    """Update metadata for a file."""
    try:
        data = request.json or {}
        file_name = data.get('file_name')
        new_metadata = data.get('metadata')
        
        if not file_name:
            return jsonify({"success": False, "error": "File name not provided"}), 400
        
        if new_metadata is None:
            return jsonify({"success": False, "error": "Metadata is required"}), 400
        
        from database.db_connection import connect_database, close_database
        from utils.cache_manager import clear_cache
        
        conn, cursor = connect_database()
        try:
            cursor.execute(
                "UPDATE files SET MetaData = %s WHERE FileName = %s",
                (new_metadata, file_name)
            )
            conn.commit()
            
            if cursor.rowcount > 0:
                # Clear cache after update
                clear_cache()
                return jsonify({"success": True, "message": f"Metadata updated for '{file_name}'"})
            else:
                return jsonify({"success": False, "error": f"File '{file_name}' not found"}), 404
        finally:
            close_database(conn, cursor)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/cleanup', methods=['POST'])
def cleanup_files():
    """Clean up temporary files."""
    try:
        deleted_counts = delete_all_files()
        return jsonify({"success": True, "deleted": deleted_counts})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

