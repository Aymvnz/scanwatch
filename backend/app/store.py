"""Persistence. LocalStore (JSON file) is the default and needs no credentials.
SupabaseStore writes through to Postgres via PostgREST when SUPABASE_URL and
SUPABASE_SERVICE_KEY are set in the *backend* environment. The service-role key is
never sent to the browser."""
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path

COLLECTIONS = ("experiments", "alerts", "reports")


def _empty() -> dict:
    return {"experiments": {}, "alerts": {}, "reports": {}, "activity": []}


class LocalStore:
    mode = "local"

    def __init__(self, path: str | None = None):
        self.path = Path(path or os.environ.get("SCANWATCH_STATE", Path(__file__).resolve().parent.parent / "data" / "state.json"))
        self.lock = threading.RLock()
        self.data = _empty()
        self.loaded_existing = False
        if self.path.exists():
            try:
                loaded = json.loads(self.path.read_text())
                if all(k in loaded for k in _empty()):
                    self.data, self.loaded_existing = loaded, True
            except (OSError, json.JSONDecodeError):
                pass  # corrupt state file: start from seeded state

    def is_empty(self) -> bool:
        return not self.loaded_existing and not self.data["alerts"] and not self.data["activity"]

    def _flush(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, suffix=".tmp")
        with os.fdopen(fd, "w") as fh:
            json.dump(self.data, fh)
        os.replace(tmp, self.path)

    def all(self, coll: str) -> list[dict]:
        with self.lock:
            return list(self.data[coll].values())

    def get(self, coll: str, key: str):
        with self.lock:
            return self.data[coll].get(key)

    def put(self, coll: str, key: str, obj: dict) -> None:
        with self.lock:
            self.data[coll][key] = obj
            self._flush()

    def activity(self) -> list[dict]:
        with self.lock:
            return list(self.data["activity"])

    def add_activity(self, entry: dict) -> None:
        with self.lock:
            self.data["activity"].append(entry)
            self._flush()

    def reset(self) -> None:
        with self.lock:
            self.data = _empty()
            self.loaded_existing = False
            self._flush()


class SupabaseStore(LocalStore):
    """Write-through adapter: keeps the in-memory/local copy and mirrors every write to
    Supabase tables (see supabase/schema.sql). Reads at start-up come from Supabase.
    NOTE: not exercised against a live Supabase project in this prototype's test suite."""
    mode = "supabase"

    def __init__(self, url: str, key: str, path: str | None = None):
        import httpx
        super().__init__(path)
        self.http = httpx.Client(base_url=url.rstrip("/") + "/rest/v1", timeout=10, headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"})
        self._pull()

    def _post(self, table: str, rows: list[dict]) -> None:
        try:
            self.http.post(f"/{table}", json=rows).raise_for_status()
        except Exception as exc:  # persistence is best-effort; local copy remains authoritative
            print(f"[scanwatch] Supabase write to {table} failed: {exc}")

    def _pull(self) -> None:
        try:
            for coll in COLLECTIONS:
                rows = self.http.get(f"/{coll}", params={"select": "id,payload"}).json()
                if isinstance(rows, list) and rows:
                    self.data[coll] = {r["id"]: r["payload"] for r in rows}
            act = self.http.get("/activity_log", params={"select": "payload", "order": "created_at.asc"}).json()
            if isinstance(act, list) and act:
                self.data["activity"] = [r["payload"] for r in act]
            self.loaded_existing = bool(self.data["alerts"])
        except Exception as exc:
            print(f"[scanwatch] Supabase read failed, using local state: {exc}")

    def put(self, coll, key, obj):
        super().put(coll, key, obj)
        if coll == "experiments":
            self._post("experiments", [{"id": key, "model_id": obj["config"]["model_id"], "created_at": obj["created_at"],
                                        "config": obj["config"], "payload": {k: v for k, v in obj.items() if k != "result"}}])
            self._post("experiment_results", [{"experiment_id": key, "result": obj.get("result")}])
        elif coll == "alerts":
            self._post("alerts", [{"id": key, "model_id": obj["model_id"], "created_at": obj["created_at"],
                                   "type": obj["type"], "severity": obj["severity"], "status": obj["status"], "payload": obj}])
            if obj.get("notes"):
                self._post("investigation_notes", [{"id": n["id"], "alert_id": key, "created_at": n["at"],
                                                    "author": n["author"], "body": n["text"]} for n in obj["notes"]])
        elif coll == "reports":
            self._post("reports", [{"id": key, "model_id": obj["model_id"], "created_at": obj["created_at"], "payload": obj}])

    def add_activity(self, entry):
        super().add_activity(entry)
        self._post("activity_log", [{"id": entry["id"], "created_at": entry["at"], "payload": entry}])

    def reset(self):
        super().reset()
        for t in ("investigation_notes", "experiment_results", "alerts", "experiments", "reports", "activity_log"):
            try:
                self.http.delete(f"/{t}", params={"id" if t != "experiment_results" else "experiment_id": "neq.__none__"})
            except Exception as exc:
                print(f"[scanwatch] Supabase reset of {t} failed: {exc}")


def make_store(path: str | None = None):
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        return SupabaseStore(url, key, path)
    return LocalStore(path)
