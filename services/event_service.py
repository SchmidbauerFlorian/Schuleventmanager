from datetime import datetime
from db import queries


def _format_stats(stats_row: dict) -> dict:
    """Maps DB statistics row to the JS-expected statistics object."""
    input_fields       = int(stats_row.get('cnt_input_fields')        or 0)
    input_filled       = int(stats_row.get('cnt_input_fields_filled') or 0)
    required           = int(stats_row.get('cnt_required')            or 0)
    required_missing   = int(stats_row.get('cnt_required_missing')    or 0)
    ressources         = int(stats_row.get('cnt_ressources')          or 0)
    return {
        "ressources":        ressources,
        "people":            0,
        "lists":             0,
        "informations":      0,
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
        "people":             0,
        "lists":              0,
        "informations":       0,
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


def delete_event(event_name: str) -> dict:
    queries.delete_event_by_name(event_name)
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return {"current_event": None, "all_events": []}
    return _build_aggregate_response(all_stats)


def create_event(event_name: str) -> dict:
    new_id = queries.create_event_by_name(event_name, event_name)
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return {"current_event": None, "all_events": []}
    return _build_single_event_response(all_stats, new_id)


def get_event(event_id: int) -> dict:
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return {"current_event": None, "all_events": []}
    return _build_single_event_response(all_stats, event_id)


def get_events(user_id) -> dict:
    all_stats = queries.fetch_all_events()
    if not all_stats:
        return {"current_event": None, "all_events": []}
    return _build_aggregate_response(all_stats)
