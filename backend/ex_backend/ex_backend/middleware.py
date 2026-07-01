import logging
import traceback
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)

class DRF400LoggingMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        if response.status_code == 400:
            print(f">>> 400 ERROR RESPONSE BODY for {request.path}: {response.content}")
        return response
