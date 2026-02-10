from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from services.event_service import create_event, get_events
from services.permission_service import can_plan
import os
import msal 
import uuid
import requests
import config


app = Flask(__name__)
app.config.from_object(config)
app.secret_key = os.urandom(24)

def _build_msal_app(cache=None):
    return msal.ConfidentialClientApplication(
        app.config["CLIENT_ID"],
        authority=app.config["AUTHORITY"],
        client_credential=app.config["CLIENT_SECRET"],
        token_cache=cache
    )

def _build_auth_url():
    return _build_msal_app().get_authorization_request_url(
        scopes=app.config["SCOPE"],
        state=str(uuid.uuid4()),
        redirect_uri=app.config["REDIRECT_URI"]
    )

@app.route('/login')
def login():
    return redirect(_build_auth_url())

@app.route(app.config["REDIRECT_PATH"])
def authorized():
    cache = msal.SerializableTokenCache()
    msal_app = _build_msal_app(cache)

    result = msal_app.acquire_token_by_authorization_code(
        request.args["code"],
        scopes=app.config["SCOPE"],
        redirect_uri=app.config["REDIRECT_URI"]
    )

    if "access_token" in result:
        session["user"] = requests.get(
            app.config["ENDPOINT"],
            headers={"Authorization": "Bearer " + result["access_token"]},
        ).json()

    return redirect(url_for("participate"))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        f"{app.config['AUTHORITY']}/oauth2/v2.0/logout"
        f"?post_logout_redirect_uri={url_for('index', _external=True)}"
    )





@app.route('/')
def index():
    return render_template('index.html')

@app.route('/teilnehmen')
def participate():
    if "user" not in session:
        return redirect(url_for("login"))
    user = session.get("user")
    return render_template('teilnehmen.html', user=user)

@app.route('/planen')
def plan():
    if "user" not in session:
        return redirect(url_for("login"))
    user = session.get("user")
    if not can_plan(user):
        return render_template('teilnehmen.html', user=user)
    return render_template('planen.html', user=user)

@app.route('/api/events', methods=['POST'])
def api_create_event():
    data = request.get_json()
    event = create_event(data["eventName"])
    return jsonify(event), 201

@app.route('/api/events', methods=['GET'])
def api_get_events():
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = user.get("id")
    events = get_events(user_id)
    return jsonify(events), 200

if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)
