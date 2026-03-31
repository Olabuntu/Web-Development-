"""Statistics service."""
import pandas as pd
import os
import sys
from io import BytesIO

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database.db_connection import connect_database, close_database
from utils.cache_manager import cached_resource

@cached_resource
def get_unique_sequenced_accessions() -> int:
    """
    Count unique accessions across all database files.
    Preserves original function get_unique_sequeced_accessions() from biomarker_webapp.py (lines 143-172)
    """
    conn, cursor = connect_database()
    
    try:
        cursor.execute("SELECT * FROM files")
        rows = cursor.fetchall()
        
        # Process all rows and extract accessions before closing connection
        all_accessions = set()
        for row in rows:
            try:
                file_data = BytesIO(row[2])
                df = pd.read_csv(file_data, sep='\t')
                cols = df.columns.tolist()
                # Exclude standard Hapmap columns
                standard_cols = ['rs#', 'alleles', 'chrom', 'pos', 'strand', 'assembly#', 
                               'center', 'protLSID', 'assayLSID', 'panelLSID', 'QCcode']
                accessions = [h for h in cols if h not in standard_cols]
                all_accessions.update(accessions)
            except Exception as e:
                print(f"Error processing file {row[1] if len(row) > 1 else 'unknown'}: {e}")
                continue
        
        return len(all_accessions)
    except Exception as e:
        print(f"Error in get_unique_sequenced_accessions: {e}")
        raise
    finally:
        close_database(conn, cursor)

