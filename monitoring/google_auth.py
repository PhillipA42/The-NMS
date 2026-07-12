import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Define the scopes required for Drive and Sheets APIs
# Adjust these scopes if you need write access (e.g., remove '.readonly')
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
]

def get_google_credentials():
    """
    Loads Google Service Account credentials from the environment variable.
    The environment variable 'GOOGLE_SERVICE_ACCOUNT_JSON' should contain the JSON string.
    """
    service_account_json = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    
    if not service_account_json:
        raise ValueError("Environment variable 'GOOGLE_SERVICE_ACCOUNT_JSON' is not set.")
    
    try:
        service_account_info = json.loads(service_account_json)
    except json.JSONDecodeError as e:
        raise ValueError("The 'GOOGLE_SERVICE_ACCOUNT_JSON' environment variable contains invalid JSON.") from e
        
    credentials = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=SCOPES
    )
    return credentials

def get_drive_service():
    """
    Returns an initialized Google Drive API client wrapper.
    """
    credentials = get_google_credentials()
    # You can change the version if needed, 'v3' is the current version for Drive API
    drive_service = build('drive', 'v3', credentials=credentials)
    return drive_service

def get_sheets_service():
    """
    Returns an initialized Google Sheets API client wrapper.
    """
    credentials = get_google_credentials()
    # 'v4' is the current version for Sheets API
    sheets_service = build('sheets', 'v4', credentials=credentials)
    return sheets_service
