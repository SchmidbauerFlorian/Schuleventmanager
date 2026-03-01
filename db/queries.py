from db.connection import get_connection

def fetch_all_events():
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, name FROM events ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    return rows

def create_event_by_name(name: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO events (name) VALUES (?)", (name,))
    conn.commit()
    event_id = cur.lastrowid
    conn.close()
    return event_id

def delete_event_by_name(name: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM events WHERE name = ?", (name,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected