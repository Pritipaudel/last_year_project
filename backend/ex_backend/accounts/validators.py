import re
from django.core.exceptions import ValidationError

5
class PasswordStrengthValidator:
    """
    Validates that the password meets high security standards:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    """
    
    def __init__(self):
        self.special_chars = r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]'
    
    def __call__(self, password):
        errors = []
        
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")
        
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter.")
        
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter.")
        
        if not re.search(r'[0-9]', password):
            errors.append("Password must contain at least one number.")
        
        if not re.search(self.special_chars, password):
            errors.append("Password must contain at least one special character (!@#$%^&*()_+-=[]{};\\':\",.<>?/\\|`~).")
        
        if errors:
            raise ValidationError(errors)
    
    def get_help_text(self):
        return (
            "Your password must contain at least 8 characters, including "
            "uppercase letters, lowercase letters, numbers, and special characters."
        )
