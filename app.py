from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from services.event_service import (create_event, delete_event, get_events, get_event,
                                     create_resource as svc_create_resource,
                                     create_event_attribute, get_tree_data,
                                     get_entity_types_for_event, get_entity_attrs,
                                     link_entity_to_event, get_unlinked_entities,
                                     add_list_entry as svc_add_list_entry,
                                     update_instance_value as svc_update_instance_value,
                                     get_entity_instances as svc_get_entity_instances,
                                     get_reference_values as svc_get_reference_values,
                                     rename_resource as svc_rename_resource,
                                     delete_resource as svc_delete_resource,
                                     rename_attribute as svc_rename_attribute,
                                     delete_attribute_from_resource as svc_delete_attribute,
                                     delete_list_entry as svc_delete_list_entry,
                                     add_entity_attribute as svc_add_entity_attribute,
                                     get_relation_attrs as svc_get_relation_attrs,
                                     add_local_attribute as svc_add_local_attribute,
                                     update_cardinality as svc_update_cardinality,
                                     get_users as svc_get_users,
                                     get_user_classes as svc_get_user_classes,
                                     add_persons_from_users as svc_add_persons_from_users,
                                     get_my_events as svc_get_my_events,
                                     get_participant_tree as svc_get_participant_tree)
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
    user_ids = data.get('userIds', [])
    class_groups = data.get('classGroups', [])
    event_id = data.get('eventInstanceId')
    if not resource_name or not event_id:
        return jsonify({"error": "Missing resourceName or eventInstanceId"}), 400
    result = svc_create_resource(resource_name, user_ids, class_groups, event_id)
    return jsonify(result), 200


@app.route('/api/attributes', methods=['POST'])
def api_create_attribute():
    data = request.get_json()
    attr_type = data.get('type')
    event_id = data.get('eventInstanceId')
    try:
        result = create_event_attribute(attr_type, data, event_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/resources/<int:event_id>/tree', methods=['GET'])
def api_get_tree(event_id):
    tree = get_tree_data(event_id)
    return jsonify(tree), 200


@app.route('/api/entity-types', methods=['GET'])
def api_get_entity_types():
    event_id = request.args.get('eventId', type=int)
    detailed = request.args.get('detailed', type=int, default=0)
    if detailed:
        from services.event_service import get_entity_types_detailed
        types = get_entity_types_detailed(event_id)
    else:
        types = get_entity_types_for_event(event_id)
    return jsonify(types), 200


@app.route('/api/entity-attributes/<int:entity_id>', methods=['GET'])
def api_get_entity_attributes(entity_id):
    attrs = get_entity_attrs(entity_id)
    return jsonify(attrs), 200


@app.route('/api/resources/link', methods=['POST'])
def api_link_entity():
    data = request.get_json()
    entity_id = data.get('entityId')
    event_id = data.get('eventInstanceId')
    if not entity_id or not event_id:
        return jsonify({"error": "Missing entityId or eventInstanceId"}), 400
    result = link_entity_to_event(entity_id, event_id)
    return jsonify(result), 200


@app.route('/api/unlinked-entities', methods=['GET'])
def api_get_unlinked_entities():
    event_id = request.args.get('eventId', type=int)
    if not event_id:
        return jsonify([]), 200
    entities = get_unlinked_entities(event_id)
    return jsonify(entities), 200


@app.route('/api/list-entry', methods=['POST'])
def api_add_list_entry():
    data = request.get_json()
    entity_id = data.get('entityId')
    event_id = data.get('eventInstanceId')
    values = data.get('values', {})
    if not entity_id or not event_id:
        return jsonify({"error": "Missing entityId or eventInstanceId"}), 400
    try:
        result = svc_add_list_entry(entity_id, event_id, values)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/update-instance-value', methods=['PUT'])
def api_update_instance_value():
    data = request.get_json()
    instance_id = data.get('instanceId')
    attr_name = data.get('attributeName')
    value = data.get('value')
    source = data.get('source', 'entity')
    relation_id = data.get('relationId')
    rel_instance_id = data.get('relInstanceId')
    if not instance_id or not attr_name:
        return jsonify({"error": "Missing instanceId or attributeName"}), 400
    result = svc_update_instance_value(instance_id, attr_name, value,
                                       source, relation_id, rel_instance_id)
    return jsonify(result), 200


@app.route('/api/entity-instances/<int:entity_id>', methods=['GET'])
def api_get_entity_instances(entity_id):
    instances = svc_get_entity_instances(entity_id)
    return jsonify(instances), 200


@app.route('/api/reference-values/<int:entity_id>/<attribute_name>', methods=['GET'])
def api_get_reference_values(entity_id, attribute_name):
    event_id = request.args.get('eventId', type=int)
    values = svc_get_reference_values(entity_id, attribute_name, event_id)
    return jsonify(values), 200


@app.route('/api/resources/rename', methods=['PUT'])
def api_rename_resource():
    data = request.get_json()
    entity_id = data.get('entityId')
    new_name = data.get('newName')
    if not entity_id or not new_name:
        return jsonify({"error": "Missing entityId or newName"}), 400
    try:
        result = svc_rename_resource(entity_id, new_name)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/resources/delete', methods=['DELETE'])
def api_delete_resource():
    data = request.get_json()
    entity_id = data.get('entityId')
    event_id = data.get('eventInstanceId')
    if not entity_id or not event_id:
        return jsonify({"error": "Missing entityId or eventInstanceId"}), 400
    try:
        result = svc_delete_resource(entity_id, event_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/attributes/rename', methods=['PUT'])
def api_rename_attribute():
    data = request.get_json()
    entity_id = data.get('entityId')
    old_name = data.get('oldName')
    new_name = data.get('newName')
    source = data.get('source', 'entity')
    relation_id = data.get('relationId')
    access = data.get('access')
    if not old_name or not new_name:
        return jsonify({"error": "Missing oldName or newName"}), 400
    try:
        result = svc_rename_attribute(entity_id, old_name, new_name, source, relation_id, access)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/attributes/delete', methods=['DELETE'])
def api_delete_attribute():
    data = request.get_json()
    entity_id = data.get('entityId')
    attr_name = data.get('attributeName')
    source = data.get('source', 'entity')
    relation_id = data.get('relationId')
    relation_name = data.get('relationName')
    event_instance_id = data.get('eventInstanceId')
    if not attr_name:
        return jsonify({"error": "Missing attributeName"}), 400
    try:
        result = svc_delete_attribute(entity_id, attr_name, source, relation_id,
                                      relation_name, event_instance_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/list-entry', methods=['DELETE'])
def api_delete_list_entry():
    data = request.get_json()
    instance_id = data.get('instanceId')
    rel_instance_id = data.get('relInstanceId')
    if not instance_id:
        return jsonify({"error": "Missing instanceId"}), 400
    try:
        result = svc_delete_list_entry(instance_id, rel_instance_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/entity-attributes', methods=['POST'])
def api_add_entity_attribute():
    data = request.get_json()
    entity_id = data.get('entityId')
    attr_name = data.get('attributeName')
    datatype = data.get('datatype', 'VARCHAR')
    if not entity_id or not attr_name:
        return jsonify({"error": "Missing entityId or attributeName"}), 400
    try:
        result = svc_add_entity_attribute(entity_id, attr_name, datatype)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/relation-attributes/<int:entity_id>', methods=['GET'])
def api_get_relation_attributes(entity_id):
    event_id = request.args.get('eventId', type=int)
    if not event_id:
        return jsonify([]), 200
    attrs = svc_get_relation_attrs(entity_id, event_id)
    return jsonify(attrs), 200


@app.route('/api/relation-attributes', methods=['POST'])
def api_add_relation_attribute():
    data = request.get_json()
    entity_id = data.get('entityId')
    event_id = data.get('eventInstanceId')
    attr_name = data.get('attributeName')
    datatype = data.get('datatype', 'Text')
    if not entity_id or not event_id or not attr_name:
        return jsonify({"error": "Missing entityId, eventInstanceId or attributeName"}), 400
    try:
        result = svc_add_local_attribute(entity_id, event_id, attr_name, datatype)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/cardinality', methods=['PUT'])
def api_update_cardinality():
    data = request.get_json()
    participant_id = data.get('participantId')
    card_min = data.get('cardMin', 0)
    card_max = data.get('cardMax')  # None = unlimited
    if not participant_id:
        return jsonify({"error": "Missing participantId"}), 400
    if card_min is not None and card_min < 0:
        return jsonify({"error": "cardMin must be >= 0"}), 400
    if card_max is not None and card_max < card_min:
        return jsonify({"error": "cardMax must be >= cardMin"}), 400
    try:
        result = svc_update_cardinality(participant_id, card_min, card_max)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/users', methods=['GET'])
def api_get_users():
    q = request.args.get('q', None)
    try:
        users = svc_get_users(q)
        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/user-classes', methods=['GET'])
def api_get_user_classes():
    try:
        classes = svc_get_user_classes()
        return jsonify(classes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/add-persons', methods=['POST'])
def api_add_persons():
    data = request.get_json()
    entity_id = data.get('entityId')
    event_instance_id = data.get('eventInstanceId')
    filter_class = data.get('filterClass')
    filter_name = data.get('filterName')
    if not entity_id or not event_instance_id:
        return jsonify({"error": "Missing entityId or eventInstanceId"}), 400
    try:
        result = svc_add_persons_from_users(entity_id, event_instance_id, filter_class, filter_name)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/my-events', methods=['GET'])
def api_my_events():
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    email = user.get("mail") or user.get("userPrincipalName", "")
    selected_event_raw = request.args.get("eventId")
    selected_event = None
    if selected_event_raw:
        if selected_event_raw.lower() == "all":
            selected_event = "all"
        else:
            try:
                selected_event = int(selected_event_raw)
            except ValueError:
                return jsonify({"error": "Invalid eventId"}), 400

    events = svc_get_my_events(email, selected_event)
    return jsonify(events), 200


@app.route('/api/resources/<int:event_id>/participant-tree', methods=['GET'])
def api_get_participant_tree(event_id):
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    email = user.get("mail") or user.get("userPrincipalName", "")
    tree = svc_get_participant_tree(event_id, email)
    return jsonify(tree), 200


if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)
