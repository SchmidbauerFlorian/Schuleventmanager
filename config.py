import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Schule1")
DB_NAME = os.getenv("DB_NAME", "db_resourcemanagement")

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
AUTHORITY = os.getenv("AUTHORITY", "https://login.microsoftonline.com/common")
REDIRECT_PATH = os.getenv("REDIRECT_PATH", "/getAToken")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:5000/getAToken")
_scope_from_env = os.getenv("SCOPE", "User.Read.All").split()
_mandatory_graph_scopes = ["User.Read", "User.Read.All"]  # Ensure these are always included for user sync functionality
SCOPE = list(dict.fromkeys(_scope_from_env + _mandatory_graph_scopes))
ENDPOINT = os.getenv("ENDPOINT", "https://graph.microsoft.com/v1.0/me")
