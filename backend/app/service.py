"""Application service: orchestrates data, statistics, alerts and persistence.
Statistical calculations live in the other modules; this file only wires them together."""
from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from .alert_rules import evaluate_alerts
from .config import SEED_TIMESTAMP, THRESHOLDS
from .drift import compute_drift, mean_psi_weekly
from .interpret import interpret
from .metrics import METRIC_DEFINITIONS, compute_metrics
from .simulations import SIMULATION_INFO, apply_simulation
from .store import LocalStore
from .subgroups import compare_subgroups, subgroup_metrics
from .synth import HOSPITALS, MODEL_SPECS, seeded_dataset
from .util import jsonable

ALERT_TYPE_LABELS = {
    "data_drift": "Data drift detected", "performance_decline": "Performance decline detected",
    "subgroup_difference": "Subgroup performance difference detected", "missing_data": "Missing data increased",
    "sample_size": "Sample size insufficient",
}
SEVERITY_RANK = {"critical": 3, "warning": 2, "info": 1}


class NotFound(Exception):
    pass


class BadRequest(Exception):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def slice_df(df: pd.DataFrame, days: int | None = None, site: str | None = None) -> pd.DataFrame:
    if site and site != "all":
        if site not in HOSPITALS:
            raise BadRequest(f"Unknown site '{site}'.")
        df = df[df["hospital_id"] == site]
    if days:
        cutoff = df["date"].max() - pd.Timedelta(days=days - 1)
        df = df[df["date"] >= cutoff]
    return df


def dataset_brief(df: pd.DataFrame, ds_id: str, label: str) -> dict:
    return {"id": ds_id, "label": label, "n": int(len(df)),
            "start": df["date"].min().date().isoformat() if len(df) else None,
            "end": df["date"].max().date().isoformat() if len(df) else None}


class Service:
    def __init__(self, store: LocalStore):
        self.store = store
        self._exp_ds: dict[tuple, pd.DataFrame] = {}
        self._monitor: dict[str, dict] = {}
        if store.is_empty():
            self.seed()

    # ---------- seeding / reset ----------
    def seed(self) -> None:
        self.store.reset()
        self._exp_ds.clear(); self._monitor.clear()
        for mid, spec in MODEL_SPECS.items():
            mon = self.monitoring(mid)
            self._activity("monitoring_check", f"Scheduled monitoring check completed for {spec.name}.", mid, SEED_TIMESTAMP)
            for draft in evaluate_alerts(mon["base_m"], mon["cur_m"], mon["drift"], mon["base_sub"], mon["cur_sub"]):
                self._create_alert(mid, draft, {"type": "monitoring", "label": "Scheduled monitoring check"}, SEED_TIMESTAMP)

    def reset(self) -> None:
        self.seed()

    # ---------- ids / activity ----------
    def _next_id(self, prefix: str, coll: str) -> str:
        nums = [int(k.split("-")[1]) for k in self.store.data[coll] if k.startswith(prefix + "-")]
        return f"{prefix}-{(max(nums) if nums else 0) + 1:04d}"

    def _activity(self, kind: str, text: str, model_id: str | None, at: str | None = None, link: str | None = None) -> None:
        n = len(self.store.activity()) + 1
        self.store.add_activity({"id": f"ACT-{n:04d}", "at": at or now_iso(), "type": kind, "text": text, "model_id": model_id, "link": link})

    def _create_alert(self, model_id: str, draft: dict, source: dict, at: str) -> dict:
        aid = self._next_id("ALT", "alerts")
        alert = {**draft, "id": aid, "model_id": model_id, "model_name": MODEL_SPECS[model_id].name, "created_at": at,
                 "status": "open", "source": source, "notes": [],
                 "history": [{"at": at, "event": "created", "detail": f"Alert created by {source['label'].lower()}.", "author": "ScanWatch"}]}
        self.store.put("alerts", aid, alert)
        self._activity("alert_created", f"{ALERT_TYPE_LABELS[draft['type']]} ({draft['severity']}) for {alert['model_name']}.", model_id, at, link=f"/alerts?id={aid}")
        return alert

    # ---------- datasets ----------
    def _spec(self, model_id: str):
        if model_id not in MODEL_SPECS:
            raise NotFound(f"Model '{model_id}' not found.")
        return MODEL_SPECS[model_id]

    def get_dataset(self, model_id: str, ds_id: str) -> pd.DataFrame:
        self._spec(model_id)
        if ds_id in ("baseline", "current"):
            return seeded_dataset(model_id, ds_id)
        if ds_id.startswith("exp:"):
            key = (model_id, ds_id)
            if key in self._exp_ds:
                return self._exp_ds[key]
            exp = self.store.get("experiments", ds_id[4:])
            if not exp or exp["config"]["model_id"] != model_id:
                raise NotFound(f"Dataset '{ds_id}' not found for this model.")
            cfg = exp["config"]
            src = self.get_dataset(model_id, cfg["current_dataset_id"])
            df, _ = apply_simulation(src, cfg["simulation"], cfg["intensity"], cfg["seed"])
            self._exp_ds[key] = df
            return df
        raise NotFound(f"Dataset '{ds_id}' not found.")

    def list_datasets(self, model_id: str) -> list[dict]:
        out = []
        for ds_id, label in (("baseline", "Baseline (reference, Jun–Aug 2026)"), ("current", "Current period (Sep–Nov 2026)")):
            out.append({**dataset_brief(self.get_dataset(model_id, ds_id), ds_id, label), "kind": ds_id})
        for exp in sorted(self.store.all("experiments"), key=lambda e: e["id"]):
            if exp["config"]["model_id"] == model_id:
                cfg = exp["config"]
                label = f"{exp['id']}: {SIMULATION_INFO[cfg['simulation']]['label']} ({cfg['intensity']:.2f})"
                out.append({**dataset_brief(self.get_dataset(model_id, f"exp:{exp['id']}"), f"exp:{exp['id']}", label), "kind": "experiment"})
        return out

    def _label(self, model_id: str, ds_id: str) -> str:
        return next((d["label"] for d in self.list_datasets(model_id) if d["id"] == ds_id), ds_id)

    # ---------- monitoring (seeded baseline vs seeded current) ----------
    def monitoring(self, model_id: str) -> dict:
        if model_id not in self._monitor:
            b, c = seeded_dataset(model_id, "baseline"), seeded_dataset(model_id, "current")
            self._monitor[model_id] = {
                "base_m": compute_metrics(b), "cur_m": compute_metrics(c),
                "drift": compute_drift(b, c, seed=0, n_perm=100),
                "base_sub": subgroup_metrics(b), "cur_sub": subgroup_metrics(c)}
        return self._monitor[model_id]

    # ---------- alerts ----------
    def model_status(self, model_id: str) -> str:
        sev = [a["severity"] for a in self.store.all("alerts") if a["model_id"] == model_id and a["status"] != "resolved"]
        return "critical" if "critical" in sev else "warning" if "warning" in sev else "healthy"

    def list_alerts(self, model_id=None, status=None, severity=None) -> list[dict]:
        rows = self.store.all("alerts")
        if model_id: rows = [a for a in rows if a["model_id"] == model_id]
        if status: rows = [a for a in rows if a["status"] == status]
        if severity: rows = [a for a in rows if a["severity"] == severity]
        rows.sort(key=lambda a: (a["created_at"], a["id"]), reverse=True)
        return [self._alert_out(a) for a in rows]

    @staticmethod
    def _alert_out(a: dict) -> dict:
        return {**a, "type_label": ALERT_TYPE_LABELS[a["type"]]}

    def get_alert(self, alert_id: str) -> dict:
        a = self.store.get("alerts", alert_id)
        if not a:
            raise NotFound(f"Alert '{alert_id}' not found.")
        return self._alert_out(a)

    def patch_alert(self, alert_id: str, status: str | None, note: str | None, author: str) -> dict:
        a = self.store.get("alerts", alert_id)
        if not a:
            raise NotFound(f"Alert '{alert_id}' not found.")
        at = now_iso()
        a = {**a, "notes": list(a["notes"]), "history": list(a["history"])}
        if status and status != a["status"]:
            a["history"].append({"at": at, "event": "status_changed", "detail": f"Status changed from {a['status']} to {status}.", "author": author})
            a["status"] = status
            self._activity("alert_status", f"Alert {alert_id} marked {status}.", a["model_id"], at, link=f"/alerts?id={alert_id}")
        if note and note.strip():
            nid = f"NOTE-{alert_id[4:]}-{len(a['notes']) + 1}"
            a["notes"].append({"id": nid, "at": at, "author": author, "text": note.strip()})
            a["history"].append({"at": at, "event": "note_added", "detail": note.strip(), "author": author})
            self._activity("alert_note", f"Investigation note added to {alert_id}.", a["model_id"], at, link=f"/alerts?id={alert_id}")
        self.store.put("alerts", alert_id, a)
        return self._alert_out(a)

    # ---------- models ----------
    def _summary(self, model_id: str) -> dict:
        spec = self._spec(model_id)
        cur = seeded_dataset(model_id, "current")
        m = compute_metrics(cur, with_calibration=False)
        alerts = [a for a in self.store.all("alerts") if a["model_id"] == model_id and a["status"] != "resolved"]
        return {"id": spec.id, "identifier": spec.identifier, "name": spec.name, "purpose": spec.purpose,
                "modality": spec.modality, "version": spec.version, "status": self.model_status(model_id),
                "last_monitored": cur["date"].max().date().isoformat(), "open_alerts": len(alerts),
                "latest": {k: m[k] for k in ("n", "sensitivity", "specificity", "accuracy", "precision")}}

    def models(self) -> list[dict]:
        return [self._summary(m) for m in MODEL_SPECS]

    def model_detail(self, model_id: str) -> dict:
        mon = self.monitoring(model_id)
        exps = [self._exp_brief(e) for e in self.store.all("experiments") if e["config"]["model_id"] == model_id]
        exps.sort(key=lambda e: e["id"], reverse=True)
        return {"summary": self._summary(model_id), "performance": self.performance(model_id),
                "drift": mon["drift"], "subgroups": self.subgroups(model_id),
                "experiments": exps, "alerts": self.list_alerts(model_id=model_id)}

    # ---------- performance / subgroups ----------
    def _pair(self, model_id, days, site, baseline_id, current_id):
        base = slice_df(self.get_dataset(model_id, baseline_id), None, site)
        cur = slice_df(self.get_dataset(model_id, current_id), days, site)
        if len(base) == 0 or len(cur) == 0:
            raise BadRequest("No records match the selected filters.")
        return base, cur

    def _weekly(self, base: pd.DataFrame, cur: pd.DataFrame) -> list[dict]:
        rows = []
        wk = cur["date"].dt.to_period("W-SUN").dt.start_time
        for start, g in cur.groupby(wk):
            if len(g) < 40:
                continue
            m = compute_metrics(g, with_calibration=False)
            rows.append({"week": start.date().isoformat(), "n": m["n"], "positives": m["positives"],
                         "sensitivity": m["sensitivity"], "specificity": m["specificity"], "accuracy": m["accuracy"],
                         "mean_psi": mean_psi_weekly(base, g)})
        return rows

    def performance(self, model_id, days=None, site=None, baseline_id="baseline", current_id="current") -> dict:
        base, cur = self._pair(model_id, days, site, baseline_id, current_id)
        bm, cm = compute_metrics(base), compute_metrics(cur)
        keys = ("accuracy", "sensitivity", "specificity", "precision", "fnr", "fpr", "f1")
        deltas = {k: (None if bm[k] is None or cm[k] is None else cm[k] - bm[k]) for k in keys}
        return jsonable({
            "model": self._summary(model_id),
            "baseline": {"dataset": dataset_brief(base, baseline_id, self._label(model_id, baseline_id)), "metrics": bm},
            "current": {"dataset": dataset_brief(cur, current_id, self._label(model_id, current_id)), "metrics": cm},
            "deltas": deltas, "trend": self._weekly(base, cur), "definitions": METRIC_DEFINITIONS,
            "label_note": "Performance needs confirmed outcome labels, which often arrive days or weeks after a prediction. Recent periods may therefore be incomplete.",
        })

    def subgroups(self, model_id, days=None, site=None, baseline_id="baseline", current_id="current") -> dict:
        base, cur = self._pair(model_id, days, site, baseline_id, current_id)
        rows = compare_subgroups(base, cur)
        return jsonable({"model": self._summary(model_id), "groups": rows,
                         "overall": {"baseline": compute_metrics(base, False), "current": compute_metrics(cur, False)},
                         "low_sample_groups": [r["group"] for r in rows if r["current"]["low_sample"]],
                         "baseline_dataset": dataset_brief(base, baseline_id, self._label(model_id, baseline_id)),
                         "current_dataset": dataset_brief(cur, current_id, self._label(model_id, current_id))})

    # ---------- overview ----------
    def overview(self, days=None, site=None) -> dict:
        models = self.models()
        perf_rows: dict[str, dict] = {}
        drift_rows: dict[str, dict] = {}
        subgroup_rows = []
        for mid in MODEL_SPECS:
            base, cur = self._pair(mid, days, site, "baseline", "current")
            for w in self._weekly(base, cur):
                perf_rows.setdefault(w["week"], {"week": w["week"]})[mid] = w["sensitivity"]
                drift_rows.setdefault(w["week"], {"week": w["week"]})[mid] = w["mean_psi"]
            for g in subgroup_metrics(cur):
                subgroup_rows.append({"model_id": mid, **{k: g[k] for k in ("group", "sensitivity", "n", "positives", "low_sample")}})
        alerts = self.list_alerts()
        active = [a for a in alerts if a["status"] != "resolved"]
        by_sev = {s: sum(1 for a in active if a["severity"] == s) for s in ("info", "warning", "critical")}
        exps = self.store.all("experiments")
        act = sorted(self.store.activity(), key=lambda a: (a["at"], a["id"]), reverse=True)[:8]
        return jsonable({
            "metrics": {"monitored_models": len(models), "healthy_models": sum(1 for m in models if m["status"] == "healthy"),
                        "active_alerts": len(active), "experiments_run": len(exps)},
            "models": models, "performance_trend": [perf_rows[k] for k in sorted(perf_rows)],
            "drift_trend": [drift_rows[k] for k in sorted(drift_rows)], "alerts_by_severity": by_sev,
            "subgroup_performance": subgroup_rows, "recent_alerts": alerts[:5], "recent_activity": act,
            "filters": {"days": days, "site": site or "all", "sites": HOSPITALS},
        })

    # ---------- experiments ----------
    def _exp_brief(self, e: dict) -> dict:
        r = e["result"]
        cfg = e["config"]
        return {"id": e["id"], "created_at": e["created_at"], "model_id": cfg["model_id"],
                "simulation": cfg["simulation"], "simulation_label": SIMULATION_INFO[cfg["simulation"]]["label"],
                "intensity": cfg["intensity"], "n_drifted": r["drift"]["overall"]["n_drifted"],
                "n_features_tested": r["drift"]["overall"]["n_features_tested"], "alert_ids": [a["id"] for a in r["alerts"]],
                "headline": r["interpretation"]["headline"]}

    def list_experiments(self, model_id=None) -> list[dict]:
        rows = [self._exp_brief(e) for e in self.store.all("experiments") if not model_id or e["config"]["model_id"] == model_id]
        return sorted(rows, key=lambda e: e["id"], reverse=True)

    def get_experiment(self, exp_id: str) -> dict:
        e = self.store.get("experiments", exp_id)
        if not e:
            raise NotFound(f"Experiment '{exp_id}' not found.")
        return {"id": e["id"], "created_at": e["created_at"], "config": e["config"], **e["result"]}

    def run_experiment(self, cfg: dict) -> dict:
        mid = cfg["model_id"]
        self._spec(mid)
        base = self.get_dataset(mid, cfg["baseline_dataset_id"])
        src = self.get_dataset(mid, cfg["current_dataset_id"])
        eid = self._next_id("EXP", "experiments")
        new_df, params = apply_simulation(src, cfg["simulation"], cfg["intensity"], cfg["seed"])
        drift = compute_drift(base, new_df, seed=cfg["seed"], n_perm=200)
        bm, cm = compute_metrics(base), compute_metrics(new_df)
        bsub, csub = subgroup_metrics(base), subgroup_metrics(new_df)
        drafts = evaluate_alerts(bm, cm, drift, bsub, csub)
        at = now_iso()
        self._exp_ds[(mid, f"exp:{eid}")] = new_df
        sim = SIMULATION_INFO[cfg["simulation"]]
        alerts = [self._create_alert(mid, d, {"type": "experiment", "experiment_id": eid, "label": f"experiment {eid}"}, at) for d in drafts]
        interp = interpret(cfg["simulation"], cfg["intensity"], drift, bm, cm, drafts)
        result = jsonable({
            "model": self._summary(mid),
            "simulation": {"id": cfg["simulation"], **sim, "parameters": params},
            "datasets": {"baseline": dataset_brief(base, cfg["baseline_dataset_id"], self._label(mid, cfg["baseline_dataset_id"])),
                         "source": dataset_brief(src, cfg["current_dataset_id"], self._label(mid, cfg["current_dataset_id"])),
                         "current": {**dataset_brief(new_df, f"exp:{eid}", f"{eid}: {sim['label']}")}},
            "drift": drift,
            "performance": {"baseline": bm, "current": cm,
                            "deltas": {k: (None if bm[k] is None or cm[k] is None else cm[k] - bm[k]) for k in ("accuracy", "sensitivity", "specificity", "precision", "fnr", "fpr", "f1")}},
            "subgroups": [{"group": b["group"], "dimension": b["dimension"], "baseline": b, "current": c} for b, c in zip(bsub, csub)],
            "alerts": [self._alert_out(a) for a in alerts], "interpretation": interp,
        })
        self.store.put("experiments", eid, {"id": eid, "created_at": at, "config": cfg, "result": result})
        self._activity("experiment", f"{sim['label']} experiment {eid} run on {MODEL_SPECS[mid].name} ({len(alerts)} alert{'s' if len(alerts) != 1 else ''}).", mid, at, link=f"/drift-lab?experiment={eid}")
        return {"id": eid, "created_at": at, "config": cfg, **result}

    def thresholds(self) -> dict:
        return THRESHOLDS.as_dict()
