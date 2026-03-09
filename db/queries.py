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


# =========================================================================
# Resource & Attribute Management for Event Planning
# =========================================================================

def _drain(c):
    """Consume any remaining result sets left by a stored procedure."""
    try:
        while c.nextset():
            pass
    except Exception:
        pass


def _ensure_relation_participants(conn, rel_id, entity_type_a, entity_type_b):
    """Ensure both entity types are registered as participants of the relation.
    Checks for each entity type individually and adds missing ones."""
    for etype in (entity_type_a, entity_type_b):
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT COUNT(*) AS cnt FROM t_relation_participant rp
               JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE rp.fk_relation_id = ? AND e.entity_type = ?""",
            (rel_id, etype),
        )
        cnt = cur.fetchone()['cnt']
        cur.close()
        if cnt == 0:
            cur2 = conn.cursor(dictionary=True)
            cur2.execute("CALL add_relation_participant(?, ?, ?, ?)",
                         (rel_id, etype, 0, None))
            _drain(cur2)
            cur2.close()


def create_resource_for_event(resource_name: str, groups: list, event_instance_id: int):
    """Create entity type, import persons from groups, link to event via relation."""
    conn = get_connection()

    try:
        # 0. Look up the event's actual entity type
        cur0 = conn.cursor(dictionary=True)
        cur0.execute(
            """SELECT e.entity_type FROM t_values v
               JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE v.entity_instance_id = ? AND e.isEvent = TRUE
               LIMIT 1""",
            (event_instance_id,),
        )
        event_entity_row = cur0.fetchone()
        cur0.close()
        event_entity_type = event_entity_row['entity_type'] if event_entity_row else 'Event'

        # 1. Create entity type if not exists
        cur1 = conn.cursor(dictionary=True)
        cur1.execute("SELECT entity_id FROM t_entity WHERE entity_type = ?", (resource_name,))
        exists = cur1.fetchone()
        cur1.close()

        if not exists:
            cur1b = conn.cursor(dictionary=True)
            cur1b.execute(
                "CALL create_entity_with_attributes(?, ?, ?, FALSE, ?)",
                (resource_name, "", "", ""),
            )
            _drain(cur1b)
            cur1b.close()

        # Mark as person resource if groups were selected
        if groups:
            cur_p = conn.cursor()
            cur_p.execute(
                """UPDATE t_attribute SET isPersonRessource = TRUE
                   WHERE fk_entity_id = (SELECT entity_id FROM t_entity WHERE entity_type = ?)""",
                (resource_name,),
            )
            cur_p.close()

        # 3. Create / get relation between Event and this resource
        rel_name = f"event_{resource_name.lower()}"
        cur3 = conn.cursor(dictionary=True)
        cur3.execute(
            "CALL create_relation(?, ?, ?, @rel_id)",
            (rel_name, "m:n", f"Event linked to {resource_name}"),
        )
        _drain(cur3)
        cur3.close()

        cur3b = conn.cursor(dictionary=True)
        cur3b.execute("SELECT @rel_id AS rel_id")
        rel_id = cur3b.fetchone()['rel_id']
        cur3b.close()

        # 4. Add relation participants (ensure they exist)
        _ensure_relation_participants(conn, rel_id, event_entity_type, resource_name)

        # 5. Link event instance to all resource instances
        cur5 = conn.cursor(dictionary=True)
        cur5.execute(
            """SELECT v.value_id FROM t_values v
               JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE v.entity_instance_id = ? AND a.is_unique = TRUE AND e.isEvent = TRUE
               LIMIT 1""",
            (event_instance_id,),
        )
        ev_pk_row = cur5.fetchone()
        cur5.close()

        if ev_pk_row:
            ev_pk = ev_pk_row['value_id']

            cur5b = conn.cursor(dictionary=True)
            cur5b.execute(
                """SELECT v.value_id FROM t_values v
                   JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
                   JOIN t_entity e ON a.fk_entity_id = e.entity_id
                   WHERE e.entity_type = ? AND a.is_unique = TRUE""",
                (resource_name,),
            )
            res_pks = cur5b.fetchall()
            cur5b.close()

            cur5c = conn.cursor(dictionary=True)
            cur5c.execute(
                """SELECT rv2.fk_value_id FROM t_relation_values rv1
                   JOIN t_relation_values rv2
                     ON rv1.relation_instance_id = rv2.relation_instance_id
                     AND rv1.fk_relation_id = rv2.fk_relation_id
                   WHERE rv1.fk_relation_id = ?
                     AND rv1.fk_value_id = ?
                     AND rv2.fk_value_id != ?""",
                (rel_id, ev_pk, ev_pk),
            )
            already_linked = {r['fk_value_id'] for r in cur5c.fetchall()}
            cur5c.close()

            for rpk in res_pks:
                if rpk['value_id'] not in already_linked:
                    cur6 = conn.cursor(dictionary=True)
                    cur6.execute(
                        "CALL create_relation_instance(?, ?, @ri)",
                        (rel_id, f"{ev_pk},{rpk['value_id']}"),
                    )
                    _drain(cur6)
                    cur6.close()

        conn.commit()
        return rel_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def add_list_entry(entity_type: str, event_instance_id: int, values: dict) -> int:
    """Create a new entity instance and link it to the event."""
    conn = get_connection()
    try:
        # Build attribute_names and values strings from provided values
        attr_names = ",".join(values.keys()) if values else ""
        attr_values = ",".join(str(v) for v in values.values()) if values else ""

        # Create the instance
        cur1 = conn.cursor(dictionary=True)
        cur1.execute(
            "CALL create_entity_instance(?, ?, ?)",
            (entity_type, attr_names, attr_values),
        )
        _drain(cur1)
        cur1.close()

        # Get the newly created instance's PK value_id
        cur2 = conn.cursor(dictionary=True)
        cur2.execute(
            """SELECT v.value_id, v.entity_instance_id FROM t_values v
               JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE e.entity_type = ? AND a.is_unique = TRUE
               ORDER BY v.value_id DESC LIMIT 1""",
            (entity_type,),
        )
        new_pk_row = cur2.fetchone()
        cur2.close()

        if not new_pk_row:
            conn.commit()
            return None

        new_pk = new_pk_row['value_id']

        # Get event PK value_id
        cur3 = conn.cursor(dictionary=True)
        cur3.execute(
            """SELECT v.value_id FROM t_values v
               JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE v.entity_instance_id = ? AND a.is_unique = TRUE AND e.isEvent = TRUE
               LIMIT 1""",
            (event_instance_id,),
        )
        ev_pk_row = cur3.fetchone()
        cur3.close()

        if not ev_pk_row:
            conn.commit()
            return None

        ev_pk = ev_pk_row['value_id']

        # Get relation id
        rel_name = f"event_{entity_type.lower()}"
        cur4 = conn.cursor(dictionary=True)
        cur4.execute("SELECT relation_id FROM t_relation WHERE name = ?", (rel_name,))
        rel_row = cur4.fetchone()
        cur4.close()

        if rel_row:
            cur5 = conn.cursor(dictionary=True)
            cur5.execute(
                "CALL create_relation_instance(?, ?, @ri)",
                (rel_row['relation_id'], f"{ev_pk},{new_pk}"),
            )
            _drain(cur5)
            cur5.close()

        conn.commit()
        return new_pk_row['entity_instance_id']
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def add_api_attribute_to_resource(entity_type: str, attribute_name: str, datatype: str = 'VARCHAR', is_required: bool = False):
    """Add an attribute (from t_users info) to an entity type."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("CALL create_attribute(?, ?, ?, ?)", (entity_type, attribute_name, datatype, is_required))
        try:
            while cur.nextset():
                pass
        except Exception:
            pass
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def create_dependent_resource_relation(source_entity: str, target_entity: str):
    """Create a relation between two entity types."""
    conn = get_connection()
    rel_name = f"{source_entity.lower()}_{target_entity.lower()}"

    cur1 = conn.cursor(dictionary=True)
    cur1.execute(
        "CALL create_relation(?, ?, ?, @rel_id)",
        (rel_name, "m:n", f"{source_entity} linked to {target_entity}"),
    )
    try:
        while cur1.nextset():
            pass
    except Exception:
        pass
    cur1.close()

    cur2 = conn.cursor(dictionary=True)
    cur2.execute("SELECT @rel_id AS rel_id")
    rel_id = cur2.fetchone()['rel_id']
    cur2.close()

    _ensure_relation_participants(conn, rel_id, source_entity, target_entity)

    conn.commit()
    conn.close()
    return rel_id


def add_dependent_resource_attribute(target_entity: str, event_instance_id: int,
                                     source_entity: str, source_attribute: str):
    """Add a dependent resource attribute to the event-target relation.
    The attribute shows a dropdown of values from source_entity's source_attribute."""
    conn = get_connection()
    cur1 = conn.cursor(dictionary=True)

    rel_name = f"event_{target_entity.lower()}"
    cur1.execute("SELECT relation_id FROM t_relation WHERE name = ?", (rel_name,))
    rel_row = cur1.fetchone()
    cur1.close()
    if not rel_row:
        conn.close()
        raise ValueError(f"Relation '{rel_name}' not found")

    # Determine datatype from source attribute
    cur_dt = conn.cursor(dictionary=True)
    cur_dt.execute(
        """SELECT d.datatype FROM t_attribute a
           JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE e.entity_type = ? AND a.attribute_name = ?
           UNION
           SELECT d.datatype FROM t_attribute a
           JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
           JOIN t_relation_participant rp ON rp.fk_att_id = a.attribute_id
           JOIN t_relation r ON rp.fk_relation_id = r.relation_id
           WHERE r.name = ? AND a.attribute_name = ?
             AND a.fk_entity_id IS NULL AND rp.fk_att_id = rp.fk_att_id_rel
           LIMIT 1""",
        (source_entity, source_attribute,
         f"event_{source_entity.lower()}", source_attribute),
    )
    dt_row = cur_dt.fetchone()
    cur_dt.close()
    db_dtype = dt_row['datatype'] if dt_row else 'VARCHAR'

    cur2 = conn.cursor(dictionary=True)
    cur2.execute(
        "CALL add_relation_attribute(?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (rel_row['relation_id'], source_attribute, db_dtype, False, False, True,
         None, source_entity, source_attribute),
    )
    try:
        while cur2.nextset():
            pass
    except Exception:
        pass
    cur2.close()
    conn.commit()
    conn.close()
    return rel_row['relation_id']


def get_reference_values(entity_type: str, attribute_name: str, event_instance_id: int):
    """Get all values of a specific attribute from instances of an entity type linked to an event."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    # Get values from entity attributes
    cur.execute(
        """SELECT DISTINCT v.value
           FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE e.entity_type = ? AND a.attribute_name = ?
             AND v.value IS NOT NULL AND v.value != ''
           ORDER BY v.value""",
        (entity_type, attribute_name),
    )
    rows = cur.fetchall()
    if not rows:
        # Try relation attributes
        cur.execute(
            """SELECT DISTINCT v.value
               FROM t_relation_values rv
               JOIN t_values v ON rv.fk_value_id = v.value_id
               JOIN t_attribute a ON rv.fk_attribute_id = a.attribute_id
               JOIN t_relation r ON rv.fk_relation_id = r.relation_id
               WHERE r.name = ? AND a.attribute_name = ?
                 AND v.value IS NOT NULL AND v.value != ''
               ORDER BY v.value""",
            (f"event_{entity_type.lower()}", attribute_name),
        )
        rows = cur.fetchall()
    cur.close()
    conn.close()
    return [r['value'] for r in rows]


def add_input_attribute_to_event_relation(entity_type: str, event_instance_id: int,
                                          attr_name: str, datatype: str,
                                          is_required: bool, expiration_date: str):
    """Add an input field attribute to the relation between event and entity type."""
    conn = get_connection()
    cur1 = conn.cursor(dictionary=True)

    rel_name = f"event_{entity_type.lower()}"
    cur1.execute("SELECT relation_id FROM t_relation WHERE name = ?", (rel_name,))
    rel_row = cur1.fetchone()
    cur1.close()
    if not rel_row:
        conn.close()
        return None

    dtype_map = {"Text": "VARCHAR", "Zahl": "INTEGER", "Datum": "DATE", "JA/NEIN": "BOOLEAN"}
    db_dtype = dtype_map.get(datatype, datatype)

    cur2 = conn.cursor(dictionary=True)
    cur2.execute(
        "CALL add_relation_attribute(?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (rel_row['relation_id'], attr_name, db_dtype, True, is_required, False,
         expiration_date if expiration_date else None, None, None),
    )
    try:
        while cur2.nextset():
            pass
    except Exception:
        pass
    cur2.close()
    conn.commit()
    conn.close()
    return rel_row['relation_id']


def get_entity_instances(entity_type: str):
    """Get all instances of an entity type with their first non-PK attribute as label."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT DISTINCT v.entity_instance_id AS id, v.value AS label
           FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE e.entity_type = ? AND a.is_unique = FALSE
           ORDER BY v.entity_instance_id""",
        (entity_type,),
    )
    # Group by instance, take first non-null value as label
    instances = {}
    for row in cur.fetchall():
        iid = row['id']
        if iid not in instances:
            instances[iid] = {'id': iid, 'label': row['label'] or str(iid)}
    cur.close()
    conn.close()
    return list(instances.values())


def update_relation_instance_value(relation_id: int, rel_instance_id: int,
                                   attribute_name: str, value: str):
    """Create or update a relation attribute value for a specific relation instance."""
    conn = get_connection()
    try:
        # Find the attribute_id for this relation attribute
        cur1 = conn.cursor(dictionary=True)
        cur1.execute(
            """SELECT a.attribute_id
               FROM t_attribute a
               JOIN t_relation_participant rp ON rp.fk_att_id = a.attribute_id
               WHERE rp.fk_relation_id = ? AND a.attribute_name = ?
                 AND a.fk_entity_id IS NULL AND rp.fk_att_id = rp.fk_att_id_rel""",
            (relation_id, attribute_name),
        )
        attr_row = cur1.fetchone()
        cur1.close()
        if not attr_row:
            conn.close()
            return

        attr_id = attr_row['attribute_id']

        # Check if a t_relation_values entry already exists for this attribute + relation instance
        cur2 = conn.cursor(dictionary=True)
        cur2.execute(
            """SELECT rv.fk_value_id, v.value_id
               FROM t_relation_values rv
               JOIN t_values v ON rv.fk_value_id = v.value_id
               WHERE rv.fk_relation_id = ? AND rv.relation_instance_id = ?
                 AND rv.fk_attribute_id = ?""",
            (relation_id, rel_instance_id, attr_id),
        )
        existing = cur2.fetchone()
        cur2.close()

        if existing:
            # Update existing value
            cur3 = conn.cursor()
            cur3.execute("UPDATE t_values SET value = ? WHERE value_id = ?",
                         (value, existing['value_id']))
            cur3.close()
        else:
            # Create new t_values entry and link via t_relation_values
            cur3 = conn.cursor()
            cur3.execute(
                "INSERT INTO t_values(fk_attribute_id, value, entity_instance_id) VALUES (?, ?, NULL)",
                (attr_id, value),
            )
            new_value_id = cur3.lastrowid
            cur3.close()

            cur4 = conn.cursor()
            cur4.execute(
                """INSERT INTO t_relation_values(fk_relation_id, fk_attribute_id, fk_value_id, relation_instance_id)
                   VALUES (?, ?, ?, ?)""",
                (relation_id, attr_id, new_value_id, rel_instance_id),
            )
            cur4.close()

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_event_entity_types(event_instance_id):
    """Get non-event entity types linked to an event via relations."""
    conn = get_connection()

    if event_instance_id is None:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT entity_type FROM t_entity WHERE isEvent = FALSE")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [r['entity_type'] for r in rows]

    # 1. Entity types with actual relation instances (have data)
    cur1 = conn.cursor(dictionary=True)
    cur1.execute(
        """SELECT DISTINCT e2.entity_type
           FROM t_relation_values rv1
           JOIN t_values v1 ON rv1.fk_value_id = v1.value_id
           JOIN t_attribute a1 ON v1.fk_attribute_id = a1.attribute_id
           JOIN t_entity e1 ON a1.fk_entity_id = e1.entity_id
           JOIN t_relation_values rv2
             ON rv1.relation_instance_id = rv2.relation_instance_id
             AND rv1.fk_relation_id = rv2.fk_relation_id
           JOIN t_values v2 ON rv2.fk_value_id = v2.value_id
           JOIN t_attribute a2 ON v2.fk_attribute_id = a2.attribute_id
           JOIN t_entity e2 ON a2.fk_entity_id = e2.entity_id
           WHERE v1.entity_instance_id = ?
             AND e1.isEvent = TRUE
             AND e2.isEvent = FALSE""",
        (event_instance_id,),
    )
    types = {r['entity_type'] for r in cur1.fetchall()}
    cur1.close()

    # 2. Also find entity types via relation_participant structure
    #    (resources linked to this event's entity type, even without instances)
    cur2 = conn.cursor(dictionary=True)
    cur2.execute(
        """SELECT e.entity_type FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE v.entity_instance_id = ? AND e.isEvent = TRUE
           LIMIT 1""",
        (event_instance_id,),
    )
    ev_type_row = cur2.fetchone()
    cur2.close()

    if ev_type_row:
        cur3 = conn.cursor(dictionary=True)
        cur3.execute(
            """SELECT DISTINCT e2.entity_type
               FROM t_relation_participant rp1
               JOIN t_attribute a1 ON rp1.fk_att_id = a1.attribute_id
               JOIN t_entity e1 ON a1.fk_entity_id = e1.entity_id
               JOIN t_relation_participant rp2 ON rp1.fk_relation_id = rp2.fk_relation_id
               JOIN t_attribute a2 ON rp2.fk_att_id = a2.attribute_id
               JOIN t_entity e2 ON a2.fk_entity_id = e2.entity_id
               WHERE e1.entity_type = ? AND e1.isEvent = TRUE
                 AND e2.isEvent = FALSE""",
            (ev_type_row['entity_type'],),
        )
        for r in cur3.fetchall():
            types.add(r['entity_type'])
        cur3.close()

    conn.close()
    return sorted(types)


def get_event_entity_types_detailed(event_instance_id):
    """Get non-event entity types linked to an event, with hasPersons flag."""
    types = get_event_entity_types(event_instance_id)
    if not types:
        return []
    conn = get_connection()
    result = []
    for t in types:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT COUNT(*) AS cnt FROM t_attribute a
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE e.entity_type = ? AND a.isPersonRessource = TRUE""",
            (t,),
        )
        row = cur.fetchone()
        cur.close()
        result.append({"name": t, "hasPersons": row['cnt'] > 0})
    conn.close()
    return result


def get_entity_type_attributes_list(entity_type: str):
    """Get non-PK attributes of an entity type."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT a.attribute_name, d.datatype
           FROM t_attribute a
           JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE e.entity_type = ? AND a.is_unique = FALSE
           ORDER BY a.attribute_id""",
        (entity_type,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_event_tree_data(event_instance_id: int):
    """Get tree view data: resources, attributes, instances linked to event."""
    from collections import defaultdict
    conn = get_connection()

    # Step 1: Get all relations involving this event instance (stored procedure)
    cur1 = conn.cursor(dictionary=True)
    cur1.execute("CALL get_relations_for_entity(?)", (event_instance_id,))
    all_rel_data = cur1.fetchall()
    cur1.close()

    relations = defaultdict(list)
    for row in all_rel_data:
        relations[row['relation_id']].append(row)

    # Step 1b: Also discover relations via t_relation_participant for the event's
    # entity type, so resources with 0 instances still appear in the tree.
    cur1b = conn.cursor(dictionary=True)
    cur1b.execute(
        """SELECT e.entity_type FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE v.entity_instance_id = ? AND e.isEvent = TRUE
           LIMIT 1""",
        (event_instance_id,),
    )
    ev_type_row = cur1b.fetchone()
    cur1b.close()

    if ev_type_row:
        cur1c = conn.cursor(dictionary=True)
        cur1c.execute(
            """SELECT DISTINCT rp.fk_relation_id
               FROM t_relation_participant rp
               JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE e.entity_type = ? AND e.isEvent = TRUE""",
            (ev_type_row['entity_type'],),
        )
        for r in cur1c.fetchall():
            if r['fk_relation_id'] not in relations:
                relations[r['fk_relation_id']] = []
        cur1c.close()

    resources = []
    seen = set()

    for rid, rows in relations.items():
        # Find non-event entity types participating in this relation
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT DISTINCT e.entity_type, e.entity_id
               FROM t_relation_participant rp
               JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE rp.fk_relation_id = ? AND e.isEvent = FALSE""",
            (rid,),
        )
        etypes = cur.fetchall()
        cur.close()

        for et in etypes:
            etype = et['entity_type']
            if etype in seen:
                continue
            seen.add(etype)

            # Entity attributes (non-PK)
            cur2 = conn.cursor(dictionary=True)
            cur2.execute(
                """SELECT a.attribute_name, d.datatype, a.isInputField, a.isRequired,
                          a.isListRessource, a.isSingularRessource, a.isPersonRessource
                   FROM t_attribute a
                   JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
                   WHERE a.fk_entity_id = ? AND a.is_unique = FALSE
                   ORDER BY a.attribute_id""",
                (et['entity_id'],),
            )
            e_attrs = [dict(r) for r in cur2.fetchall()]
            cur2.close()
            has_persons = any(bool(a.get('isPersonRessource', False)) for a in e_attrs)

            # Relation attributes (non-FK)
            cur3 = conn.cursor(dictionary=True)
            cur3.execute(
                """SELECT DISTINCT a.attribute_name, d.datatype,
                           a.isInputField, a.isRequired, a.access, a.expirationDate,
                           a.isListRessource, a.isSingularRessource,
                           a.ref_entity_type, a.ref_attribute_name
                    FROM t_relation_participant rp
                    JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
                    JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
                    WHERE rp.fk_relation_id = ?
                      AND a.fk_entity_id IS NULL
                      AND a.attribute_name NOT LIKE 'fk!_%' ESCAPE '!'
                      AND rp.fk_att_id = rp.fk_att_id_rel""",
                (rid,),
            )
            r_attrs = [dict(r) for r in cur3.fetchall()]
            cur3.close()

            attributes = []
            for a in e_attrs:
                attributes.append({
                    "name": a['attribute_name'], "datatype": a['datatype'],
                    "isInputField": bool(a['isInputField']),
                    "isListRessource": bool(a.get('isListRessource', False)),
                    "isSingularRessource": bool(a.get('isSingularRessource', False)),
                    "isPersonRessource": bool(a.get('isPersonRessource', False)),
                    "source": "entity",
                })
            for a in r_attrs:
                attr_dict = {
                    "name": a['attribute_name'], "datatype": a['datatype'],
                    "isInputField": bool(a['isInputField']),
                    "isListRessource": bool(a.get('isListRessource', False)),
                    "isSingularRessource": bool(a.get('isSingularRessource', False)),
                    "source": "relation",
                }
                if a.get('ref_entity_type'):
                    attr_dict["ref_entity_type"] = a['ref_entity_type']
                    attr_dict["ref_attribute_name"] = a['ref_attribute_name']
                attributes.append(attr_dict)

            # Get resource instance IDs linked to this event via this relation
            cur4 = conn.cursor(dictionary=True)
            cur4.execute(
                """SELECT DISTINCT v2.entity_instance_id, rv1.relation_instance_id
                   FROM t_relation_values rv1
                   JOIN t_relation_values rv2
                     ON rv1.relation_instance_id = rv2.relation_instance_id
                     AND rv1.fk_relation_id = rv2.fk_relation_id
                   JOIN t_values v1 ON rv1.fk_value_id = v1.value_id
                   JOIN t_values v2 ON rv2.fk_value_id = v2.value_id
                   JOIN t_attribute a1 ON v1.fk_attribute_id = a1.attribute_id
                   JOIN t_attribute a2 ON v2.fk_attribute_id = a2.attribute_id
                   LEFT JOIN t_entity e1 ON a1.fk_entity_id = e1.entity_id
                   LEFT JOIN t_entity e2 ON a2.fk_entity_id = e2.entity_id
                   WHERE rv1.fk_relation_id = ?
                     AND v1.entity_instance_id = ?
                     AND e1.isEvent = TRUE
                     AND e2.entity_type = ?
                     AND v2.entity_instance_id IS NOT NULL""",
                (rid, event_instance_id, etype),
            )
            instance_rows = cur4.fetchall()
            cur4.close()

            # Build map: entity_instance_id -> relation_instance_id
            iid_to_riid = {}
            for r in instance_rows:
                iid_to_riid[r['entity_instance_id']] = r['relation_instance_id']
            iids = sorted(iid_to_riid.keys(), reverse=True)

            instances = []
            for iid in iids:
                # Entity attribute values
                cur5 = conn.cursor(dictionary=True)
                cur5.execute(
                    """SELECT a.attribute_name, v.value
                       FROM t_values v
                       JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
                       WHERE v.entity_instance_id = ?
                         AND a.fk_entity_id = ?
                         AND a.is_unique = FALSE""",
                    (iid, et['entity_id']),
                )
                vals = {"_id": iid, "_rel_instance_id": iid_to_riid.get(iid)}
                for r in cur5.fetchall():
                    vals[r['attribute_name']] = r['value']
                cur5.close()

                # Relation attribute values for this instance
                cur6 = conn.cursor(dictionary=True)
                cur6.execute(
                    """SELECT a3.attribute_name, v3.value
                        FROM t_relation_values rv1
                        JOIN t_relation_values rv2
                          ON rv1.relation_instance_id = rv2.relation_instance_id
                          AND rv1.fk_relation_id = rv2.fk_relation_id
                        JOIN t_relation_values rv3
                          ON rv1.relation_instance_id = rv3.relation_instance_id
                          AND rv1.fk_relation_id = rv3.fk_relation_id
                        JOIN t_values v1 ON rv1.fk_value_id = v1.value_id
                        JOIN t_values v2 ON rv2.fk_value_id = v2.value_id
                        JOIN t_values v3 ON rv3.fk_value_id = v3.value_id
                        JOIN t_attribute a3 ON rv3.fk_attribute_id = a3.attribute_id
                        WHERE rv1.fk_relation_id = ?
                          AND v1.entity_instance_id = ?
                          AND v2.entity_instance_id = ?
                          AND a3.fk_entity_id IS NULL
                          AND a3.attribute_name NOT LIKE 'fk!_%' ESCAPE '!'""",
                    (rid, event_instance_id, iid),
                )
                for r in cur6.fetchall():
                    vals[r['attribute_name']] = r['value']
                cur6.close()

                instances.append(vals)

            resources.append({
                "entity_type": etype,
                "relation_id": rid,
                "attributes": attributes,
                "instances": instances,
                "hasPersons": has_persons,
            })

    conn.close()
    return resources


def get_unlinked_entity_types(event_instance_id: int):
    """Get non-event entity types NOT yet linked to the given event."""
    conn = get_connection()

    # Get the event's entity type
    cur0 = conn.cursor(dictionary=True)
    cur0.execute(
        """SELECT e.entity_type FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE v.entity_instance_id = ? AND e.isEvent = TRUE
           LIMIT 1""",
        (event_instance_id,),
    )
    ev_row = cur0.fetchone()
    cur0.close()
    if not ev_row:
        conn.close()
        return []

    # Get entity types already linked via relation_participant
    cur1 = conn.cursor(dictionary=True)
    cur1.execute(
        """SELECT DISTINCT e2.entity_type
           FROM t_relation_participant rp1
           JOIN t_attribute a1 ON rp1.fk_att_id = a1.attribute_id
           JOIN t_entity e1 ON a1.fk_entity_id = e1.entity_id
           JOIN t_relation_participant rp2 ON rp1.fk_relation_id = rp2.fk_relation_id
           JOIN t_attribute a2 ON rp2.fk_att_id = a2.attribute_id
           JOIN t_entity e2 ON a2.fk_entity_id = e2.entity_id
           WHERE e1.entity_type = ? AND e1.isEvent = TRUE
             AND e2.isEvent = FALSE""",
        (ev_row['entity_type'],),
    )
    linked = {r['entity_type'] for r in cur1.fetchall()}
    cur1.close()

    # Also check via relation_values (in case participants are missing)
    cur1b = conn.cursor(dictionary=True)
    cur1b.execute(
        """SELECT DISTINCT e2.entity_type
           FROM t_relation_values rv1
           JOIN t_values v1 ON rv1.fk_value_id = v1.value_id
           JOIN t_attribute a1 ON v1.fk_attribute_id = a1.attribute_id
           JOIN t_entity e1 ON a1.fk_entity_id = e1.entity_id
           JOIN t_relation_values rv2
             ON rv1.relation_instance_id = rv2.relation_instance_id
             AND rv1.fk_relation_id = rv2.fk_relation_id
           JOIN t_values v2 ON rv2.fk_value_id = v2.value_id
           JOIN t_attribute a2 ON v2.fk_attribute_id = a2.attribute_id
           JOIN t_entity e2 ON a2.fk_entity_id = e2.entity_id
           WHERE v1.entity_instance_id = ?
             AND e1.isEvent = TRUE
             AND e2.isEvent = FALSE""",
        (event_instance_id,),
    )
    for r in cur1b.fetchall():
        linked.add(r['entity_type'])
    cur1b.close()

    # Get all non-event entity types
    cur2 = conn.cursor(dictionary=True)
    cur2.execute("SELECT entity_type FROM t_entity WHERE isEvent = FALSE")
    all_types = [r['entity_type'] for r in cur2.fetchall()]
    cur2.close()

    conn.close()
    return sorted([t for t in all_types if t not in linked])


def link_existing_entity_to_event(entity_type: str, event_instance_id: int):
    """Link an already-existing entity type to an event via a new relation."""
    conn = get_connection()

    try:
        # Look up event entity type
        cur0 = conn.cursor(dictionary=True)
        cur0.execute(
            """SELECT e.entity_type FROM t_values v
               JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE v.entity_instance_id = ? AND e.isEvent = TRUE
               LIMIT 1""",
            (event_instance_id,),
        )
        ev_row = cur0.fetchone()
        cur0.close()
        if not ev_row:
            raise ValueError("Event not found")
        event_entity_type = ev_row['entity_type']

        # Create / get relation
        rel_name = f"event_{entity_type.lower()}"
        cur1 = conn.cursor(dictionary=True)
        cur1.execute(
            "CALL create_relation(?, ?, ?, @rel_id)",
            (rel_name, "m:n", f"Event linked to {entity_type}"),
        )
        _drain(cur1)
        cur1.close()

        cur1b = conn.cursor(dictionary=True)
        cur1b.execute("SELECT @rel_id AS rel_id")
        rel_id = cur1b.fetchone()['rel_id']
        cur1b.close()

        # Ensure participants
        _ensure_relation_participants(conn, rel_id, event_entity_type, entity_type)

        # Link event instance to all existing instances of the entity type
        cur2 = conn.cursor(dictionary=True)
        cur2.execute(
            """SELECT v.value_id FROM t_values v
               JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               WHERE v.entity_instance_id = ? AND a.is_unique = TRUE AND e.isEvent = TRUE
               LIMIT 1""",
            (event_instance_id,),
        )
        ev_pk_row = cur2.fetchone()
        cur2.close()

        if ev_pk_row:
            ev_pk = ev_pk_row['value_id']

            cur3 = conn.cursor(dictionary=True)
            cur3.execute(
                """SELECT v.value_id FROM t_values v
                   JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
                   JOIN t_entity e ON a.fk_entity_id = e.entity_id
                   WHERE e.entity_type = ? AND a.is_unique = TRUE""",
                (entity_type,),
            )
            res_pks = cur3.fetchall()
            cur3.close()

            cur3b = conn.cursor(dictionary=True)
            cur3b.execute(
                """SELECT rv2.fk_value_id FROM t_relation_values rv1
                   JOIN t_relation_values rv2
                     ON rv1.relation_instance_id = rv2.relation_instance_id
                     AND rv1.fk_relation_id = rv2.fk_relation_id
                   WHERE rv1.fk_relation_id = ?
                     AND rv1.fk_value_id = ?
                     AND rv2.fk_value_id != ?""",
                (rel_id, ev_pk, ev_pk),
            )
            already_linked = {r['fk_value_id'] for r in cur3b.fetchall()}
            cur3b.close()

            for rpk in res_pks:
                if rpk['value_id'] not in already_linked:
                    cur4 = conn.cursor(dictionary=True)
                    cur4.execute(
                        "CALL create_relation_instance(?, ?, @ri)",
                        (rel_id, f"{ev_pk},{rpk['value_id']}"),
                    )
                    _drain(cur4)
                    cur4.close()

        conn.commit()
        return rel_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()