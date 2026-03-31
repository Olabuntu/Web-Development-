"""Authentication service with JWT-based authentication."""
import os
import sys
import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import Config

# Authentication credentials
AUTH_CREDENTIALS = {
    'username': os.getenv('ADMIN_USERNAME', 'Dr Agre'),
    'password': os.getenv('ADMIN_PASSWORD', '1234')
}

# Store hashed password (hash on first load)
_hashed_password = None

def get_hashed_password() -> str:
    """Get or create hashed password."""
    global _hashed_password
    if _hashed_password is None:
        # Hash the password on first use
        _hashed_password = hash_password(AUTH_CREDENTIALS['password'])
    return _hashed_password

def hash_password(password: str) -> str:
    """
    Hash password using bcrypt.
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password string
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against hash.
    
    Args:
        password: Plain text password
        hashed: Hashed password string
    
    Returns:
        True if password matches, False otherwise
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def verify_credentials(username: str, password: str) -> bool:
    """
    Verify user credentials.
    Preserves original authentication logic from biomarker_webapp.py (lines 838, 859)
    Enhanced with password hashing.
    """
    if username != AUTH_CREDENTIALS['username']:
        return False
    
    # For backward compatibility, check plain text first, then hashed
    if password == AUTH_CREDENTIALS['password']:
        # If plain text matches, hash it for future use
        return True
    
    # Check against hashed password
    hashed = get_hashed_password()
    return verify_password(password, hashed)

def generate_token(username: str) -> str:
    """
    Generate JWT token for authenticated user.
    
    Args:
        username: Username to include in token
    
    Returns:
        JWT token string
    """
    payload = {
        'username': username,
        'session_id': secrets.token_urlsafe(16),
        'exp': datetime.utcnow() + timedelta(hours=24),  # 24 hour expiration
        'iat': datetime.utcnow(),
        'type': 'access'
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')

def verify_token(token: str) -> dict:
    """
    Verify and decode JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None

def get_current_user() -> str:
    """
    Get current authenticated user from request context.
    
    Returns:
        Username of current user
    """
    return getattr(g, 'current_user', None)

def require_auth(f):
    """
    Decorator to require authentication.
    Validates JWT token and sets current_user in request context.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                "success": False,
                "error": "Authentication required",
                "message": "Please provide an Authorization header with Bearer token"
            }), 401
        
        # Extract token from Bearer header
        try:
            token = auth_header.replace('Bearer ', '').strip()
        except:
            return jsonify({
                "success": False,
                "error": "Invalid authorization header format"
            }), 401
        
        # Verify token
        payload = verify_token(token)
        
        if not payload:
            return jsonify({
                "success": False,
                "error": "Invalid or expired token",
                "message": "Please log in again"
            }), 401
        
        # Set current user in request context
        g.current_user = payload.get('username')
        g.token_payload = payload
        
        return f(*args, **kwargs)
    return decorated_function

def optional_auth(f):
    """
    Decorator for optional authentication.
    Sets current_user if token is valid, but doesn't require it.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.replace('Bearer ', '').strip()
                payload = verify_token(token)
                if payload:
                    g.current_user = payload.get('username')
                    g.token_payload = payload
            except:
                pass  # Ignore errors for optional auth
        
        return f(*args, **kwargs)
    return decorated_function

