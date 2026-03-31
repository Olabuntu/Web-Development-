"""Cache management for database queries.
Mimics Streamlit's @st.cache_resource behavior - cache persists until explicitly cleared.
"""
from functools import wraps
from typing import Callable, Any
import threading

# Thread-safe in-memory cache
_cache = {}
_cache_lock = threading.Lock()

def cached_resource(func: Callable) -> Callable:
    """
    Decorator to cache function results (similar to @st.cache_resource).
    Cache persists until clear_cache() is called.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Create cache key from function name and arguments
        cache_key = f"{func.__name__}_{str(args)}_{str(sorted(kwargs.items()))}"
        
        with _cache_lock:
            if cache_key in _cache:
                return _cache[cache_key]
            
            # Call function and cache result
            result = func(*args, **kwargs)
            _cache[cache_key] = result
            return result
    
    return wrapper

def clear_cache():
    """
    Clear all cached resources (similar to st.cache_resource.clear()).
    Should be called when database changes (e.g., new file uploaded).
    """
    global _cache
    with _cache_lock:
        _cache.clear()
        print("Cache cleared - database queries will reload on next request")

def clear_cache_key(key_prefix: str):
    """
    Clear cache entries matching a key prefix.
    """
    global _cache
    with _cache_lock:
        keys_to_remove = [k for k in _cache.keys() if k.startswith(key_prefix)]
        for key in keys_to_remove:
            del _cache[key]
        if keys_to_remove:
            print(f"Cleared {len(keys_to_remove)} cache entries with prefix '{key_prefix}'")

def get_cache_info():
    """Get information about cached items."""
    with _cache_lock:
        return {
            "cached_functions": list(set(k.split('_')[0] for k in _cache.keys())),
            "total_entries": len(_cache)
        }




