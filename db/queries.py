from db.connection import get_connection

# Format: (instance_id, attribute_name, value)
def fetch_all_events():     
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    #                          ('' -> entity_type, true -> isEvent)
    cur.execute("CALL get_entity_instances('', true)") 
    cur.execute("CALL get_event_attribute_statistics(null)")
    rows = cur.fetchall()
    conn.close()
    return rows

# create_entity_with_attributes (entity_type TEXT, attribute_names TEXT, p_datatypes TEXT, p_is_event BOOL)
# create_entity_instance        (p_entity_type TEXT, p_attribute_names TEXT, p_values TEXT)
def create_event_by_name(eventtype: str, name: str):
    import datetime
    conn = get_connection()
    cur = conn.cursor()
    # Erstellt Entity-Typ + Attribute
    cur.execute("CALL create_entity_with_attributes(?, ?, ?, true)", (eventtype, "name,created_at", "VARCHAR,TIMESTAMP"))
    # Instanziierung des Entity-Typs (3 IN-Parameter, kein OUT)
    values_str = f"{name},{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    cur.execute("CALL create_entity_instance(?, ?, ?)", (eventtype, "name,created_at", values_str))
    conn.commit()
    conn.close()

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

#   get_entity_instance_by_id(IN p_entity_instance_id INT, IN p_isEvent BOOLEAN)
def get_entity_instance_by_id(id: int, is_event: bool = True):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("CALL get_entity_instance_by_id(?,?)", (id, is_event))
    cur.execute("CALL get_event_attribute_statistics(?)", (id,))
    rows = cur.fetchall()
    conn.close()
    return rows