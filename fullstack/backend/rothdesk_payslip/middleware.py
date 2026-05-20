"""
Custom middleware for handling CSRF tokens in API endpoints
"""

from django.utils.deprecation import MiddlewareMixin
from django.middleware.csrf import get_token
from django.http import JsonResponse


class CSRFMiddleware(MiddlewareMixin):
    """
    Custom CSRF middleware that handles API endpoints
    """
    
    def process_request(self, request):
        # Skip CSRF for API endpoints that are exempt
        if request.path.startswith('/api/'):
            # Set CSRF token in request for API endpoints
            if not request.META.get('CSRF_COOKIE'):
                get_token(request)
        return None
    
    def process_response(self, request, response):
        # Add CSRF token to response headers for API endpoints
        if request.path.startswith('/api/'):
            csrf_token = get_token(request)
            response['X-CSRFToken'] = csrf_token
        return response

