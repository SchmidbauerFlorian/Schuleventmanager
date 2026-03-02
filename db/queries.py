from db.connection import get_connection

# Format: (instance_id, attribute_name, value)
def fetch_all_events():     
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    #                          ('' -> entity_type, true -> isEvent)
    cur.execute("CALL get_entity_instances('', true)") 
    rows = cur.fetchall()
    conn.close()
    return rows

# create_entity_with_attributes (entity_type TEXT, attribute_names TEXT, p_datatypes TEXT, p_is_event BOOL)
# create_entity_instance        (p_entity_type TEXT, attribute_names TEXT, p_values TEXT)
def create_event_by_name(eventtype: str, name: str):
    conn = get_connection()
    cur = conn.cursor()
    # Erstellt Entity-Typ + Attribte - woher kommte entity_type?
    cur.execute("CALL create_entity_with_attributes(?, ?, ?, true)", (eventtype, "name, created_at", "VARCHAR(255), DATETIME",))
    # Instanziierung des Entity-Typs
    cur.execute("CALL create_entity_instance(?, 'name, created_at', ?)", (eventtype, [name, "NOW()"]))
    conn.commit()
    event_id = cur.lastrowid
    conn.close()
    return event_id

#  delete_entity_instance (p_instance_id INT)
def delete_event_by_name(id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL delete_entity_instance(?)", (id))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected

def create_selected_from_users_table(filter_class: str, filter_name: str):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("CALL create_entity_instances_from_users(?, ?)", (filter_class, filter_name))
    rows = cur.fetchall()
    conn.close()
    return rows