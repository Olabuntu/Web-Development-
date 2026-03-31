"""File conversion service."""
import os
import sys
import subprocess
import shutil
import logging
from typing import List, Tuple, Optional, Dict
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import Config

logger = logging.getLogger(__name__)

def check_tool_available(tool_path: str) -> bool:
    """
    Check if external tool is available.
    
    Args:
        tool_path: Path to the tool (can be full path or command name)
    
    Returns:
        True if tool is available, False otherwise
    """
    if not tool_path:
        return False
    
    # If it's a full path, check if file exists
    if os.path.sep in tool_path or (os.name == 'nt' and ':' in tool_path):
        # Remove quotes if present
        clean_path = tool_path.strip("'\"")
        return os.path.exists(clean_path) and os.access(clean_path, os.X_OK)
    
    # If it's just a command name, check if it's in PATH
    return shutil.which(tool_path) is not None

def quote_path(path: str) -> str:
    """
    Quote path if it contains spaces or special characters.
    
    Args:
        path: File or directory path
    
    Returns:
        Quoted path string
    """
    # Remove existing quotes
    path = path.strip("'\"")
    
    # Quote if contains spaces or special characters
    if ' ' in path or any(char in path for char in ['&', '|', ';', '(', ')']):
        return f'"{path}"'
    return path

def build_safe_command(base_command: str, *args) -> str:
    """
    Build a safe command with properly quoted arguments.
    
    Args:
        base_command: Base command (tool path)
        *args: Additional arguments to quote
    
    Returns:
        Safe command string
    """
    quoted_base = quote_path(base_command)
    quoted_args = [quote_path(arg) if os.path.sep in arg or ' ' in arg else arg for arg in args]
    return f"{quoted_base} {' '.join(quoted_args)}"

def vcf_conversion(input_dir: str = './hapmap', output_dir: str = './Vcf') -> List[str]:
    """
    Convert all Hapmap files to VCF format.
    Preserves original function from biomarker_webapp.py (lines 200-209)
    Enhanced with better error handling and tool checking.
    """
    converted_files = []
    
    # Check if TASSEL is available
    if not check_tool_available(Config.TASSEL_PATH):
        logger.warning(f"TASSEL not found at {Config.TASSEL_PATH}")
        return converted_files
    
    if not os.path.exists(input_dir):
        logger.warning(f"Input directory does not exist: {input_dir}")
        return converted_files
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    for file in os.listdir(input_dir):
        if file.endswith('.hmp.txt'):
            input_path = os.path.join(input_dir, file)
            output_path = os.path.join(output_dir, file.replace('.hmp.txt', '.vcf'))
            
            # Build safe command with quoted paths
            cmd = build_safe_command(
                Config.TASSEL_PATH,
                '-fork1',
                '-importGuess', input_path,
                '-export', output_path,
                '-exportType', 'VCF'
            )
            
            logger.info(f"Running TASSEL conversion: {file} -> {os.path.basename(output_path)}")
            
            try:
                result = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                if result.returncode == 0 and os.path.exists(output_path):
                    converted_files.append(output_path)
                    logger.info(f"Successfully converted {file} to VCF")
                else:
                    error_msg = result.stderr or result.stdout or "Unknown error"
                    logger.error(f"TASSEL conversion failed for {file}: {error_msg}")
                    
            except subprocess.TimeoutExpired:
                logger.error(f"TASSEL conversion timed out for {file}")
            except Exception as e:
                logger.error(f"Error converting {file}: {str(e)}")
    
    return converted_files

def dosage_conversion(input_dir: str = './Vcf', output_dir: str = './Dosage') -> List[str]:
    """
    Convert all VCF files to Dosage format.
    Preserves original function from biomarker_webapp.py (lines 212-221)
    Enhanced with better error handling and tool checking.
    """
    converted_files = []
    
    # Check if PLINK is available
    if not check_tool_available(Config.PLINK_PATH):
        logger.warning(f"PLINK not found at {Config.PLINK_PATH}")
        return converted_files
    
    if not os.path.exists(input_dir):
        logger.warning(f"Input directory does not exist: {input_dir}")
        return converted_files
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    for file in os.listdir(input_dir):
        if file.endswith('.vcf'):
            input_path = os.path.join(input_dir, file)
            output_base = os.path.join(output_dir, file.replace('.vcf', ''))
            
            # Build safe command with quoted paths
            cmd = build_safe_command(
                Config.PLINK_PATH,
                '--vcf', input_path,
                '--export', 'A',
                '--out', output_base
            )
            
            logger.info(f"Running PLINK conversion: {file} -> {os.path.basename(output_base)}.raw")
            
            try:
                result = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                # PLINK creates .raw file
                output_file = f"{output_base}.raw"
                if result.returncode == 0 and os.path.exists(output_file):
                    converted_files.append(output_file)
                    logger.info(f"Successfully converted {file} to dosage format")
                else:
                    error_msg = result.stderr or result.stdout or "Unknown error"
                    logger.error(f"PLINK conversion failed for {file}: {error_msg}")
                    
            except subprocess.TimeoutExpired:
                logger.error(f"PLINK conversion timed out for {file}")
            except Exception as e:
                logger.error(f"Error converting {file}: {str(e)}")
    
    return converted_files

def get_conversion_command(
    conversion_type: str,
    input_path: str,
    output_path: str
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Generate conversion command based on type.
    Preserves logic from biomarker_webapp.py (lines 767-781)
    Returns: (main_command, intermediate_command, intermediate_file_path)
    """
    if conversion_type == "Hapmap haplod to Hapmap diploid":
        output_file = output_path.replace('.hmp.txt', '_diploid.hmp.txt')
        cmd = build_safe_command(
            Config.TASSEL_PATH,
            '-fork1',
            '-importGuess', input_path,
            '-export', output_file,
            '-exportType', 'HapmapDiploid'
        )
        return (cmd, None, None)
    
    elif conversion_type == "Hapmap to VCF":
        output_file = output_path.replace('.hmp.txt', '.vcf')
        cmd = build_safe_command(
            Config.TASSEL_PATH,
            '-fork1',
            '-importGuess', input_path,
            '-export', output_file,
            '-exportType', 'VCF'
        )
        return (cmd, None, None)
    
    elif conversion_type == "VCF to Dosage":
        output_base = output_path.replace('.vcf', '')
        cmd = build_safe_command(
            Config.PLINK_PATH,
            '--vcf', input_path,
            '--export', 'A',
            '--out', output_base
        )
        return (cmd, None, None)
    
    elif conversion_type == "Hapmap to Dosage":
        # Two-step conversion
        intermediate_path = output_path.replace('.hmp.txt', '.vcf')
        cmd1 = build_safe_command(
            Config.TASSEL_PATH,
            '-fork1',
            '-importGuess', input_path,
            '-export', intermediate_path,
            '-exportType', 'VCF'
        )
        output_base = output_path.replace('.hmp.txt', '')
        cmd2 = build_safe_command(
            Config.PLINK_PATH,
            '--vcf', intermediate_path,
            '--export', 'A',
            '--out', output_base
        )
        return (cmd2, cmd1, intermediate_path)
    
    elif conversion_type == "VCF to Hapmap":
        output_file = output_path.replace('.vcf', '.hmp.txt')
        cmd = build_safe_command(
            Config.TASSEL_PATH,
            '-fork1',
            '-importGuess', input_path,
            '-export', output_file,
            '-exportType', 'Hapmap'
        )
        return (cmd, None, None)
    
    return (None, None, None)

def convert_file(conversion_type: str, input_path: str, output_dir: str) -> dict:
    """
    Convert a single file based on conversion type.
    Enhanced with better error handling, tool checking, and validation.
    """
    if not os.path.exists(input_path):
        return {"success": False, "error": f"Input file not found: {input_path}"}
    
    file_name = os.path.basename(input_path)
    save_path = os.path.join(output_dir, file_name)
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    cmd, intermediate_cmd, intermediate_file = get_conversion_command(
        conversion_type, input_path, save_path
    )
    
    if not cmd:
        return {"success": False, "error": "Invalid conversion type"}
    
    # Check tool availability
    if 'TASSEL' in str(cmd) or (intermediate_cmd and 'TASSEL' in str(intermediate_cmd)):
        if not check_tool_available(Config.TASSEL_PATH):
            return {
                "success": False,
                "error": f"TASSEL not found at {Config.TASSEL_PATH}. Please check your TASSEL_PATH configuration."
            }
    
    if 'plink' in cmd.lower() or 'PLINK' in cmd:
        if not check_tool_available(Config.PLINK_PATH):
            return {
                "success": False,
                "error": f"PLINK not found at {Config.PLINK_PATH}. Please check your PLINK_PATH configuration or ensure PLINK is in your PATH."
            }
    
    # Execute intermediate command if needed (for Hapmap to Dosage)
    if intermediate_cmd:
        logger.info(f"Running intermediate conversion: {intermediate_cmd}")
        try:
            result1 = subprocess.run(
                intermediate_cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result1.returncode != 0:
                error_msg = result1.stderr or result1.stdout or "Unknown error"
                logger.error(f"Intermediate conversion failed: {error_msg}")
                return {
                    "success": False,
                    "error": f"Intermediate conversion failed: {error_msg}"
                }
            
            # Verify intermediate file exists
            if intermediate_file and not os.path.exists(intermediate_file):
                logger.error(f"Intermediate file not created: {intermediate_file}")
                return {
                    "success": False,
                    "error": f"Intermediate file not created: {os.path.basename(intermediate_file)}"
                }
            
            logger.info(f"Intermediate conversion successful: {intermediate_file}")
            
        except subprocess.TimeoutExpired:
            logger.error("Intermediate conversion timed out")
            return {"success": False, "error": "Intermediate conversion timed out after 5 minutes"}
        except Exception as e:
            logger.error(f"Intermediate conversion error: {str(e)}")
            return {"success": False, "error": f"Intermediate conversion error: {str(e)}"}
    
    # Execute main command
    logger.info(f"Running main conversion: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            # Check for output files
            output_files = [
                f for f in os.listdir(output_dir)
                if os.path.isfile(os.path.join(output_dir, f))
                and not f.endswith('.log')  # Exclude log files
            ]
            
            if output_files:
                logger.info(f"Conversion successful. Output files: {output_files}")
                return {
                    "success": True,
                    "output_dir": output_dir,
                    "files": output_files
                }
            else:
                logger.warning("Conversion completed but no output files found")
                return {
                    "success": False,
                    "error": "Conversion completed but no output files were created. Check the conversion logs."
                }
        else:
            error_msg = result.stderr or result.stdout or "Unknown error"
            logger.error(f"Conversion failed: {error_msg}")
            return {
                "success": False,
                "error": f"Conversion failed: {error_msg}"
            }
            
    except subprocess.TimeoutExpired:
        logger.error("Conversion timed out")
        return {"success": False, "error": "Conversion timed out after 5 minutes"}
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        return {"success": False, "error": f"Conversion error: {str(e)}"}

