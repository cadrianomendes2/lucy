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
        CREATE TABLE IF NOT EXISTS conversations (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            role      TEXT NOT NULL,
            content   TEXT NOT NULL,
            model     TEXT,
            language  TEXT
        );
        CREATE TABLE IF NOT EXISTS facts (
            id         TEXT PRIMARY KEY,
            fact       TEXT NOT NULL,
            source     TEXT,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


def log_turn(role: str, content: str, model: str, language: str) -> None:
    conn = _connect()
    conn.execute(
        "INSERT INTO conversations (timestamp, role, content, model, language) VALUES (?, ?, ?, ?, ?)",
        (_now(), role, content, model, language),
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
