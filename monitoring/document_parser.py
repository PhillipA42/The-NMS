import re
import logging
from typing import List, Dict, Any
from .google_auth import get_sheets_service

# Set up logging for error handling
logger = logging.getLogger(__name__)

# Basic Regex for validation
# Email regex (simple but effective for most common formats)
EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")
# Phone regex: allows optional '+', digits, spaces, dashes, and parentheses
PHONE_REGEX = re.compile(r"^\+?[\d\s\-\(\)]{7,20}$")

def validate_email(email: str) -> bool:
    """Returns True if the email format is valid."""
    if not email:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))

def validate_phone(phone: str) -> bool:
    """Returns True if the phone format is valid."""
    if not phone:
        return False
    return bool(PHONE_REGEX.match(phone.strip()))

def parse_contacts_sheet(spreadsheet_id: str, range_name: str = 'Sheet1!A:Z') -> List[Dict[str, Any]]:
    """
    Opens the specified Google Sheet by ID, reads Contractor and ICT Officer details,
    validates the fields, and returns a standardized list of dictionaries.
    
    Handles empty cells and formatting errors gracefully.
    """
    try:
        service = get_sheets_service()
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        rows = result.get('values', [])
    except Exception as e:
        logger.error(f"Failed to fetch data from Google Sheet ({spreadsheet_id}): {e}")
        # Return an empty list instead of crashing
        return []

    if not rows:
        logger.warning(f"No data found in Google Sheet ({spreadsheet_id}) at range {range_name}.")
        return []

    # Assume the first row contains headers
    headers = [str(header).strip().lower() for header in rows[0]]
    parsed_contacts = []
    
    # Helper to dynamically find column indices based on header names
    def get_column_index(*possible_names):
        for name in possible_names:
            for idx, header in enumerate(headers):
                if name in header:
                    return idx
        return -1
        
    # Dynamically locate columns regardless of exact order
    name_idx = get_column_index('name', 'contractor', 'officer')
    role_idx = get_column_index('role', 'type', 'position', 'title')
    email_idx = get_column_index('email', 'e-mail')
    phone_idx = get_column_index('phone', 'contact', 'mobile')
    
    # Fallback to strict column indices if headers don't match typical keywords
    if name_idx == -1 and email_idx == -1 and phone_idx == -1:
        logger.info("Could not automatically map headers. Falling back to default column indices (A=Name, B=Role, C=Email, D=Phone).")
        name_idx, role_idx, email_idx, phone_idx = 0, 1, 2, 3

    # Process each row (skipping the header row)
    for row_num, row in enumerate(rows[1:], start=2): # start=2 because rows[0] was header (row 1 in Sheets)
        # Skip completely empty rows
        if not row:
            continue
            
        # Safely extract values
        def get_val(idx):
            return str(row[idx]).strip() if idx != -1 and idx < len(row) else ""

        name = get_val(name_idx)
        role = get_val(role_idx)
        email = get_val(email_idx)
        phone = get_val(phone_idx)

        # Skip rows where all extracted critical fields are empty
        if not any([name, role, email, phone]):
            continue

        errors = []
        
        # Validation
        if email and not validate_email(email):
            errors.append(f"Invalid email format: '{email}'")
        if phone and not validate_phone(phone):
            errors.append(f"Invalid phone format: '{phone}'")
        if not name:
            errors.append("Missing Name")
            
        # A record is considered fully valid if there are no validation errors and it has at least a name
        is_valid = len(errors) == 0 and bool(name)

        contact_entry = {
            "row_number": row_num,
            "name": name,
            "role": role,
            "email": email,
            "phone": phone,
            "is_valid": is_valid,
            "errors": errors
        }
        
        parsed_contacts.append(contact_entry)
        
    return parsed_contacts
