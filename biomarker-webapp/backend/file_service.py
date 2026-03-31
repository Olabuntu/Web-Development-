"""File service for database operations."""
import pandas as pd
import os
import sys
from io import BytesIO
from typing import Dict, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database.db_connection import connect_database, close_database
from utils.data_processing import normalizing, removing_duplicates
from utils.cache_manager import cached_resource

@cached_resource
def get_all_files_from_database() -> Dict[str, Dict]:
    """
    Retrieve all files and metadata from database.
    Preserves original function all_database() from biomarker_webapp.py (lines 82-105)
    """
    conn, cursor = connect_database()
    
    try:
        cursor.execute("SELECT * FROM files")
        rows = cursor.fetchall()
        
        # Process all rows and create DataFrames before closing connection
        all_info = {}
        for row in rows:
            try:
                file_data = BytesIO(row[2])
                df = pd.read_csv(file_data, sep='\t')
                file_name, metadata = row[1], row[3]
                
                all_info[file_name] = {
                    "file": df,
                    "metadata": metadata
                }
            except Exception as e:
                print(f"Error processing file {row[1] if len(row) > 1 else 'unknown'}: {e}")
                continue
        
        return all_info
    except Exception as e:
        print(f"Error in get_all_files_from_database: {e}")
        raise
    finally:
        close_database(conn, cursor)

def add_file_to_database(file_path: str, metadata: str, file_name: str) -> bool:
    """
    Add file to database.
    Preserves original function from biomarker_webapp.py (lines 190-198)
    """
    try:
        with open(file_path, "rb") as f:
            file_data = f.read()
        
        conn, cursor = connect_database()
        try:
            cursor.execute("USE allfiles")
            cursor.execute(
                "INSERT INTO files (FileName, File, MetaData) VALUES (%s, %s, %s)",
                (file_name, file_data, metadata)
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            close_database(conn, cursor)
    except Exception as e:
        print(f"Error adding file to database: {e}")
        return False

def upload_file_to_database(file_path: str, metadata: str, file_name: str) -> bool:
    """
    Upload file to database (nested function logic).
    Preserves original nested function from biomarker_webapp.py (lines 899-909)
    """
    return add_file_to_database(file_path, metadata, file_name)

def check_file_duplicate(file_path: str) -> Dict:
    """
    Check if file content already exists in database.
    Returns dict with 'exists' (bool) and 'existing_file' (dict with file_name and metadata) if duplicate found.
    Preserves duplicate checking logic from biomarker_webapp.py (lines 926-959)
    """
    df_new = pd.read_csv(file_path, sep='\t')
    
    conn, cursor = connect_database()
    try:
        cursor.execute("SELECT * FROM files")
        rows = cursor.fetchall()
        
        # Process all rows before closing connection
        all_info = {}
        for row in rows:
            try:
                file_data = BytesIO(row[2])
                df_existing = pd.read_csv(file_data, sep='\t')
                file_name, metadata = row[1], row[3]
                
                all_info[file_name] = {
                    "file": df_existing,
                    "metadata": metadata
                }
            except Exception as e:
                print(f"Error processing file {row[1] if len(row) > 1 else 'unknown'}: {e}")
                continue
        
        # Check if any existing file equals the new file and return the matching file info
        for file_name, info in all_info.items():
            if df_new.equals(info['file']):
                return {
                    "exists": True,
                    "existing_file": {
                        "file_name": file_name,
                        "metadata": info['metadata']
                    }
                }
        
        return {"exists": False, "existing_file": None}
    except Exception as e:
        print(f"Error in check_file_duplicate: {e}")
        raise
    finally:
        close_database(conn, cursor)

def process_file_upload(file_path: str, metadata: str, file_name: str) -> Dict:
    """
    Process file upload with validation and duplicate checking.
    """
    # Normalize file
    if not normalizing(file_path):
        return {
            "success": False,
            "error": "File is not in the correct format. Please check the [rs#] column."
        }
    
    # Remove duplicates
    removing_duplicates(file_path)
    
    # Read file to get stats
    df = pd.read_csv(file_path, sep='\t')
    shape = df.shape
    
    # Check for duplicates
    duplicate_check = check_file_duplicate(file_path)
    if duplicate_check["exists"]:
        existing_file = duplicate_check["existing_file"]
        return {
            "success": False,
            "error": f"The content of {file_name} already exists in the database.",
            "existing_file_name": existing_file["file_name"],
            "existing_metadata": existing_file["metadata"]
        }
    
    # Upload to database
    if upload_file_to_database(file_path, metadata, file_name):
        # Clear cache after successful upload (like st.cache_resource.clear() in original)
        from utils.cache_manager import clear_cache
        clear_cache()
        
        return {
            "success": True,
            "file_name": file_name,
            "biomarkers": shape[0],
            "accessions": shape[1] - 11
        }
    else:
        return {
            "success": False,
            "error": "Failed to upload file to database."
        }

