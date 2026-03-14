from datetime import datetime
from db import queries


def _format_stats(stats_row: dict) -> dict:
    """Maps DB statistics row to the JS-expected statistics object."""
    input_fields       = int(stats_row.get('cnt_input_fields')        or 0)
    input_filled       = int(stats_row.get('cnt_input_fields_filled') or 0)
    required           = int(stats_row.get('cnt_required')            or 0)
    required_missing   = int(stats_row.get('cnt_required_missing')    or 0)
    ressources         = int(stats_row.get('cnt_ressources')          or 0)
    people             = int(stats_row.get('cnt_person_ressources')   or 0)
    lists              = int(stats_row.get('cnt_list_ressources')     or 0)
    singular           = int(stats_row.get('cnt_singular_ressources') or 0)
    return {
        "ressources":        ressources,
        "people":            people,
        "lists":             lists,
        "informations":      singular,
        "input-fields":      input_fields,
        "input-remaining":   input_fields - input_filled,
        "required-fields":   required,
        "required-remaining": required_missing,
    }


def _format_current_event(stats_row: dict, attrs: dict) -> dict:
    """Builds the current_event object from a stats row + attribute dict."""
    created_at = ""
    raw = attrs.get('created_at')
    if raw:
        try:
            created_at = datetime.strptime(str(raw), '%Y-%m-%d %H:%M:%S').strftime('%d.%m.%Y')
        except ValueError:
            created_at = str(raw)
    return {
        "id":         stats_row.get('event_instance_id'),
        "name":       stats_row.get('event_name', ''),
        "created_at": created_at,
        "duration":   "",
        "messages":   [],
        "statistics": _format_stats(stats_row),
    }


def _sum_stats(all_stats: list) -> dict:
    """Sums statistics across all event rows into one aggregate stats dict."""
    def _i(row, key): return int(row.get(key) or 0)
    return {
        "ressources":         sum(_i(r, 'cnt_ressources')          for r in all_stats),
        "people":             sum(_i(r, 'cnt_person_ressources')   for r in all_stats),
        "lists":              sum(_i(r, 'cnt_list_ressources')     for r in all_stats),
        "informations":       sum(_i(r, 'cnt_singular_ressources') for r in all_stats),
        "input-fields":       sum(_i(r, 'cnt_input_fields')        for r in all_stats),
        "input-remaining":    sum(_i(r, 'cnt_input_fields')        for r in all_stats)
                            - sum(_i(r, 'cnt_input_fields_filled') for r in all_stats),
        "required-fields":    sum(_i(r, 'cnt_required')            for r in all_stats),
        "required-remaining": sum(_i(r, 'cnt_required_missing')    for r in all_stats),
    }


def _build_aggregate_response(all_stats: list) -> dict:
    """Builds a response where current_event shows summed stats across all events."""
    all_events = [{"id": None, "name": "Alle Events"}] + [
        {"id": row['event_instance_id'], "name": row['event_name']}
        for row in all_stats
    ]
    current_event = {
        "id":         None,
        "name":       "Alle Events",
        "created_at": "",
        "duration":   "",
        "messages":   [],
        "statistics": _sum_stats(all_stats),
    }
    return {"current_event": current_event, "all_events": all_events}


def _build_single_event_response(all_stats: list, current_id: int) -> dict:
    """Builds a response with a specific event as current_event."""
    all_events = [{"id": None, "name": "Alle Events"}] + [
        {"id": row['event_instance_id'], "name": row['event_name']}
        for row in all_stats
    ]
    current_row = next(
        (r for r in all_stats if r['event_instance_id'] == current_id),
        all_stats[0]
    )
    attrs = queries.get_event_instance_attributes(current_row['event_instance_id'])
    current_event = _format_current_event(current_row, attrs)
    return {"current_event": current_event, "all_events": all_events}


def _build_empty_response() -> dict:
    """Builds a response for the case where no events exist."""
    current_event = {
        "id": None,
        "name": "Alle Events",
        "created_at": "",
        "duration": "",
        "messages": [],
        "statistics": _sum_stats([]),
    }
    return {
        "current_event": current_event,
        "all_events": [{"id": None, "name": "Alle Events"}],
    }


def delete_event(event_name: str) -> dict:
    queries.delete_event_by_name(event_name)
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return _build_empty_response()
    return _build_aggregate_response(all_stats)


def create_event(event_name: str) -> dict:
    new_id = queries.create_event_by_name(event_name, event_name)
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return _build_empty_response()
    return _build_single_event_response(all_stats, new_id)


def get_event(event_id: int) -> dict:
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return _build_empty_response()
    return _build_single_event_response(all_stats, event_id)


def get_events(user_id) -> dict:
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return _build_empty_response()
    return _build_aggregate_response(all_stats)


# =========================================================================
# Resource & Attribute Management
# =========================================================================

def create_resource(resource_name: str, user_ids: list, class_groups: list, event_instance_id: int) -> dict:
    rel_id = queries.create_resource_for_event(resource_name, user_ids, class_groups, event_instance_id)
    return {"status": "ok", "relation_id": rel_id}


def create_event_attribute(attr_type: str, data: dict, event_instance_id: int) -> dict:
    if attr_type == "api":
        queries.add_api_attribute_to_resource(
            data.get('entityId'), data.get('field'), event_instance_id,
            access=data.get('permission', 'read'))
        return {"status": "ok"}
    elif attr_type == "ressource":
        rel_id = queries.add_dependent_resource_attribute(
            data.get('targetEntityId'), event_instance_id,
            data.get('sourceEntityId'), data.get('sourceAttribute'))
        return {"status": "ok", "relation_id": rel_id}
    elif attr_type == "eingabe":
        rel_id = queries.add_input_attribute_to_event_relation(
            data.get('entityId'), event_instance_id,
            data.get('attributeName'), data.get('datatype', 'Text'),
            data.get('isRequired', False), data.get('expirationDate'),
            access=data.get('permission', 'read'))
        return {"status": "ok", "relation_id": rel_id}
    return {"status": "error", "message": "Unknown type"}


def get_tree_data(event_instance_id: int) -> list:
    return queries.get_event_tree_data(event_instance_id)


def get_entity_types_for_event(event_instance_id) -> list:
    return queries.get_event_entity_types(event_instance_id)


def get_entity_types_detailed(event_instance_id) -> list:
    return queries.get_event_entity_types_detailed(event_instance_id)


def get_entity_attrs(entity_id: int) -> list:
    return queries.get_entity_type_attributes_list(entity_id)


def link_entity_to_event(entity_id: int, event_instance_id: int) -> dict:
    rel_id = queries.link_existing_entity_to_event(entity_id, event_instance_id)
    return {"status": "ok", "relation_id": rel_id}


def get_unlinked_entities(event_instance_id: int) -> list:
    return queries.get_unlinked_entity_types(event_instance_id)


def add_list_entry(entity_id: int, event_instance_id: int, values: dict) -> dict:
    # Enforce cardinality max
    card_max = queries.get_cardinality_for_entity_in_event(entity_id, event_instance_id)
    if card_max is not None:
        current_count = queries.get_relation_instance_count(entity_id, event_instance_id)
        if current_count >= card_max:
            raise ValueError(
                f"Kardinalität überschritten: Maximal {card_max} Einträge erlaubt ({current_count} vorhanden)."
            )
    instance_id = queries.add_list_entry(entity_id, event_instance_id, values)
    return {"status": "ok", "instance_id": instance_id}


def update_instance_value(instance_id: int, attribute_name: str, value: str,
                          source: str = 'entity', relation_id: int = None,
                          rel_instance_id: int = None) -> dict:
    if source == 'relation' and relation_id and rel_instance_id:
        queries.update_relation_instance_value(relation_id, rel_instance_id,
                                               attribute_name, value)
    else:
        queries.update_entity_instance(instance_id, attribute_name, value)
    return {"status": "ok"}


def get_entity_instances(entity_id: int) -> list:
    return queries.get_entity_instances(entity_id)


def get_reference_values(entity_id: int, attribute_name: str, event_instance_id: int) -> list:
    return queries.get_reference_values(entity_id, attribute_name, event_instance_id)


def rename_resource(entity_id: int, new_name: str) -> dict:
    queries.rename_entity_type(entity_id, new_name)
    return {"status": "ok"}


def delete_resource(entity_id: int, event_instance_id: int) -> dict:
    queries.delete_resource_from_event(entity_id, event_instance_id)
    return {"status": "ok"}


def rename_attribute(entity_id: int, old_name: str, new_name: str,
                     source: str = 'entity', relation_id: int = None,
                     access: str = None) -> dict:
    if source == 'relation' and relation_id:
        queries.update_relation_attribute_name(relation_id, old_name, new_name, access)
    else:
        # For entity attributes, keep the same datatype
        attrs = queries.get_entity_type_attributes_list(entity_id)
        datatype = 'VARCHAR'
        for a in attrs:
            if a['attribute_name'] == old_name:
                datatype = a['datatype']
                break
        queries.update_attribute(entity_id, old_name, new_name, datatype)
    return {"status": "ok"}


def delete_attribute_from_resource(entity_id: int, attr_name: str,
                                   source: str = 'entity', relation_id: int = None,
                                   relation_name: str = None,
                                   event_instance_id: int = None) -> dict:
    if source == 'relation' and relation_id:
        queries.delete_relation_attribute(relation_id, attr_name)
    elif source == 'local' and event_instance_id:
        rid = queries.get_relation_id_for_event_entity(event_instance_id, entity_id)
        if rid:
            queries.delete_relation_attribute(rid, attr_name)
    elif source == 'relation_by_name' and relation_name:
        rid = queries.get_relation_id_by_name(relation_name)
        if rid:
            queries.delete_relation_attribute(rid, attr_name)
    else:
        queries.delete_attribute(entity_id, attr_name)
    return {"status": "ok"}


def delete_list_entry(instance_id: int, rel_instance_id: int = None) -> dict:
    queries.delete_list_entry(instance_id, rel_instance_id)
    return {"status": "ok"}


def add_entity_attribute(entity_id: int, attribute_name: str, datatype: str) -> dict:
    queries.create_attribute(entity_id, attribute_name, datatype)
    return {"status": "ok"}


def get_relation_attrs(entity_id: int, event_instance_id: int) -> list:
    return queries.get_relation_attributes_for_entity(entity_id, event_instance_id)


def add_local_attribute(entity_id: int, event_instance_id: int, attribute_name: str, datatype: str) -> dict:
    rel_id = queries.add_input_attribute_to_event_relation(
        entity_id, event_instance_id, attribute_name, datatype, False, None)
    return {"status": "ok", "relation_id": rel_id}


def update_cardinality(participant_id: int, card_min: int, card_max) -> dict:
    queries.update_cardinality(participant_id, card_min, card_max)
    return {"status": "ok"}


def get_users(query: str = None) -> list:
    return queries.get_users(query)


def get_user_classes() -> list:
    return queries.get_user_classes()


def add_persons_from_users(entity_id: int, event_instance_id: int,
                           filter_class: str = None, filter_name: str = None) -> dict:
    queries.create_selected_from_users_table(filter_class, filter_name)
    return {"status": "ok"}


# =========================================================================
# Participant View (Teilnehmen)
# =========================================================================

def get_user_id_by_email(email: str):
    return queries.get_user_id_by_email(email)


def get_my_events(user_email: str, selected_event=None) -> dict:
    user_id = queries.get_user_id_by_email(user_email)
    if user_id is None:
        return {"current_event": None, "all_events": []}
    event_ids = queries.get_events_for_participant(user_id)
    if not event_ids:
        return {"current_event": None, "all_events": []}
    all_stats = queries.fetch_all_events()
    my_stats = [r for r in all_stats if r['event_instance_id'] in set(event_ids)]
    if not my_stats:
        return {"current_event": None, "all_events": []}

    all_events_list = [{"id": None, "name": "Alle Events"}] + [
        {"id": r['event_instance_id'], "name": r['event_name']} for r in my_stats
    ]

    if selected_event == "all" or selected_event is None:
        current_event = {
            "id": None,
            "name": "Alle Events",
            "created_at": "",
            "duration": "",
            "messages": [],
            "statistics": _sum_stats(my_stats),
        }
    elif isinstance(selected_event, int):
        current_row = next(
            (r for r in my_stats if r['event_instance_id'] == selected_event),
            my_stats[0]
        )
        attrs = queries.get_event_instance_attributes(current_row['event_instance_id'])
        current_event = _format_current_event(current_row, attrs)

    return {"current_event": current_event, "all_events": all_events_list}


def get_participant_tree(event_instance_id: int, user_email: str) -> list:
    user_id = queries.get_user_id_by_email(user_email)
    if user_id is None:
        return []
    return queries.get_participant_tree_data(event_instance_id, user_id)
