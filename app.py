from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from services.event_service import (create_event, delete_event, get_events, get_event,
                                     create_resource as svc_create_resource,
                                     create_event_attribute, get_tree_data,
                                     get_entity_types_for_event, get_entity_attrs,
                                     link_entity_to_event, get_unlinked_entities)
from services.permission_service import can_plan
import os, msal, uuid, requests
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
    events = create_event(data["eventName"])
    return jsonify(events), 200

@app.route('/api/events/<int:event_id>', methods=['GET'])
def api_get_event(event_id):
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    events = get_event(event_id)
    return jsonify(events), 200

@app.route('/api/events', methods=['GET'])
def api_get_events():
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = user.get("id")
    events = get_events(user_id)
    return jsonify(events), 200

@app.route('/api/events', methods=['DELETE'])
def api_delete_event():
    data = request.get_json()
    event = delete_event(data["eventName"])
    return jsonify(event), 200


@app.route('/api/resources', methods=['POST'])
def api_create_resource():
    data = request.get_json()
    resource_name = data.get('resourceName')
    groups = data.get('groups', [])
    event_id = data.get('eventInstanceId')
    if not resource_name or not event_id:
        return jsonify({"error": "Missing resourceName or eventInstanceId"}), 400
    result = svc_create_resource(resource_name, groups, event_id)
    return jsonify(result), 200


@app.route('/api/attributes', methods=['POST'])
def api_create_attribute():
    data = request.get_json()
    attr_type = data.get('type')
    event_id = data.get('eventInstanceId')
    result = create_event_attribute(attr_type, data, event_id)
    return jsonify(result), 200


@app.route('/api/resources/<int:event_id>/tree', methods=['GET'])
def api_get_tree(event_id):
    tree = get_tree_data(event_id)
    return jsonify(tree), 200


@app.route('/api/entity-types', methods=['GET'])
def api_get_entity_types():
    event_id = request.args.get('eventId', type=int)
    types = get_entity_types_for_event(event_id)
    return jsonify(types), 200


@app.route('/api/entity-attributes/<entity_type>', methods=['GET'])
def api_get_entity_attributes(entity_type):
    attrs = get_entity_attrs(entity_type)
    return jsonify(attrs), 200


@app.route('/api/resources/link', methods=['POST'])
def api_link_entity():
    data = request.get_json()
    entity_type = data.get('entityType')
    event_id = data.get('eventInstanceId')
    if not entity_type or not event_id:
        return jsonify({"error": "Missing entityType or eventInstanceId"}), 400
    result = link_entity_to_event(entity_type, event_id)
    return jsonify(result), 200


@app.route('/api/unlinked-entities', methods=['GET'])
def api_get_unlinked_entities():
    event_id = request.args.get('eventId', type=int)
    if not event_id:
        return jsonify([]), 200
    entities = get_unlinked_entities(event_id)
    return jsonify(entities), 200


if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)
