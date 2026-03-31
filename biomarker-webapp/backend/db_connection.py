"""Database connection management."""
import mysql.connector
import os
import sys
from mysql.connector import pooling

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import Config

# Connection pool configuration
_pool = None

def _get_pool():
    """Get or create connection pool."""
    global _pool
    if _pool is None:
        try:
            pool_config = {
                'pool_name': 'biomarker_pool',
                'pool_size': 5,
                'pool_reset_session': True,
                'host': Config.DB_HOST,
                'user': Config.DB_USER,
                'password': Config.DB_PASSWORD,
                'database': Config.DB_NAME,
                'autocommit': False,
                'connect_timeout': 10,
                'charset': 'utf8mb4',
                'collation': 'utf8mb4_unicode_ci'
            }
            _pool = mysql.connector.pooling.MySQLConnectionPool(**pool_config)
        except mysql.connector.Error as e:
            error_msg = f"Failed to create connection pool: {e}"
            print(f"ERROR: {error_msg}")
            print(f"  Host: {Config.DB_HOST}")
            print(f"  User: {Config.DB_USER}")
            print(f"  Database: {Config.DB_NAME}")
            raise Exception(error_msg)
    return _pool

def connect_database():
    """
    Create and return database connection.
    Uses connection pool for better resource management.
    Preserves original function from biomarker_webapp.py (lines 69-77)
    """
    try:
        pool = _get_pool()
        conn = pool.get_connection()
        # Test the connection
        conn.ping(reconnect=True, attempts=3, delay=1)
        cursor = conn.cursor(buffered=True)
        return conn, cursor
    except mysql.connector.Error as e:
        error_msg = f"Database connection failed: {e}"
        print(f"ERROR: {error_msg}")
        print(f"  Host: {Config.DB_HOST}")
        print(f"  User: {Config.DB_USER}")
        print(f"  Database: {Config.DB_NAME}")
        print(f"  Password set: {'Yes' if Config.DB_PASSWORD else 'No'}")
        raise Exception(error_msg)

def close_database(conn, cursor):
    """Close database connection and cursor."""
    try:
        if cursor:
            cursor.close()
    except Exception as e:
        print(f"Warning: Error closing cursor: {e}")
    finally:
        try:
            if conn and conn.is_connected():
                conn.close()
        except Exception as e:
            print(f"Warning: Error closing connection: {e}")

