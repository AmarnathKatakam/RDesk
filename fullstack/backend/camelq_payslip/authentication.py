"""
Custom authentication classes for API endpoints
"""

from rest_framework.authentication import SessionAuthentication


class CSRFExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication that doesn't enforce CSRF for API endpoints
    """
    
    def enforce_csrf(self, request):
        """
        Skip CSRF enforcement for API endpoints
        """
        return  # Skip CSRF check

