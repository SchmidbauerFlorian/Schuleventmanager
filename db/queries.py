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

# create_entity_with_attributes (entity_type TEXT, attribute_names TEXT, p_datatypes TEXT, p_is_event BOOL, p_is_required_flags TEXT)
# create_entity_instance        (p_entity_type TEXT, p_attribute_names TEXT, p_values TEXT)
def create_event_by_name(eventtype: str, name: str) -> int:
    """Creates a new event entity type + instance. Returns the new entity_instance_id."""
    import datetime
    conn = get_connection()
    cur = conn.cursor()
    # Erstellt Entity-Typ + Attribute
    cur.execute("CALL create_entity_with_attributes(?, ?, ?, true, ?)", (eventtype, "name,created_at", "VARCHAR,TIMESTAMP", "1,0"))
    # Instanziierung des Entity-Typs
    values_str = f"{name},{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    cur.execute("CALL create_entity_instance(?, ?, ?)", (eventtype, "name,created_at", values_str))
    conn.commit()
    # Retrieve the newly created instance_id by matching event name
    cur2 = conn.cursor()
    cur2.execute("""
        SELECT v.entity_instance_id
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        JOIN t_entity e ON a.fk_entity_id = e.entity_id
        WHERE e.isEvent = TRUE
          AND LOWER(a.attribute_name) = 'name'
          AND v.value = ?
        ORDER BY v.entity_instance_id DESC
        LIMIT 1
    """, (name,))
    row = cur2.fetchone()
    conn.close()
    return row[0] if row else None

#  delete_entity_type (p_entity_type TEXT) — cascades attributes + values
def delete_event_by_name(event_type: str) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL delete_entity_type(?)", (event_type,))
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

def get_event_instance_attributes(event_instance_id: int) -> dict:
    """Returns {attribute_name: value} dict for a specific event instance."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("CALL get_entity_instance_by_id(?, true)", (event_instance_id,))
    rows = cur.fetchall()
    conn.close()
    return {row['attribute_name']: row['value'] for row in rows}

def get_event_stats_single(event_instance_id: int) -> dict:
    """Returns the statistics row for a single event instance."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("CALL get_event_attribute_statistics(?)", (event_instance_id,))
    rows = cur.fetchall()
    conn.close()
    return rows[0] if rows else {}

def create_attribute(entity_type: str, attribute_name: str, datatype: str, is_event: bool = False):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL create_attribute(?, ?, ?, ?)", (entity_type, attribute_name, datatype, is_event))
    conn.commit()
    conn.close()

def delete_attribute(entity_type: str, attribute_name: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL delete_attribute(?, ?)", (entity_type, attribute_name))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected

def update_attribute(entity_type: str, old_attribute_name: str, new_attribute_name: str, new_datatype: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL update_attribute(?, ?, ?, ?)", (entity_type, old_attribute_name, new_attribute_name, new_datatype))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected

def create_entity_instance(entity_type: str, attribute_names: str, values: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL create_entity_instance(?, ?, ?)", (entity_type, attribute_names, values))
    conn.commit()
    conn.close()

def update_entity_instance(instance_id: int, attribute_names: str, new_values: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL update_entity_instance(?, ?, ?)", (instance_id, attribute_names, new_values))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected

def delete_entity_instance(instance_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("CALL delete_entity_instance(?)", (instance_id,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected