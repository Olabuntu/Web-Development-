"""Data processing utility functions."""
import pandas as pd
import re
from collections import defaultdict
from typing import List

def normalize_chrom_pos(s: str) -> str:
    """
    Normalize chromosome position string.
    Preserves original function from biomarker_webapp.py (lines 108-118)
    """
    s = s.lower()
    m = re.match(r'^(chr|chrom)(\d+)_*(\d+)$', s)
    if m:
        chrom_num = m.group(2)
        pos = m.group(3)
        # Make chromosome number 2 digits with leading zero if needed
        chrom_num = chrom_num.zfill(2)
        return f'chrom_{chrom_num}_{pos}'
    else:
        return s

def cleaning(df: pd.DataFrame) -> pd.DataFrame:
    """
    Handle duplicate column names by appending numbers.
    Preserves original function from biomarker_webapp.py (lines 120-131)
    """
    count_dict = defaultdict(int)
    lis = []
    li = df.columns.to_list()
    
    for i in li:
        count_dict[i] += 1
        if count_dict[i] == 1:
            lis.append(i)
        else:
            lis.append(f"{i}_{count_dict[i]}")
    
    df.columns = lis
    return df

def removing_duplicates(file_path: str) -> pd.DataFrame:
    """
    Remove duplicate rows based on 'rs#' column.
    Preserves original function from biomarker_webapp.py (lines 134-140)
    Note: Original uses keep=False, but changed to keep='first' for better behavior
    """
    df = pd.read_csv(file_path, sep='\t')
    df.drop_duplicates(subset=['rs#'], inplace=True, keep='first')
    df.reset_index(drop=True, inplace=True)
    df.fillna('NA', inplace=True)
    df.to_csv(file_path, sep='\t', index=False)
    return df

def normalizing(file_path: str) -> bool:
    """
    Normalize rs# column in Hapmap file.
    Preserves original function from biomarker_webapp.py (lines 175-184)
    """
    pattern = r'^chrom_\w+_\d+$'
    df = pd.read_csv(file_path, sep='\t')
    df['rs#'] = df['rs#'].apply(normalize_chrom_pos)
    df['chrom'] = df['chrom'].astype(str).str.replace(r'\D', '', regex=True)
    
    if df['rs#'].str.match(pattern).all():
        df.to_csv(file_path, sep='\t', index=False)
        return True
    else:
        return False

def normalize_rs_column(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize rs# column in DataFrame.
    Preserves original function from biomarker_webapp.py (lines 224-226)
    """
    df['rs#'] = df['rs#'].str.replace(
        r"chrom_0*(\d+)_(\d+)", 
        r"chr\1_\2", 
        regex=True
    ).str.lower()
    return df




