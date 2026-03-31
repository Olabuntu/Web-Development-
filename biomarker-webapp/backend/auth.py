"""Authentication routes with JWT support."""
from flask import Blueprint, request, jsonify
import os
import sys
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.auth_service import verify_credentials, generate_token, verify_token, get_current_user
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

logger = logging.getLogger(__name__)

bp = Blueprint('auth', __name__)

# Rate limiter for login endpoint
limiter = None  # Will be initialized in app.py

def init_limiter(app_instance):
    """Initialize rate limiter for this blueprint."""
    global limiter
    limiter = Limiter(
        app=app_instance,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"]
    )
    # Apply rate limiting to login endpoint
    if limiter:
        # Re-decorate the login function with rate limit
        original_login = bp.view_functions.get('login')
        if original_login:
            bp.view_functions['login'] = limiter.limit("5 per minute")(original_login)

@bp.route('/login', methods=['POST'])
def login():
    """
    User login endpoint with JWT token generation.
    Rate limited to prevent brute force attacks (5 attempts per minute).
    Rate limiting is applied via Flask-Limiter in app.py.
    """
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        logger.warning(f"Login attempt with missing credentials from {request.remote_addr}")
        return jsonify({
            "success": False,
            "error": "Username and password required"
        }), 400
    
    # Verify credentials
    if verify_credentials(username, password):
        # Generate JWT token
        token = generate_token(username)
        
        logger.info(f"Successful login for user: {username} from {request.remote_addr}")
        
        return jsonify({
            "success": True,
            "token": token,
            "expires_in": 86400,  # 24 hours in seconds
            "token_type": "Bearer",
            "message": "Logged in successfully"
        })
    else:
        logger.warning(f"Failed login attempt for username: {username} from {request.remote_addr}")
        return jsonify({
            "success": False,
            "error": "Invalid username or password"
        }), 401

@bp.route('/logout', methods=['POST'])
def logout():
    """
    User logout endpoint.
    Note: With JWT, logout is handled client-side by removing the token.
    For server-side logout, you would need to maintain a token blacklist.
    """
    # Get token from header if present
    auth_header = request.headers.get('Authorization')
    if auth_header:
        token = auth_header.replace('Bearer ', '').strip()
        payload = verify_token(token)
        if payload:
            username = payload.get('username')
            logger.info(f"User logged out: {username}")
    
    return jsonify({
        "success": True,
        "message": "Logged out successfully"
    })

@bp.route('/verify', methods=['GET'])
def verify():
    """
    Verify authentication token.
    Returns token validity and user information.
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({
            "success": False,
            "authenticated": False,
            "error": "No authorization header provided"
        }), 401
    
    try:
        token = auth_header.replace('Bearer ', '').strip()
        payload = verify_token(token)
        
        if payload:
            return jsonify({
                "success": True,
                "authenticated": True,
                "username": payload.get('username'),
                "expires_at": payload.get('exp'),
                "issued_at": payload.get('iat')
            })
        else:
            return jsonify({
                "success": False,
                "authenticated": False,
                "error": "Invalid or expired token"
            }), 401
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        return jsonify({
            "success": False,
            "authenticated": False,
            "error": "Token verification failed"
        }), 401

@bp.route('/refresh', methods=['POST'])
def refresh_token():
    """
    Refresh authentication token.
    Generates a new token if the current one is still valid.
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({
            "success": False,
            "error": "Authorization required"
        }), 401
    
    try:
        token = auth_header.replace('Bearer ', '').strip()
        payload = verify_token(token)
        
        if payload:
            # Generate new token
            username = payload.get('username')
            new_token = generate_token(username)
            
            return jsonify({
                "success": True,
                "token": new_token,
                "expires_in": 86400,
                "token_type": "Bearer"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Invalid or expired token"
            }), 401
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Token refresh failed"
        }), 401

