"""Search service for biomarker extraction."""
import pandas as pd
import os
import sys
from typing import List, Dict, Any
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from utils.data_processing import cleaning

def input_data(input_type: str = "text", text_input: str = None, uploaded_file_content: bytes = None) -> List[str]:
    """
    Handle accession number input from either text input or file upload.
    Preserves nested function from biomarker_webapp.py (lines 420-437)
    """
    if input_type == "text":
        if text_input:
            acc_input = text_input.split()
        else:
            acc_input = None
    elif input_type == "file":
        if uploaded_file_content:
            content = uploaded_file_content.decode("utf-8")
            acc_input = content.split()
        else:
            acc_input = None
    else:
        acc_input = None
    
    return list(set(acc_input)) if acc_input else None

def find_common_biomarkers(file_names: List[str], all_files: Dict) -> List[str]:
    """
    Find common biomarkers across specified files.
    """
    file_data = {f: all_files[f]['file'] for f in file_names if f in all_files}
    new_files = [df.copy() for df in file_data.values()]
    
    if not new_files:
        return []
    
    rs_sets = [set(df['rs#']) for df in new_files]
    common_rs = sorted(set.intersection(*rs_sets))
    
    return common_rs

def prepare_biomarker_files_for_download(
    filtered_files: List[pd.DataFrame],
    common_rs: List[str],
    seen_accessions: List[str]
) -> Dict[str, Any]:
    """
    Prepare biomarker files for download in multiple formats.
    Preserves complex logic from biomarker_webapp.py (lines 543-620)
    """
    add_col = ['rs#', 'alleles', 'chrom', 'pos', 'strand', 'assembly#', 'center',
               'protLSID', 'assayLSID', 'panelLSID', 'QCcode']
    
    dfs = []  # For combined file
    all_dfs = []  # For separate files
    
    # Get columns that match accessions for each file
    cols_list = [list(set(df.columns) & set(seen_accessions)) 
                 for df in filtered_files]
    
    # Process for combined file (first iteration)
    for idx, df in enumerate(filtered_files):
        df_copy = df.copy()
        df_copy.set_index('rs#', inplace=True)
        subset = df_copy.loc[common_rs]
        df_copy.reset_index(inplace=True)
        subset = subset.reset_index()
        subset.rename(columns={'index': 'rs#'}, inplace=True)
        
        if idx == 0:
            subset = subset[add_col + cols_list[idx]]
        else:
            subset = subset[cols_list[idx]]
        
        dfs.append(subset)
    
    # Process for separate files (second iteration)
    for idx, df in enumerate(filtered_files):
        df_copy = df.copy()
        df_copy.set_index('rs#', inplace=True)
        subset = df_copy.loc[common_rs]
        df_copy.reset_index(inplace=True)
        subset = subset.reset_index()
        subset.rename(columns={'index': 'rs#'}, inplace=True)
        
        if idx == 0:
            subset = subset[add_col + cols_list[idx]]
        else:
            subset = subset[add_col + cols_list[idx]]
        
        all_dfs.append(subset)
    
    # Create combined file
    final_df = pd.concat(dfs, axis=1)
    final_df = cleaning(final_df)  # Handle duplicate columns
    
    if 'chrom' in final_df.columns:
        final_df.sort_values(by=['chrom', 'pos'], ascending=True, inplace=True)
    
    final_df = final_df.astype(str).replace('nan', 'NA', regex=True)
    
    date = datetime.now().strftime("%Y-%m-%d")
    
    # Ensure hapmap directory exists
    import os
    os.makedirs('hapmap', exist_ok=True)
    
    combined_file = "hapmap/common_biomarkers.hmp.txt"
    final_df.to_csv(combined_file, sep='\t', index=False)
    
    # Create separate files
    separate_files = []
    for idx, df in enumerate(all_dfs):
        if 'chrom' in df.columns:
            df.sort_values(by=['chrom', 'pos'], ascending=True, inplace=True)
        df = df.astype(str).replace('nan', 'NA', regex=True)
        file_name = f"hapmap/common_biomarkers_{idx + 1}_{date}.hmp.txt"
        df.to_csv(file_name, sep='\t', index=False)
        separate_files.append(file_name)
    
    return {
        "combined_file": combined_file,
        "separate_files": separate_files,
        "date": date,
        "count": len(all_dfs)
    }

