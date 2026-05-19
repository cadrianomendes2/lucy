import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.expanduser("~/.personal-ai/knowledge_graph.db")
KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "..", "knowledge", "domains")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_graph() -> None:
    os.makedirs(KNOWLEDGE_DIR, exist_ok=True)
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS graph_nodes (
            id         TEXT PRIMARY KEY,
            label      TEXT NOT NULL,
            type       TEXT DEFAULT 'concept',
            domain     TEXT,
            weight     REAL DEFAULT 1.0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS graph_edges (
            id         TEXT PRIMARY KEY,
            source_id  TEXT NOT NULL REFERENCES graph_nodes(id),
            target_id  TEXT NOT NULL REFERENCES graph_nodes(id),
            relation   TEXT NOT NULL,
            weight     REAL DEFAULT 1.0,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges(target_id);
        CREATE INDEX IF NOT EXISTS idx_nodes_domain ON graph_nodes(domain);
    """)
    conn.commit()
    conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_node(node_id: str, label: str, node_type: str = "concept", domain: str | None = None, weight: float = 1.0) -> None:
    conn = _connect()
    now = _now()
    conn.execute("""
        INSERT INTO graph_nodes (id, label, type, domain, weight, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            label=excluded.label, type=excluded.type,
            domain=excluded.domain, weight=excluded.weight, updated_at=excluded.updated_at
    """, (node_id, label, node_type, domain, weight, now, now))
    conn.commit()
    conn.close()


def upsert_edge(source_id: str, target_id: str, relation: str, weight: float = 1.0) -> None:
    edge_id = f"{source_id}_{relation}_{target_id}"
    conn = _connect()
    conn.execute("""
        INSERT OR REPLACE INTO graph_edges (id, source_id, target_id, relation, weight, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (edge_id, source_id, target_id, relation, weight, _now()))
    conn.commit()
    conn.close()


def traverse(start_ids: list[str], hops: int = 2) -> list[dict]:
    """BFS de até N hops a partir dos nós iniciais."""
    if not start_ids:
        return []
    conn = _connect()
    visited = set(start_ids)
    frontier = set(start_ids)
    results = []

    rows = conn.execute(
        f"SELECT * FROM graph_nodes WHERE id IN ({','.join('?'*len(start_ids))})",
        start_ids
    ).fetchall()
    results.extend([dict(r) for r in rows])

    for _ in range(hops):
        if not frontier:
            break
        placeholders = ",".join("?" * len(frontier))
        edges = conn.execute(
            f"SELECT * FROM graph_edges WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})",
            list(frontier) + list(frontier)
        ).fetchall()

        next_frontier = set()
        for e in edges:
            for nid in (e["source_id"], e["target_id"]):
                if nid not in visited:
                    visited.add(nid)
                    next_frontier.add(nid)

        if next_frontier:
            ph = ",".join("?" * len(next_frontier))
            nodes = conn.execute(f"SELECT * FROM graph_nodes WHERE id IN ({ph})", list(next_frontier)).fetchall()
            results.extend([dict(r) for r in nodes])

        frontier = next_frontier

    conn.close()
    return results


def get_all_nodes() -> list[dict]:
    conn = _connect()
    rows = conn.execute("SELECT * FROM graph_nodes ORDER BY weight DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_edges() -> list[dict]:
    conn = _connect()
    rows = conn.execute("SELECT * FROM graph_edges ORDER BY weight DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_domains() -> list[str]:
    conn = _connect()
    rows = conn.execute("SELECT DISTINCT domain FROM graph_nodes WHERE domain IS NOT NULL").fetchall()
    conn.close()
    return [r["domain"] for r in rows]


# --- Ficheiros de conhecimento ---

def domain_path(domain: str) -> str:
    safe = domain.lower().replace(" ", "_").replace("/", "_")
    path = os.path.join(KNOWLEDGE_DIR, safe)
    os.makedirs(path, exist_ok=True)
    return path


def read_essence(domain: str) -> str:
    path = os.path.join(domain_path(domain), "essence.txt")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def write_essence(domain: str, content: str) -> None:
    with open(os.path.join(domain_path(domain), "essence.txt"), "w", encoding="utf-8") as f:
        f.write(content)


def read_summary(domain: str) -> str:
    path = os.path.join(domain_path(domain), "summary.md")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def write_summary(domain: str, content: str) -> None:
    with open(os.path.join(domain_path(domain), "summary.md"), "w", encoding="utf-8") as f:
        f.write(content)


def read_full(domain: str) -> str:
    path = os.path.join(domain_path(domain), "full.md")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def write_full(domain: str, content: str) -> None:
    with open(os.path.join(domain_path(domain), "full.md"), "w", encoding="utf-8") as f:
        f.write(content)


def get_knowledge_context(domains: list[str], level: str = "summary") -> str:
    """Agrega conhecimento de múltiplos domínios num bloco de contexto."""
    parts = []
    for domain in domains:
        if level == "essence":
            text = read_essence(domain)
        elif level == "full":
            text = read_full(domain) or read_summary(domain)
        else:
            text = read_summary(domain) or read_essence(domain)
        if text:
            parts.append(f"## {domain.capitalize()}\n{text}")
    return "\n\n".join(parts)
