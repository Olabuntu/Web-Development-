"""File utility functions."""
from pathlib import Path
from typing import List, Dict
import os
import sys

# Add parent directory to path to import Config
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import Config

def read_all_files(directory: str = './uploads', extension: str = '*.hmp.txt') -> List[str]:
    """
    Read all files matching pattern from directory.
    Preserves original function from biomarker_webapp.py (lines 64-66)
    """
    all_files = list(Path(directory).glob(extension))
    return [file.name for file in all_files]

def delete_all_files() -> Dict[str, int]:
    """
    Clean up temporary files from all output directories.
    Preserves original function from biomarker_webapp.py (lines 229-249)
    Fixed: Uses absolute paths from Config to ensure correct directory cleanup
    """
    # Use absolute paths from Config to ensure we clean the correct directories
    directories = {
        'hapmap': Config.HAPMAP_DIR,
        'vcf': Config.VCF_DIR,
        'dosage': Config.DOSAGE_DIR,
        'uploads': Path(Config.BASE_DIR) / 'uploads',
        'output': Config.OUTPUT_DIR
    }
    
    deleted_counts = {}
    for name, dir_path in directories.items():
        count = 0
        if dir_path.exists():
            if name == 'hapmap':
                files = list(dir_path.glob("*.hmp.txt"))
            elif name == 'vcf':
                files = list(dir_path.glob("*.vcf"))
            else:
                # For uploads, output, and dosage: delete all files
                files = list(dir_path.glob("*"))
                # Filter out directories
                files = [f for f in files if f.is_file()]
            
            for file in files:
                try:
                    file.unlink()
                    count += 1
                except Exception as e:
                    print(f"Error deleting {file}: {e}")
        deleted_counts[name] = count
    
    return deleted_counts


