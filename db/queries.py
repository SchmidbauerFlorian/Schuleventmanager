from db.connection import get_connection

def fetch_all_events():
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, name FROM events ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    return rows

def fetch_event_by_id(event_id: int):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT id, name, created_at, start_date, end_date FROM events WHERE id = ?",
        (event_id,)
    )
    row = cur.fetchone()
    conn.close()
    return row

def insert_event(name: str, created_by: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO events (name, created_by, created_at) VALUES (?, ?, NOW())",
        (name, created_by)
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id

def delete_event_by_name(name: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM events WHERE name = ?", (name,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected

def fetch_messages_by_event(event_id: int):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT type, title, sent_at FROM messages WHERE event_id = ? ORDER BY sent_at DESC",
        (event_id,)
    )
    rows = cur.fetchall()
    conn.close()
    return rows

def fetch_statistics_by_event(event_id: int):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT * FROM event_statistics WHERE event_id = ?",
        (event_id,)
    )
    row = cur.fetchone()
    conn.close()
    return row