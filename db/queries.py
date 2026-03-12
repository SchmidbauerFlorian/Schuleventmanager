from db.connection import get_connection


# =========================================================================
# Internal helpers for event-scoped relation naming
# =========================================================================

def _get_entity_type_by_id(conn, entity_id):
    """Return the entity_type string for the given entity_id (uses existing conn)."""
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT entity_type FROM t_entity WHERE entity_id = ?", (entity_id,))
    row = cur.fetchone()
    cur.close()
    return row['entity_type'] if row else None


def _get_event_entity_type(conn, event_instance_id):
    """Return the entity_type string for an event instance (uses existing conn)."""
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT e.entity_type FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           WHERE v.entity_instance_id = ? AND e.isEvent = TRUE
           LIMIT 1""",
        (event_instance_id,),
    )
    row = cur.fetchone()
    cur.close()
    return row['entity_type'] if row else None


def _make_rel_name(event_entity_type, resource_type):
    """Build a relation name scoped to a specific event type and resource type."""
    return f"{event_entity_type.lower()}_{resource_type.lower()}"


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


def get_users(query: str = None):
    """Fetch users from t_users, searching by display_name or email."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    sql = "SELECT user_id, display_name, email, job_title FROM t_users WHERE 1=1"
    params = []
    if query:
        sql += " AND (LOWER(display_name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))"
        params.extend([f"%{query}%", f"%{query}%"])
    sql += " ORDER BY display_name LIMIT 50"
    cur.execute(sql, tuple(params))
    rows = cur.fetchall()
    conn.close()
    return rows


def get_user_classes():
    """Fetch distinct class values (job_title) from t_users."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT DISTINCT job_title
        FROM t_users
        WHERE job_title IS NOT NULL AND LOWER(job_title) != 'teacher'
        ORDER BY job_title
    """)
    classes = [row['job_title'] for row in cur.fetchall()]
    conn.close()
    return classes

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

def create_attribute(entity_id: int, attribute_name: str, datatype: str, is_event: bool = False):
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    cur = conn.cursor()
    cur.execute("CALL create_attribute(?, ?, ?, ?)", (entity_type, attribute_name, datatype, is_event))
    conn.commit()
    conn.close()

def delete_attribute(entity_id: int, attribute_name: str):
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    cur = conn.cursor()
    cur.execute("CALL delete_attribute(?, ?)", (entity_type, attribute_name))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected

def update_attribute(entity_id: int, old_attribute_name: str, new_attribute_name: str, new_datatype: str):
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    cur = conn.cursor()
    cur.execute("CALL update_attribute(?, ?, ?, ?)", (entity_type, old_attribute_name, new_attribute_name, new_datatype))
    conn.commit()


def rename_entity_type(entity_id: int, new_name: str):
    """Rename an entity type."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT entity_type FROM t_entity WHERE entity_id = ?", (entity_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return
    old_name = row['entity_type']
    cur.close()
    cur2 = conn.cursor()
    cur2.execute("UPDATE t_entity SET entity_type = ? WHERE entity_id = ?", (new_name, entity_id))
    # Also update relation names that reference this entity
    cur2.execute("UPDATE t_relation SET name = REPLACE(name, ?, ?) WHERE name LIKE ?",
                (old_name.lower(), new_name.lower(), f"%{old_name.lower()}%"))
    # Update ref_entity_type in dependent resource attributes
    cur2.execute("UPDATE t_attribute SET ref_entity_type = ? WHERE ref_entity_type = ?",
                (new_name, old_name))
    conn.commit()
    conn.close()


def delete_resource_from_event(entity_id: int, event_instance_id: int):
    """Delete a resource (entity type) and its relation to the event."""
    conn = get_connection()
    try:
        entity_type = _get_entity_type_by_id(conn, entity_id)
        # Find the relation between event and this resource
        event_et = _get_event_entity_type(conn, event_instance_id)
        rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT relation_id FROM t_relation WHERE name = ?", (rel_name,))
        rel_row = cur.fetchone()
        cur.close()

        if rel_row:
            # Delete relation attributes (fk_entity_id IS NULL)
            cur2 = conn.cursor(dictionary=True)
            cur2.execute(
                """SELECT DISTINCT a.attribute_id FROM t_attribute a
                   JOIN t_relation_participant rp ON rp.fk_att_id = a.attribute_id
                   WHERE rp.fk_relation_id = ? AND a.fk_entity_id IS NULL
                     AND rp.fk_att_id = rp.fk_att_id_rel""",
                (rel_row['relation_id'],),
            )
            rel_attr_ids = [r['attribute_id'] for r in cur2.fetchall()]
            cur2.close()

            for aid in rel_attr_ids:
                cur3 = conn.cursor()
                cur3.execute("DELETE FROM t_attribute WHERE attribute_id = ?", (aid,))
                cur3.close()

            # Delete the relation itself
            cur4 = conn.cursor()
            cur4.execute("DELETE FROM t_relation WHERE relation_id = ?", (rel_row['relation_id'],))
            cur4.close()

        # Delete the entity type (cascades attributes, values, instances)
        cur5 = conn.cursor()
        cur5.execute("CALL delete_entity_type(?)", (entity_type,))
        _drain(cur5)
        cur5.close()

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_relation_id_by_name(relation_name: str):
    """Look up a relation ID by its name."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT relation_id FROM t_relation WHERE name = ?", (relation_name,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row['relation_id'] if row else None


def get_relation_id_for_event_entity(event_instance_id: int, entity_id: int):
    """Get relation ID between an event and a resource entity type, using event-scoped naming."""
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id)
    if not event_et or not entity_type:
        conn.close()
        return None
    rel_name = _make_rel_name(event_et, entity_type)
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT relation_id FROM t_relation WHERE name = ?", (rel_name,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row['relation_id'] if row else None


def delete_relation_attribute(relation_id: int, attribute_name: str):
    """Delete a relation attribute by name."""
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT a.attribute_id FROM t_attribute a
               JOIN t_relation_participant rp ON rp.fk_att_id = a.attribute_id
               WHERE rp.fk_relation_id = ? AND a.attribute_name = ?
                 AND a.fk_entity_id IS NULL AND rp.fk_att_id = rp.fk_att_id_rel""",
            (relation_id, attribute_name),
        )
        row = cur.fetchone()
        cur.close()
        if row:
            cur2 = conn.cursor()
            cur2.execute("DELETE FROM t_attribute WHERE attribute_id = ?", (row['attribute_id'],))
            cur2.close()
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def update_relation_attribute_name(relation_id: int, old_name: str, new_name: str,
                                   access: str = None):
    """Rename a relation attribute and optionally update access."""
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT a.attribute_id FROM t_attribute a
               JOIN t_relation_participant rp ON rp.fk_att_id = a.attribute_id
               WHERE rp.fk_relation_id = ? AND a.attribute_name = ?
                 AND a.fk_entity_id IS NULL AND rp.fk_att_id = rp.fk_att_id_rel""",
            (relation_id, old_name),
        )
        row = cur.fetchone()
        cur.close()
        if row:
            cur2 = conn.cursor()
            if access and access in ('hidden', 'read', 'write'):
                cur2.execute("UPDATE t_attribute SET attribute_name = ?, access = ? WHERE attribute_id = ?",
                             (new_name, access, row['attribute_id']))
            else:
                cur2.execute("UPDATE t_attribute SET attribute_name = ? WHERE attribute_id = ?",
                             (new_name, row['attribute_id']))
            cur2.close()
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

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


def delete_list_entry(instance_id: int, rel_instance_id: int = None):
    conn = get_connection()
    cur = conn.cursor()
    if rel_instance_id:
        cur.execute("CALL delete_relation_instance(?)", (rel_instance_id,))
    cur.execute("CALL delete_entity_instance(?)", (instance_id,))
    conn.commit()
    conn.close()


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


def create_resource_for_event(resource_name: str, user_ids: list, class_groups: list, event_instance_id: int):
    """Create entity type, import persons from user_ids and class_groups, link to event via relation."""
    conn = get_connection()
    has_persons = bool(user_ids or class_groups)

    try:
        # 0. Look up the event's actual entity type
        event_entity_type = _get_event_entity_type(conn, event_instance_id) or 'Event'

        # 1. Create entity type if not exists
        cur1 = conn.cursor(dictionary=True)
        cur1.execute("SELECT entity_id FROM t_entity WHERE entity_type = ?", (resource_name,))
        exists = cur1.fetchone()
        cur1.close()

        if not exists:
            cur1b = conn.cursor(dictionary=True)
            if has_persons:
                cur1b.execute(
                    "CALL create_entity_with_attributes(?, ?, ?, FALSE, ?)",
                    (resource_name, "uid", "INTEGER", ""),
                )
            else:
                cur1b.execute(
                    "CALL create_entity_with_attributes(?, ?, ?, FALSE, ?)",
                    (resource_name, "", "", ""),
                )
            _drain(cur1b)
            cur1b.close()

        # Mark as person resource and import users
        if has_persons:
            cur_p = conn.cursor()
            cur_p.execute(
                """UPDATE t_attribute SET isPersonRessource = TRUE
                   WHERE fk_entity_id = (SELECT entity_id FROM t_entity WHERE entity_type = ?)""",
                (resource_name,),
            )
            cur_p.close()

            # Collect all user_ids to import (from direct picks + class groups)
            all_uids = set(int(u) for u in user_ids)

            for cls in class_groups:
                cur_c = conn.cursor(dictionary=True)
                if cls.lower() == 'teacher':
                    cur_c.execute(
                        "SELECT user_id FROM t_users WHERE job_title IS NULL OR LOWER(job_title) = 'teacher'"
                    )
                else:
                    cur_c.execute(
                        "SELECT user_id FROM t_users WHERE LOWER(job_title) = LOWER(?)",
                        (cls,),
                    )
                for row in cur_c.fetchall():
                    all_uids.add(row['user_id'])
                cur_c.close()

            # Import each user
            pk_name = f"{resource_name}_id"
            for uid_val in all_uids:
                uid = str(uid_val)
                # Avoid duplicates
                cur_dup = conn.cursor(dictionary=True)
                cur_dup.execute(
                    """SELECT COUNT(*) AS cnt FROM t_values v
                       JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
                       JOIN t_entity e ON a.fk_entity_id = e.entity_id
                       WHERE e.entity_type = ? AND a.attribute_name = ? AND v.value = ?""",
                    (resource_name, pk_name, uid),
                )
                already = cur_dup.fetchone()['cnt']
                cur_dup.close()

                if already == 0:
                    cur_inst = conn.cursor(dictionary=True)
                    cur_inst.execute(
                        "CALL create_entity_instance(?, ?, ?)",
                        (resource_name, f"{pk_name},uid", f"{uid},{uid}"),
                    )
                    _drain(cur_inst)
                    cur_inst.close()

        # 3. Create / get relation between Event and this resource
        rel_name = _make_rel_name(event_entity_type, resource_name)
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


def add_list_entry(entity_id: int, event_instance_id: int, values: dict) -> int:
    """Create a new entity instance and link it to the event."""
    conn = get_connection()
    try:
        entity_type = _get_entity_type_by_id(conn, entity_id)
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
               WHERE a.fk_entity_id = ? AND a.is_unique = TRUE
               ORDER BY v.value_id DESC LIMIT 1""",
            (entity_id,),
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
        event_et = _get_event_entity_type(conn, event_instance_id)
        rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
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


def add_api_attribute_to_resource(entity_id: int, attribute_name: str,
                                   event_instance_id: int,
                                   datatype: str = 'VARCHAR', is_required: bool = False,
                                   access: str = 'read'):
    """Add an API attribute as a relation attribute and populate values from t_users."""
    field_map = {"Name": "display_name", "Email": "email", "Klasse": "job_title"}
    t_users_col = field_map.get(attribute_name)
    if not t_users_col:
        return None

    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id)
    rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"

    try:
        # Find relation
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT relation_id FROM t_relation WHERE name = ?", (rel_name,))
        rel_row = cur.fetchone()
        cur.close()
        if not rel_row:
            conn.close()
            return None
        rel_id = rel_row['relation_id']

        # Create relation attribute (like Eingabe does)
        cur2 = conn.cursor(dictionary=True)
        cur2.execute(
            "CALL add_relation_attribute(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (rel_id, attribute_name, datatype, False, is_required, False, None, None, None, access),
        )
        _drain(cur2)
        cur2.close()

        # Get the new attribute_id
        cur3 = conn.cursor(dictionary=True)
        cur3.execute(
            """SELECT a.attribute_id FROM t_attribute a
               JOIN t_relation_participant rp ON a.attribute_id = rp.fk_att_id_rel
               WHERE rp.fk_relation_id = ? AND a.attribute_name = ?
                 AND a.fk_entity_id IS NULL AND rp.fk_att_id = rp.fk_att_id_rel""",
            (rel_id, attribute_name),
        )
        attr_row = cur3.fetchone()
        cur3.close()
        if not attr_row:
            conn.commit()
            return rel_id
        attr_id = attr_row['attribute_id']

        # Mark as person resource attribute
        cur3b = conn.cursor()
        cur3b.execute("UPDATE t_attribute SET isPersonRessource = TRUE WHERE attribute_id = ?", (attr_id,))
        cur3b.close()

        # Get all relation instances (entity_instance_id + relation_instance_id)
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
            (rel_id, event_instance_id, entity_type),
        )
        instances = cur4.fetchall()
        cur4.close()

        # For each instance, get PK value (= user_id) and populate from t_users
        for inst in instances:
            eid = inst['entity_instance_id']
            riid = inst['relation_instance_id']

            # Get entity PK value (stored as user_id during import)
            cur5 = conn.cursor(dictionary=True)
            cur5.execute(
                """SELECT v.value FROM t_values v
                   JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
                   WHERE v.entity_instance_id = ? AND a.is_unique = TRUE
                   LIMIT 1""",
                (eid,),
            )
            pk_row = cur5.fetchone()
            cur5.close()
            if not pk_row or not pk_row['value']:
                continue

            # Look up t_users
            cur6 = conn.cursor(dictionary=True)
            cur6.execute(
                "SELECT display_name, email, job_title FROM t_users WHERE user_id = ?",
                (int(pk_row['value']),),
            )
            user_row = cur6.fetchone()
            cur6.close()
            if not user_row:
                continue

            val = user_row.get(t_users_col)
            if val is None:
                val = ""

            # Create value and link to relation instance
            cur7 = conn.cursor()
            cur7.execute(
                "INSERT INTO t_values(fk_attribute_id, value, entity_instance_id) VALUES (?, ?, NULL)",
                (attr_id, str(val)),
            )
            val_id = cur7.lastrowid
            cur7.close()

            cur8 = conn.cursor()
            cur8.execute(
                """INSERT INTO t_relation_values(fk_relation_id, fk_attribute_id, fk_value_id, relation_instance_id)
                   VALUES (?, ?, ?, ?)""",
                (rel_id, attr_id, val_id, riid),
            )
            cur8.close()

        conn.commit()
        return rel_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def create_dependent_resource_relation(source_entity_id: int, target_entity_id: int):
    """Create a relation between two entity types."""
    conn = get_connection()
    source_entity = _get_entity_type_by_id(conn, source_entity_id)
    target_entity = _get_entity_type_by_id(conn, target_entity_id)
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


def add_dependent_resource_attribute(target_entity_id: int, event_instance_id: int,
                                     source_entity_id: int, source_attribute: str):
    """Add a dependent resource attribute to the event-target relation.
    The attribute shows a dropdown of values from source_entity's source_attribute."""
    conn = get_connection()
    cur1 = conn.cursor(dictionary=True)

    target_entity = _get_entity_type_by_id(conn, target_entity_id)
    source_entity = _get_entity_type_by_id(conn, source_entity_id)

    event_et = _get_event_entity_type(conn, event_instance_id)
    rel_name = _make_rel_name(event_et, target_entity) if event_et else f"event_{target_entity.lower()}"
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
         _make_rel_name(event_et, source_entity) if event_et else f"event_{source_entity.lower()}", source_attribute),
    )
    dt_row = cur_dt.fetchone()
    cur_dt.close()
    db_dtype = dt_row['datatype'] if dt_row else 'VARCHAR'

    cur2 = conn.cursor(dictionary=True)
    cur2.execute(
        "CALL add_relation_attribute(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (rel_row['relation_id'], source_attribute, db_dtype, False, False, True,
         None, source_entity, source_attribute, 'read'),
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


def get_reference_values(entity_id: int, attribute_name: str, event_instance_id: int):
    """Get all values of a specific attribute from instances of an entity type linked to an event."""
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id) if event_instance_id else None
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
        rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
        cur.execute(
            """SELECT DISTINCT v.value
               FROM t_relation_values rv
               JOIN t_values v ON rv.fk_value_id = v.value_id
               JOIN t_attribute a ON rv.fk_attribute_id = a.attribute_id
               JOIN t_relation r ON rv.fk_relation_id = r.relation_id
               WHERE r.name = ? AND a.attribute_name = ?
                 AND v.value IS NOT NULL AND v.value != ''
               ORDER BY v.value""",
            (rel_name, attribute_name),
        )
        rows = cur.fetchall()
    cur.close()
    conn.close()
    return [r['value'] for r in rows]


def add_input_attribute_to_event_relation(entity_id: int, event_instance_id: int,
                                          attr_name: str, datatype: str,
                                          is_required: bool, expiration_date: str,
                                          access: str = 'read'):
    """Add an input field attribute to the relation between event and entity type."""
    conn = get_connection()
    cur1 = conn.cursor(dictionary=True)

    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id)
    rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
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
        "CALL add_relation_attribute(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (rel_row['relation_id'], attr_name, db_dtype, True, is_required, False,
         expiration_date if expiration_date else None, None, None, access),
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


def get_entity_instances(entity_id: int):
    """Get all instances of an entity type with their first non-PK attribute as label."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT DISTINCT v.entity_instance_id AS id, v.value AS label
           FROM t_values v
           JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
           WHERE a.fk_entity_id = ? AND a.is_unique = FALSE
           ORDER BY v.entity_instance_id""",
        (entity_id,),
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
    """Get non-event entity types linked to an event via relations.
    Returns list of dicts: [{"entity_type": ..., "entity_id": ...}, ...]
    """
    conn = get_connection()

    if event_instance_id is None:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT entity_id, entity_type FROM t_entity WHERE isEvent = FALSE")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return sorted([{"entity_type": r['entity_type'], "entity_id": r['entity_id']} for r in rows], key=lambda x: x['entity_type'])

    # 1. Entity types with actual relation instances (have data)
    cur1 = conn.cursor(dictionary=True)
    cur1.execute(
        """SELECT DISTINCT e2.entity_type, e2.entity_id
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
    types_map = {r['entity_type']: r['entity_id'] for r in cur1.fetchall()}
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
            """SELECT DISTINCT e2.entity_type, e2.entity_id
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
            types_map.setdefault(r['entity_type'], r['entity_id'])
        cur3.close()

    conn.close()
    return sorted([{"entity_type": t, "entity_id": eid} for t, eid in types_map.items()], key=lambda x: x['entity_type'])


def get_event_entity_types_detailed(event_instance_id):
    """Get non-event entity types linked to an event, with hasPersons flag and cardinality."""
    types = get_event_entity_types(event_instance_id)
    if not types:
        return []
    conn = get_connection()
    event_et = _get_event_entity_type(conn, event_instance_id)
    result = []
    for td in types:
        t = td['entity_type']
        t_id = td['entity_id']
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT COUNT(*) AS cnt FROM t_attribute a
               WHERE a.fk_entity_id = ? AND a.isPersonRessource = TRUE""",
            (t_id,),
        )
        row = cur.fetchone()
        cur.close()

        # Get cardinality from FK participant in event relation
        rel_name = _make_rel_name(event_et, t) if event_et else f"event_{t.lower()}"
        cur2 = conn.cursor(dictionary=True)
        cur2.execute(
            """SELECT rp.participant_id, rp.card_min, rp.card_max
               FROM t_relation_participant rp
               JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
               JOIN t_entity e ON a.fk_entity_id = e.entity_id
               JOIN t_relation r ON rp.fk_relation_id = r.relation_id
               WHERE r.name = ? AND e.entity_id = ?
                 AND rp.fk_att_id != rp.fk_att_id_rel
               LIMIT 1""",
            (rel_name, t_id),
        )
        card_row = cur2.fetchone()
        cur2.close()

        entry = {"name": t, "entity_id": t_id, "hasPersons": row['cnt'] > 0}
        if card_row:
            entry["participantId"] = card_row['participant_id']
            entry["cardMin"] = card_row['card_min']
            entry["cardMax"] = card_row['card_max']
        result.append(entry)
    conn.close()
    return result


def update_cardinality(participant_id: int, card_min: int, card_max):
    """Update cardinality for a relation participant."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """UPDATE t_relation_participant
           SET card_min = ?, card_max = ?
           WHERE participant_id = ?""",
        (card_min, card_max, participant_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_relation_instance_count(entity_id: int, event_instance_id: int) -> int:
    """Count how many instances of entity_id are linked to the event."""
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id)
    rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT COUNT(DISTINCT v2.entity_instance_id) AS cnt
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
           JOIN t_relation r ON rv1.fk_relation_id = r.relation_id
           WHERE r.name = ?
             AND v1.entity_instance_id = ?
             AND e1.isEvent = TRUE
             AND e2.entity_id = ?""",
        (rel_name, event_instance_id, entity_id),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row['cnt'] if row else 0


def get_cardinality_for_entity_in_event(entity_id: int, event_instance_id: int):
    """Get card_max for an entity type's FK participant in the event relation."""
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id)
    rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT rp.card_max
           FROM t_relation_participant rp
           JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
           JOIN t_entity e ON a.fk_entity_id = e.entity_id
           JOIN t_relation r ON rp.fk_relation_id = r.relation_id
           WHERE r.name = ? AND e.entity_id = ?
             AND rp.fk_att_id != rp.fk_att_id_rel
           LIMIT 1""",
        (rel_name, entity_id),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row['card_max'] if row else None


def get_entity_type_attributes_list(entity_id: int):
    """Get non-PK attributes of an entity type."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT a.attribute_name, d.datatype
           FROM t_attribute a
           JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
           WHERE a.fk_entity_id = ? AND a.is_unique = FALSE
           ORDER BY a.attribute_id""",
        (entity_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_relation_attributes_for_entity(entity_id: int, event_instance_id: int):
    """Get local (relation) attributes for an entity type within a specific event."""
    conn = get_connection()
    entity_type = _get_entity_type_by_id(conn, entity_id)
    event_et = _get_event_entity_type(conn, event_instance_id)
    rel_name = _make_rel_name(event_et, entity_type) if event_et else f"event_{entity_type.lower()}"
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """SELECT a.attribute_name, d.datatype
           FROM t_relation_participant rp
           JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
           JOIN t_datatype d ON a.fk_datatype_id = d.datatype_id
           JOIN t_relation r ON rp.fk_relation_id = r.relation_id
           WHERE r.name = ?
             AND a.fk_entity_id IS NULL
             AND a.attribute_name NOT LIKE 'fk!_%' ESCAPE '!'
             AND rp.fk_att_id = rp.fk_att_id_rel
           ORDER BY a.attribute_id""",
        (rel_name,),
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

            # Entity attributes — only PK remains on the entity now, skip non-PK entity attrs
            # Check if entity has persons flag via entity attributes
            cur2 = conn.cursor(dictionary=True)
            cur2.execute(
                """SELECT a.isPersonRessource
                   FROM t_attribute a
                   WHERE a.fk_entity_id = ?""",
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
                           a.isPersonRessource,
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
            for a in r_attrs:
                attr_dict = {
                    "name": a['attribute_name'], "datatype": a['datatype'],
                    "isInputField": bool(a['isInputField']),
                    "isListRessource": bool(a.get('isListRessource', False)),
                    "isSingularRessource": bool(a.get('isSingularRessource', False)),
                    "isPersonRessource": bool(a.get('isPersonRessource', False)),
                    "access": a.get('access', 'read'),
                    "source": "relation",
                }
                if a.get('ref_entity_type'):
                    attr_dict["ref_entity_type"] = a['ref_entity_type']
                    attr_dict["ref_attribute_name"] = a['ref_attribute_name']
                    # Resolve ref_entity_id for frontend
                    cur_ref = conn.cursor(dictionary=True)
                    cur_ref.execute("SELECT entity_id FROM t_entity WHERE entity_type = ?", (a['ref_entity_type'],))
                    ref_row = cur_ref.fetchone()
                    cur_ref.close()
                    if ref_row:
                        attr_dict["ref_entity_id"] = ref_row['entity_id']
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
                vals = {"_id": iid, "_rel_instance_id": iid_to_riid.get(iid)}

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

            # Get cardinality for the FK participant of this entity type
            cur_card = conn.cursor(dictionary=True)
            cur_card.execute(
                """SELECT rp.participant_id, rp.card_min, rp.card_max
                   FROM t_relation_participant rp
                   JOIN t_attribute a ON rp.fk_att_id = a.attribute_id
                   JOIN t_entity e ON a.fk_entity_id = e.entity_id
                   WHERE rp.fk_relation_id = ? AND e.entity_type = ?
                     AND rp.fk_att_id != rp.fk_att_id_rel
                   LIMIT 1""",
                (rid, etype),
            )
            card_row = cur_card.fetchone()
            cur_card.close()

            res_entry = {
                "entity_type": etype,
                "entity_id": et['entity_id'],
                "relation_id": rid,
                "attributes": attributes,
                "instances": instances,
                "hasPersons": has_persons,
            }
            if card_row:
                res_entry["participantId"] = card_row['participant_id']
                res_entry["cardMin"] = card_row['card_min']
                res_entry["cardMax"] = card_row['card_max']
            resources.append(res_entry)

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
    cur2.execute("SELECT entity_id, entity_type FROM t_entity WHERE isEvent = FALSE")
    all_types = cur2.fetchall()
    cur2.close()

    conn.close()
    return sorted(
        [{"entity_type": r['entity_type'], "entity_id": r['entity_id']} for r in all_types if r['entity_type'] not in linked],
        key=lambda x: x['entity_type']
    )


def link_existing_entity_to_event(entity_id: int, event_instance_id: int):
    """Link an already-existing entity type to an event via a new relation."""
    conn = get_connection()

    try:
        entity_type = _get_entity_type_by_id(conn, entity_id)
        # Look up event entity type
        event_entity_type = _get_event_entity_type(conn, event_instance_id)
        if not event_entity_type:
            raise ValueError("Event not found")

        # Create / get relation
        rel_name = _make_rel_name(event_entity_type, entity_type)
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
                   WHERE a.fk_entity_id = ? AND a.is_unique = TRUE""",
                (entity_id,),
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


# =========================================================================
# Participant View (Teilnehmen)
# =========================================================================

def get_user_id_by_email(email: str):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT user_id FROM t_users WHERE LOWER(email) = LOWER(?)", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row['user_id'] if row else None


def get_events_for_participant(user_id: int):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT DISTINCT ev_val.entity_instance_id AS event_instance_id"
        " FROM t_values person_pk_val"
        " JOIN t_attribute a_pk ON person_pk_val.fk_attribute_id = a_pk.attribute_id"
        " JOIN t_entity ent ON a_pk.fk_entity_id = ent.entity_id"
        " JOIN t_relation_values rv_person ON rv_person.fk_value_id = person_pk_val.value_id"
        " JOIN t_relation_values rv_event"
        "   ON rv_event.relation_instance_id = rv_person.relation_instance_id"
        "   AND rv_event.fk_relation_id = rv_person.fk_relation_id"
        "   AND rv_event.fk_value_id != rv_person.fk_value_id"
        " JOIN t_values ev_val ON rv_event.fk_value_id = ev_val.value_id"
        " JOIN t_attribute a_ev ON ev_val.fk_attribute_id = a_ev.attribute_id"
        " JOIN t_entity ev_ent ON a_ev.fk_entity_id = ev_ent.entity_id"
        " WHERE ev_ent.isEvent = TRUE"
        "   AND a_pk.is_unique = TRUE"
        "   AND a_pk.isPersonRessource = TRUE"
        "   AND ent.isEvent = FALSE"
        "   AND person_pk_val.value = ?",
        (str(user_id),),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [r['event_instance_id'] for r in rows]


def _find_user_entity_instance_id(entity_id: int, user_id: int):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT v.entity_instance_id"
        " FROM t_values v"
        " JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id"
        " WHERE a.fk_entity_id = ? AND a.is_unique = TRUE AND v.value = ?"
        " LIMIT 1",
        (entity_id, str(user_id)),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row['entity_instance_id'] if row else None


def get_participant_tree_data(event_instance_id: int, user_id: int):
    full_tree = get_event_tree_data(event_instance_id)
    result = []
    for resource in full_tree:
        visible_attrs = [a for a in resource['attributes'] if a.get('access', 'read') != 'hidden']
        if not visible_attrs:
            continue
        if resource['hasPersons']:
            user_iid = _find_user_entity_instance_id(resource['entity_id'], user_id)
            if user_iid is None:
                continue
            matching = [i for i in resource['instances'] if i['_id'] == user_iid]
            if not matching:
                continue
            attrs_for_person = [{**a, 'userCanEdit': a.get('access', 'read') == 'write'} for a in visible_attrs]
            result.append({**resource, 'attributes': attrs_for_person, 'instances': matching})
        else:
            attrs_readonly = [{**a, 'userCanEdit': False} for a in visible_attrs]
            result.append({**resource, 'attributes': attrs_readonly, 'instances': resource['instances']})
    return result