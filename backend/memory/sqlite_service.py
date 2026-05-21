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
        CREATE TABLE IF NOT EXISTS topics (
            persona_id  TEXT NOT NULL,
            topic       TEXT NOT NULL,
            strength    REAL DEFAULT 1.0,
            research_count INTEGER DEFAULT 1,
            last_cycle  INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL,
            PRIMARY KEY (persona_id, topic)
        );
        CREATE TABLE IF NOT EXISTS learner_log (
            id             TEXT PRIMARY KEY,
            persona_id     TEXT NOT NULL,
            persona_name   TEXT,
            avatar_url     TEXT,
            interest       TEXT,
            insights       TEXT,
            timestamp      TEXT NOT NULL,
            discovery      INTEGER DEFAULT 0,
            synthesis      INTEGER DEFAULT 0,
            synthesis_report INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS topic_edges (
            persona_id  TEXT NOT NULL,
            topic_a     TEXT NOT NULL,
            topic_b     TEXT NOT NULL,
            weight      REAL DEFAULT 1.0,
            updated_at  TEXT NOT NULL,
            PRIMARY KEY (persona_id, topic_a, topic_b)
        );
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
    # migrações incrementais
    for migration in [
        "ALTER TABLE conversations ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE",
        "ALTER TABLE sessions ADD COLUMN persona_id TEXT",
        "ALTER TABLE sessions ADD COLUMN is_pro INTEGER DEFAULT 0",
    ]:
        try:
            conn.execute(migration)
            conn.commit()
        except Exception:
            pass
    conn.close()


def create_session(title: str, model: str, persona_id: str | None = None, is_pro: bool = False) -> int:
    conn = _connect()
    now = _now()
    cur = conn.execute(
        "INSERT INTO sessions (title, model, persona_id, is_pro, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (title, model, persona_id, 1 if is_pro else 0, now, now),
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


def get_sessions(persona_id: str | None = None, is_pro: bool | None = None) -> list[dict]:
    conn = _connect()
    conditions = []
    params = []
    if persona_id:
        conditions.append("s.persona_id = ?")
        params.append(persona_id)
    if is_pro is not None:
        conditions.append("COALESCE(s.is_pro, 0) = ?")
        params.append(1 if is_pro else 0)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = conn.execute(f"""
        SELECT s.id, s.title, s.model, s.persona_id, s.is_pro, s.created_at, s.updated_at,
               (SELECT content FROM conversations
                WHERE session_id = s.id ORDER BY timestamp DESC LIMIT 1) as preview
        FROM sessions s
        {where}
        ORDER BY s.updated_at DESC
    """, params).fetchall()
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


# ── Topic lifecycle management ────────────────────────────────────────────────

def upsert_topic(persona_id: str, topic: str, cycle: int) -> None:
    conn = _connect()
    conn.execute("""
        INSERT INTO topics (persona_id, topic, strength, research_count, last_cycle, created_at)
        VALUES (?, ?, 1.0, 1, ?, ?)
        ON CONFLICT(persona_id, topic) DO UPDATE SET
            strength = MIN(strength + 1.0, 20.0),
            research_count = research_count + 1,
            last_cycle = excluded.last_cycle
    """, (persona_id, topic, cycle, _now()))
    conn.commit()
    conn.close()


def get_topics(persona_id: str) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT topic, strength, research_count, last_cycle FROM topics WHERE persona_id = ? ORDER BY strength DESC",
        (persona_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_learner_entry(entry: dict) -> None:
    import json as _json
    conn = _connect()
    conn.execute("""
        INSERT OR IGNORE INTO learner_log
            (id, persona_id, persona_name, avatar_url, interest, insights, timestamp, discovery, synthesis, synthesis_report)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entry.get("id", _now()),
        entry.get("persona_id", ""),
        entry.get("persona", ""),
        entry.get("avatar", ""),
        entry.get("interest", ""),
        _json.dumps(entry.get("insights", []), ensure_ascii=False),
        entry.get("timestamp", _now()),
        1 if entry.get("discovery") else 0,
        1 if entry.get("synthesis") else 0,
        1 if entry.get("synthesis_report") else 0,
    ))
    conn.commit()
    conn.close()


def get_learner_history(persona_id: str | None = None, limit: int = 500) -> list[dict]:
    import json as _json
    conn = _connect()
    if persona_id:
        rows = conn.execute(
            "SELECT * FROM learner_log WHERE persona_id = ? ORDER BY timestamp DESC LIMIT ?",
            (persona_id, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM learner_log ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["insights"] = _json.loads(d["insights"] or "[]")
        except Exception:
            d["insights"] = []
        d["persona"] = d.pop("persona_name", "")
        d["avatar"] = d.pop("avatar_url", "")
        d["discovery"] = bool(d["discovery"])
        d["synthesis"] = bool(d["synthesis"])
        d["synthesis_report"] = bool(d["synthesis_report"])
        result.append(d)
    return result


def upsert_topic_edge(persona_id: str, topic_a: str, topic_b: str, weight: float = 1.0) -> None:
    a, b = sorted([topic_a, topic_b])
    conn = _connect()
    now = _now()
    conn.execute("""
        INSERT INTO topic_edges (persona_id, topic_a, topic_b, weight, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(persona_id, topic_a, topic_b) DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at
    """, (persona_id, a, b, weight, now))
    conn.commit()
    conn.close()


def get_topic_edges(persona_id: str) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT topic_a, topic_b, weight FROM topic_edges WHERE persona_id = ? ORDER BY weight DESC",
        (persona_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_topic_edges(persona_id: str) -> None:
    conn = _connect()
    conn.execute("DELETE FROM topic_edges WHERE persona_id = ?", (persona_id,))
    conn.commit()
    conn.close()


def decay_topics(persona_id: str, current_cycle: int, weak_threshold: int = 30, delete_threshold: int = 50) -> list[str]:
    """Decai tópicos não reforçados. Devolve lista de tópicos apagados."""
    conn = _connect()
    rows = conn.execute(
        "SELECT topic, last_cycle, strength FROM topics WHERE persona_id = ?",
        (persona_id,)
    ).fetchall()
    deleted = []
    for r in rows:
        idle = current_cycle - r["last_cycle"]
        if idle >= delete_threshold:
            conn.execute("DELETE FROM topics WHERE persona_id = ? AND topic = ?", (persona_id, r["topic"]))
            deleted.append(r["topic"])
        elif idle >= weak_threshold:
            # decai a força
            new_strength = max(0.1, r["strength"] * 0.7)
            conn.execute("UPDATE topics SET strength = ? WHERE persona_id = ? AND topic = ?",
                         (new_strength, persona_id, r["topic"]))
    conn.commit()
    conn.close()
    return deleted
