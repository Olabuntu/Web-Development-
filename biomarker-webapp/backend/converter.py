"""File converter routes."""
from flask import Blueprint, request, jsonify, send_file
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.conversion_service import convert_file, check_tool_available
from utils.file_utils import delete_all_files
from config import Config

bp = Blueprint('converter', __name__)

@bp.route('', methods=['POST'])
def convert():
    """Convert file format."""
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    
    file = request.files['file']
    conversion_type = request.form.get('type')
    
    if not conversion_type:
        return jsonify({"success": False, "error": "Conversion type required"}), 400
    
    # Validate file extension matches conversion type
    if conversion_type in ["Hapmap haplod to Hapmap diploid", "Hapmap to VCF", "Hapmap to Dosage"]:
        if not file.filename.endswith('.hmp.txt'):
            return jsonify({"success": False, "error": "Invalid file type for conversion"}), 400
    elif conversion_type in ["VCF to Dosage", "VCF to Hapmap"]:
        if not file.filename.endswith('.vcf'):
            return jsonify({"success": False, "error": "Invalid file type for conversion"}), 400
    
    # Clean up temporary files
    delete_all_files()
    
    # Save uploaded file
    file_path = os.path.join('uploads', file.filename)
    os.makedirs('uploads', exist_ok=True)
    file.save(file_path)
    
    # Convert file
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        result = convert_file(conversion_type, file_path, output_dir)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@bp.route('/status/<job_id>', methods=['GET'])
def get_conversion_status(job_id):
    """Check conversion status."""
    # Implementation for async job status
    return jsonify({"success": False, "error": "Not implemented"}), 501

@bp.route('/download/<filename>', methods=['GET'])
def download_converted_file(filename):
    """Download converted file."""
    try:
        # Use Config.OUTPUT_DIR which points to the correct output directory
        output_dir = Config.OUTPUT_DIR
        file_path = output_dir / filename
        
        # Security: Prevent directory traversal
        file_path = file_path.resolve()
        output_dir_resolved = output_dir.resolve()
        
        if not str(file_path).startswith(str(output_dir_resolved)):
            return jsonify({"success": False, "error": "Invalid file path"}), 400
        
        if not file_path.exists():
            return jsonify({"success": False, "error": f"File not found: {filename}"}), 404
        
        if not file_path.is_file():
            return jsonify({"success": False, "error": "Path is not a file"}), 400
        
        return send_file(str(file_path), as_attachment=True, download_name=filename)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error downloading file {filename}: {error_details}")
        return jsonify({"success": False, "error": f"Download failed: {str(e)}"}), 500

@bp.route('/list', methods=['GET'])
def list_converted_files():
    """List all converted files in output directory."""
    output_dir = 'output'
    
    if not os.path.exists(output_dir):
        return jsonify({"success": True, "files": []})
    
    files = []
    for file in os.listdir(output_dir):
        file_path = os.path.join(output_dir, file)
        if os.path.isfile(file_path):
            files.append({
                "name": file,
                "path": file_path
            })
    
    return jsonify({"success": True, "files": files})

@bp.route('/check-tools', methods=['GET'])
def check_tools():
    """Check if external tools (TASSEL and PLINK) are available."""
    tassel_available = check_tool_available(Config.TASSEL_PATH)
    plink_available = check_tool_available(Config.PLINK_PATH)
    
    return jsonify({
        "success": True,
        "tools": {
            "tassel": {
                "available": tassel_available,
                "path": Config.TASSEL_PATH,
                "status": "ready" if tassel_available else "not found"
            },
            "plink": {
                "available": plink_available,
                "path": Config.PLINK_PATH,
                "status": "ready" if plink_available else "not found"
            }
        },
        "all_ready": tassel_available and plink_available
    })

