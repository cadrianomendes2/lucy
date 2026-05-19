import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.expanduser("~/.personal-ai/memory.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT NOT NULL DEFAULT 'Nova conversa',
            model      TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
            timestamp  TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            model      TEXT,
            language   TEXT
        );
        CREATE TABLE IF NOT EXISTS facts (
            id         TEXT PRIMARY KEY,
            fact       TEXT NOT NULL,
            source     TEXT,
            created_at TEXT NOT NULL
        );
    """)
    # migração: adicionar session_id se não existir (dados antigos ficam com NULL)
    try:
        conn.execute("ALTER TABLE conversations ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE")
        conn.commit()
    except Exception:
        pass
    conn.close()


def create_session(title: str, model: str) -> int:
    conn = _connect()
    now = _now()
    cur = conn.execute(
        "INSERT INTO sessions (title, model, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (title, model, now, now),
    )
    session_id = cur.lastrowid
    conn.commit()
    conn.close()
    return session_id


def update_session_title(session_id: int, title: str) -> None:
    conn = _connect()
    conn.execute(
        "UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?",
        (title, _now(), session_id),
    )
    conn.commit()
    conn.close()


def touch_session(session_id: int) -> None:
    conn = _connect()
    conn.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (_now(), session_id))
    conn.commit()
    conn.close()


def get_sessions() -> list[dict]:
    conn = _connect()
    rows = conn.execute("""
        SELECT s.id, s.title, s.model, s.created_at, s.updated_at,
               (SELECT content FROM conversations
                WHERE session_id = s.id ORDER BY timestamp DESC LIMIT 1) as preview
        FROM sessions s
        ORDER BY s.updated_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session_messages(session_id: int) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT role, content FROM conversations WHERE session_id = ? ORDER BY timestamp ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_session(session_id: int) -> None:
    conn = _connect()
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


def count_session_turns(session_id: int) -> int:
    conn = _connect()
    row = conn.execute(
        "SELECT COUNT(*) FROM conversations WHERE session_id = ? AND role = 'user'",
        (session_id,),
    ).fetchone()
    conn.close()
    return row[0]


def log_turn(role: str, content: str, model: str, language: str, session_id: int | None = None) -> None:
    conn = _connect()
    conn.execute(
        "INSERT INTO conversations (session_id, timestamp, role, content, model, language) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, _now(), role, content, model, language),
    )
    conn.commit()
    conn.close()


def save_fact(fact_id: str, fact: str, source: str) -> None:
    conn = _connect()
    conn.execute(
        "INSERT OR REPLACE INTO facts (id, fact, source, created_at) VALUES (?, ?, ?, ?)",
        (fact_id, fact, source, _now()),
    )
    conn.commit()
    conn.close()


def get_all_facts() -> list[dict]:
    conn = _connect()
    rows = conn.execute("SELECT * FROM facts ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_fact(fact_id: str) -> None:
    conn = _connect()
    conn.execute("DELETE FROM facts WHERE id = ?", (fact_id,))
    conn.commit()
    conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
