from datetime import datetime
from db import queries

def delete_event(event_name):
    return "Event '{}' deleted successfully".format(event_name)


def create_event(event_name):
    queries.create_event_by_name(event_name, event_name)
    return "Event '{}' created successfully".format(event_name)


def get_events(user_id):
    events = queries.fetch_all_events()

    event = {
    "_debug_fetch_all_events": events,
    "current_event": {
        "id": 1,
        "name": "Wintersportwoche",
        "created_at" : datetime.now().strftime("%d.%m.%Y"),
        "duration" : "20.03 - 27.03",
        "messages" : [
            {"type": "email", "title": "Wintersportwoche - Planung", "date": "08.01"},
            {"type": "popup", "title": "Bitte persönliche Informationen eintragen!", "date": "12.01"},
            {"type": "popup", "title": "Fehlende Informationen eintragen mit FRIST!!!", "date": "18.01"}
        ],
        "statistics": {
            "ressources": 1000, 
            "people": 400, 
            "lists": 550,
            "informations" : 50,
            "input-fields" : 50,
            "input-remaining" : 40,
            "required-fields" : 30,
            "required-remaining" : 30
        }
    },
    "all_events": [
        {"id": 2, "name": "Wintersportwoche"},
        {"id": 3, "name": "Sommersportwoche"},
        {"id": 4, "name": "Wandertag 5AHIT"}
    ]
    }

    return event
