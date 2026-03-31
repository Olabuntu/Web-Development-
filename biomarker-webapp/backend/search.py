"""Search routes."""
from flask import Blueprint, request, jsonify, send_file
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.file_service import get_all_files_from_database
from services.search_service import (
    input_data, find_common_biomarkers, prepare_biomarker_files_for_download
)
from services.conversion_service import vcf_conversion, dosage_conversion
from utils.file_utils import delete_all_files

bp = Blueprint('search', __name__)

# In-memory session storage (use Redis in production)
sessions = {}

@bp.route('/input', methods=['POST'])
def process_search_input():
    """Process search input (Stage 0)."""
    data = request.json
    input_type = data.get('input_type', 'text')
    text_input = data.get('text_input')
    uploaded_file_content = data.get('uploaded_file_content')
    
    # Clean up temporary files
    delete_all_files()
    
    # Process input
    accessions = input_data(input_type, text_input, uploaded_file_content)
    
    if not accessions:
        return jsonify({"success": False, "error": "No accessions provided"}), 400
    
    # Store in session
    session_id = request.headers.get('X-Session-ID', 'default')
    sessions[session_id] = {
        'accessions': accessions,
        'stage': 1
    }
    
    return jsonify({"success": True, "stage": 1, "accessions": accessions})

@bp.route('/check', methods=['POST'])
def check_accessions():
    """Check if accessions exist in database (Stage 1)."""
    session_id = request.headers.get('X-Session-ID', 'default')
    session = sessions.get(session_id, {})
    accessions = session.get('accessions', [])
    
    if not accessions:
        data = request.json
        accessions = data.get('accessions', [])
    
    if not accessions:
        return jsonify({"success": False, "error": "No accessions provided"}), 400
    
    try:
        # This uses cached data (like @st.cache_resource in original)
        # Only queries DB once on startup, then uses cache until new file uploaded
        all_files = get_all_files_from_database()
        
        found = []
        seen_accessions = []
        
        for file_name, file_data in all_files.items():
            df = file_data['file']
            cols = df.columns.tolist()
            
            # Case-insensitive matching
            matches = [h for h in cols 
                      if h.lower() in [c.lower() for c in accessions]]
            
            if matches:
                found.append({
                    "file_name": file_name,
                    "matches": matches,
                    "metadata": file_data['metadata']
                })
                seen_accessions.extend(matches)
        
        # Update session
        sessions[session_id] = {
            **session,
            'found_files': [f['file_name'] for f in found],
            'seen_accessions': list(set(seen_accessions)),
            'file_data': {name: {'file': data['file'], 'metadata': data['metadata']} 
                         for name, data in all_files.items()},
            'stage': 2
        }
        
        return jsonify({
            "success": True,
            "data": {
                "found_files": found,
                "seen_accessions": list(set(seen_accessions)),
                "total_entered": len(accessions),
                "total_found": len(set(seen_accessions))
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/biomarkers', methods=['POST'])
def find_biomarkers():
    """Find common biomarkers (Stage 2)."""
    session_id = request.headers.get('X-Session-ID', 'default')
    session = sessions.get(session_id, {})
    found_files = session.get('found_files', [])
    all_files = session.get('file_data', {})
    
    if not found_files:
        data = request.json
        found_files = data.get('file_names', [])
        all_files = get_all_files_from_database()
    
    if not found_files:
        return jsonify({"success": False, "error": "No files provided"}), 400
    
    try:
        common_rs = find_common_biomarkers(found_files, all_files)
        
        if not common_rs:
            return jsonify({
                "success": False,
                "error": "No common biomarkers found"
            }), 404
        
        # Prepare files for download
        file_data = {f: all_files[f]['file'] for f in found_files}
        filtered_files = [df.copy() for df in file_data.values()]
        seen_accessions = session.get('seen_accessions', [])
        
        file_info = prepare_biomarker_files_for_download(
            filtered_files, common_rs, seen_accessions
        )
        
        # Update session
        sessions[session_id] = {
            **session,
            'common_rs': common_rs,
            'file_info': file_info,
            'stage': 3
        }
        
        return jsonify({
            "success": True,
            "data": {
                "common_rs": common_rs,
                "count": len(common_rs),
                "file_info": file_info
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/prepare-download', methods=['POST'])
def prepare_download():
    """Prepare files for download (Stage 3)."""
    data = request.json
    format_type = data.get('format')  # 'hapmap', 'vcf', 'dosage'
    
    session_id = request.headers.get('X-Session-ID', 'default')
    session = sessions.get(session_id, {})
    file_info = session.get('file_info', {})
    
    try:
        if format_type in ['vcf', 'dosage']:
            # Convert hapmap files to VCF
            vcf_conversion()
        
        if format_type == 'dosage':
            # Convert VCF files to Dosage
            dosage_conversion()
        
        sessions[session_id] = {
            **session,
            'download_format': format_type,
            'stage': 4
        }
        
        return jsonify({"success": True, "stage": 4})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/download/<format_type>', methods=['GET'])
def download_file(format_type):
    """Download file (Stage 4)."""
    download_option = request.args.get('option', 'combined')  # 'combined' or 'separate'
    session_id = request.headers.get('X-Session-ID', 'default')
    session = sessions.get(session_id, {})
    file_info = session.get('file_info', {})
    date = file_info.get('date')
    
    try:
        if format_type == 'hapmap':
            if download_option == 'combined':
                file_path = 'hapmap/common_biomarkers.hmp.txt'
            else:
                idx = request.args.get('index', type=int, default=0)
                file_path = f'hapmap/common_biomarkers_{idx + 1}_{date}.hmp.txt'
        
        elif format_type == 'vcf':
            if download_option == 'combined':
                file_path = 'Vcf/common_biomarkers.vcf'
            else:
                idx = request.args.get('index', type=int, default=0)
                file_path = f'Vcf/common_biomarkers_{idx + 1}_{date}.vcf'
        
        elif format_type == 'dosage':
            if download_option == 'combined':
                file_path = 'Dosage/common_biomarkers.raw'
            else:
                idx = request.args.get('index', type=int, default=0)
                file_path = f'Dosage/common_biomarkers_{idx + 1}_{date}.raw'
        else:
            return jsonify({"success": False, "error": "Invalid format"}), 400
        
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({"success": False, "error": "File not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

