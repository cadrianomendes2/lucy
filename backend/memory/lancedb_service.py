import os
import lancedb
import pyarrow as pa
from sentence_transformers import SentenceTransformer

DB_PATH = os.path.expanduser("~/.personal-ai/lancedb")
TABLE_NAME = "memories"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2

_model: SentenceTransformer | None = None
_db: lancedb.DBConnection | None = None
_table = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_table():
    global _db, _table
    if _db is None:
        os.makedirs(DB_PATH, exist_ok=True)
        _db = lancedb.connect(DB_PATH)
    if _table is None:
        if TABLE_NAME in _db.table_names():
            _table = _db.open_table(TABLE_NAME)
        else:
            schema = pa.schema([
                pa.field("id", pa.string()),
                pa.field("fact", pa.string()),
                pa.field("source", pa.string()),
                pa.field("timestamp", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), EMBEDDING_DIM)),
            ])
            _table = _db.create_table(TABLE_NAME, schema=schema)
    return _table


def is_duplicate(fact: str, threshold: float = 0.88) -> bool:
    """Retorna True se já existe um facto semanticamente idêntico."""
    table = _get_table()
    try:
        if table.count_rows() == 0:
            return False
    except Exception:
        return False
    model = _get_model()
    vector = model.encode(fact).tolist()
    results = table.search(vector).limit(1).to_pandas()
    if results.empty:
        return False
    # _distance em L2: 0 = idêntico. Embeddings normalizados → L2 < 0.24 ≈ cosine > 0.88
    return float(results["_distance"].iloc[0]) < 0.24


def upsert_memory(fact_id: str, fact: str, source: str, timestamp: str) -> None:
    if is_duplicate(fact):
        return
    model = _get_model()
    table = _get_table()
    vector = model.encode(fact).tolist()
    table.add([{"id": fact_id, "fact": fact, "source": source, "timestamp": timestamp, "vector": vector}])


def search_memories(query: str, top_k: int = 5, pro: bool = False) -> list[dict]:
    table = _get_table()
    try:
        row_count = table.count_rows()
    except Exception:
        return []
    if row_count == 0:
        return []
    model = _get_model()
    vector = model.encode(query).tolist()
    results = (
        table.search(vector)
        .limit(min(top_k * 3, row_count))
        .to_pandas()
    )
    # Lucy standard não vê memórias do modo Pro
    if not pro:
        results = results[~results["source"].str.startswith("pro|", na=False)]
    # Desduplicar por conteúdo
    seen: list[str] = []
    unique_rows = []
    for _, row in results.iterrows():
        fact = row["fact"].strip().lower()
        if not any(fact == s for s in seen):
            seen.append(fact)
            unique_rows.append(row)
        if len(unique_rows) >= top_k:
            break
    import pandas as pd
    if not unique_rows:
        return []
    deduped = pd.DataFrame(unique_rows)
    return deduped[["id", "fact", "source", "timestamp"]].to_dict(orient="records")


def get_all_memories() -> list[dict]:
    table = _get_table()
    try:
        df = table.to_pandas()
    except Exception:
        return []
    if df.empty:
        return []
    return df[["id", "fact", "source", "timestamp"]].to_dict(orient="records")


def delete_memory(fact_id: str) -> None:
    table = _get_table()
    table.delete(f"id = '{fact_id}'")


def wipe_all_memories() -> None:
    table = _get_table()
    try:
        table.delete("id IS NOT NULL")
    except Exception:
        pass
