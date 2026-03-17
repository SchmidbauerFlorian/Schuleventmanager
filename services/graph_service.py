import json
import requests
import msal
from db.queries import upsert_users


GRAPH_USERS_URL = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle"


def _log_graph_json(label: str, payload):
    """Print raw Graph JSON payload to console for debugging."""
    print(f"[Graph:{label}] {json.dumps(payload, ensure_ascii=True)}")


def _ci_get(payload: dict, *keys):
    """Case-insensitive lookup for JSON object keys."""
    if not isinstance(payload, dict):
        return None
    lowered = {str(k).lower(): v for k, v in payload.items()}
    for key in keys:
        val = lowered.get(str(key).lower())
        if val is not None:
            return val
    return None


def _normalize_graph_user(user: dict) -> dict:
    """Normalize user fields to canonical Graph key names used by this project."""
    return {
        "id": _ci_get(user, "id"),
        "displayName": _ci_get(user, "displayName"),
        "mail": _ci_get(user, "mail"),
        "userPrincipalName": _ci_get(user, "userPrincipalName"),
        "jobTitle": _ci_get(user, "jobTitle"),
        "department": _ci_get(user, "department"),
        "officeLocation": _ci_get(user, "officeLocation"),
    }


def get_class_filter_delegated(access_token):
    """Load class filter list directly from Graph jobTitle values."""
    headers = {'Authorization': 'Bearer ' + access_token}
    url = "https://graph.microsoft.com/v1.0/users?$select=jobTitle,department&$top=999"

    classes_by_key = {}
    while url:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch class filter: {response.status_code} - {response.text}")

        data = response.json() if response.content else {}
        users = data.get('value', []) if isinstance(data, dict) else []

        for user in users:
            job_title = (_ci_get(user, "jobTitle") or "").strip()
            if not job_title:
                continue
            if job_title.lower() == 'teacher':
                continue

            key = job_title.lower()
            if key not in classes_by_key:
                classes_by_key[key] = job_title

        url = data.get('@odata.nextLink') if isinstance(data, dict) else None

    return sorted(classes_by_key.values(), key=lambda c: c.lower())


def _fetch_all_users(headers: dict):
    """Fetch users from Graph and follow @odata.nextLink until all pages are loaded."""
    url = GRAPH_USERS_URL
    all_users = []

    while url:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch users: {response.status_code} - {response.text}")

        data = response.json() if response.content else {}
        users = data.get('value', []) if isinstance(data, dict) else []
        all_users.extend(_normalize_graph_user(u) for u in users)
        url = data.get('@odata.nextLink') if isinstance(data, dict) else None

    return all_users


def sync_users_at_server_start(client_id, client_secret, authority):
    """Sync users once at server startup using app credentials."""
    app_client = msal.ConfidentialClientApplication(
        client_id,
        authority=authority,
        client_credential=client_secret,
    )
    # App-only tokens must use /.default and require granted app permissions (e.g. User.Read.All).
    token_result = app_client.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    access_token = token_result.get("access_token")
    if not access_token:
        error = token_result.get("error", "unknown_error")
        description = token_result.get("error_description", "")
        raise Exception(f"Failed to acquire Graph app token: {error} - {description}")

    all_users = _fetch_all_users({'Authorization': 'Bearer ' + access_token})
    if all_users:
        # upsert_users updates existing entries and rebuilds class filters from job_title.
        upsert_users(all_users)

    return len(all_users)

def sync_users_delegated(access_token):
    """
    Loads all users from MS Graph using the current user's delegated token.
    Requires delegated permission User.Read.All (or stronger).
    """
    headers = {'Authorization': 'Bearer ' + access_token}
    all_users = _fetch_all_users(headers)
            
    if all_users:
        upsert_users(all_users)
    
    return len(all_users)
