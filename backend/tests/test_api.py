import pytest
from fastapi.testclient import TestClient

from app import main
from app.service import Service
from app.store import LocalStore

CXR = "chest-xray-classifier"


@pytest.fixture()
def client(tmp_path):
    main._service = Service(LocalStore(str(tmp_path / "state.json")))
    return TestClient(main.app)


def test_health_and_models(client):
    assert client.get("/health").json()["data"] == "synthetic"
    ms = {m["id"]: m for m in client.get("/models").json()}
    assert ms[CXR]["status"] == "healthy" and ms["lung-finding-classifier"]["status"] == "healthy"
    assert ms["imaging-triage-model"]["status"] == "warning"


def test_overview_is_consistent_with_alerts(client):
    ov = client.get("/overview").json()
    alerts = client.get("/alerts").json()
    active = [a for a in alerts if a["status"] != "resolved"]
    assert ov["metrics"]["active_alerts"] == len(active)
    assert sum(ov["alerts_by_severity"].values()) == len(active)
    assert ov["metrics"]["healthy_models"] == sum(m["status"] == "healthy" for m in ov["models"])
    assert ov["metrics"]["experiments_run"] == 0 and len(ov["performance_trend"]) > 5


def test_overview_is_stable_across_calls(client):
    assert client.get("/overview").json() == client.get("/overview").json()


def test_performance_endpoint(client):
    p = client.get(f"/performance/{CXR}").json()
    m = p["current"]["metrics"]
    assert m["tp"] + m["fn"] == m["positives"] and 0 < m["sensitivity"] < 1
    assert p["current"]["dataset"]["n"] >= 2000
    short = client.get(f"/performance/{CXR}?days=30").json()
    assert short["current"]["dataset"]["n"] < p["current"]["dataset"]["n"]
    assert client.get("/performance/nope").status_code == 404
    assert client.get(f"/performance/{CXR}?site=ZZZ").status_code == 400


def test_subgroups_endpoint_flags_low_samples(client):
    s = client.get(f"/subgroups/{CXR}?days=7").json()
    assert len(s["groups"]) == 6 and s["low_sample_groups"]
    full = client.get(f"/subgroups/{CXR}").json()
    assert not full["low_sample_groups"]


def test_demo_flow_equipment_change_creates_drift_alert_only(client):
    r = client.post("/experiments", json={"model_id": CXR, "simulation": "imaging_equipment", "intensity": 0.8})
    assert r.status_code == 201
    exp = r.json()
    types = {a["type"] for a in exp["alerts"]}
    assert "data_drift" in types and "performance_decline" not in types
    assert any(f["feature"] == "image_feature_1" and f["drifted"] for f in exp["drift"]["features"])
    assert exp["performance"]["current"]["sensitivity"] == pytest.approx(client.get(f"/performance/{CXR}").json()["current"]["metrics"]["sensitivity"])
    # the alert exists, can be investigated and resolved, and history is kept
    aid = exp["alerts"][0]["id"]
    assert client.get(f"/alerts/{aid}").json()["source"]["experiment_id"] == exp["id"]
    a = client.patch(f"/alerts/{aid}", json={"status": "investigating", "note": "Checking scanner change log."}).json()
    assert a["status"] == "investigating" and a["notes"][0]["text"].startswith("Checking")
    a = client.patch(f"/alerts/{aid}", json={"status": "resolved"}).json()
    assert [h["event"] for h in a["history"]] == ["created", "status_changed", "note_added", "status_changed"]
    # model status follows alerts
    assert client.get("/overview").json()["metrics"]["experiments_run"] == 1


def test_model_goes_unhealthy_then_recovers_when_alerts_resolved(client):
    exp = client.post("/experiments", json={"model_id": CXR, "simulation": "imaging_equipment", "intensity": 1.0}).json()
    status = lambda: {m["id"]: m["status"] for m in client.get("/models").json()}[CXR]
    assert status() in ("warning", "critical")
    for a in exp["alerts"]:
        client.patch(f"/alerts/{a['id']}", json={"status": "resolved"})
    assert status() == "healthy"


def test_performance_degradation_experiment(client):
    exp = client.post("/experiments", json={"model_id": CXR, "simulation": "performance_degradation", "intensity": 0.8}).json()
    assert exp["performance"]["deltas"]["sensitivity"] < -0.15
    assert {a["type"] for a in exp["alerts"]} >= {"performance_decline"}
    assert exp["drift"]["overall"]["n_drifted"] <= 1   # only the score may move; inputs untouched


def test_experiments_are_reproducible_and_do_not_change_baseline(client):
    body = {"model_id": CXR, "simulation": "hospital_workflow", "intensity": 0.5, "seed": 5}
    a, b = client.post("/experiments", json=body).json(), client.post("/experiments", json=body).json()
    assert a["drift"] == b["drift"] and a["performance"] == b["performance"]
    assert a["id"] != b["id"]
    before = client.get(f"/performance/{CXR}").json()["baseline"]
    client.post("/experiments", json={**body, "simulation": "patient_population"})
    assert client.get(f"/performance/{CXR}").json()["baseline"] == before


def test_experiment_dataset_usable_downstream(client):
    exp = client.post("/experiments", json={"model_id": CXR, "simulation": "performance_degradation", "intensity": 0.8}).json()
    ds = [d["id"] for d in client.get(f"/datasets/{CXR}").json()]
    assert f"exp:{exp['id']}" in ds
    p = client.get(f"/performance/{CXR}?current=exp:{exp['id']}").json()
    assert p["current"]["metrics"]["sensitivity"] == pytest.approx(exp["performance"]["current"]["sensitivity"])
    assert client.get(f"/performance/{CXR}?current=exp:EXP-9999").status_code == 404


def test_validation_errors(client):
    assert client.post("/experiments", json={"model_id": CXR, "simulation": "bogus"}).status_code == 422
    assert client.post("/experiments", json={"model_id": CXR, "simulation": "imaging_equipment", "intensity": 5}).status_code == 422
    assert client.post("/experiments", json={"model_id": "nope", "simulation": "imaging_equipment"}).status_code == 404
    aid = client.get("/alerts").json()[0]["id"]
    assert client.patch(f"/alerts/{aid}", json={}).status_code == 422
    assert client.patch("/alerts/ALT-9999", json={"status": "resolved"}).status_code == 404


def test_reset_restores_seeded_state(client):
    initial = client.get("/overview").json()
    exp = client.post("/experiments", json={"model_id": CXR, "simulation": "imaging_equipment"}).json()
    client.patch(f"/alerts/{exp['alerts'][0]['id']}", json={"status": "resolved"})
    client.post("/demo/reset")
    assert client.get("/overview").json() == initial
    assert client.get("/experiments").json() == []


def test_state_persists_across_restart(tmp_path):
    path = str(tmp_path / "s.json")
    s1 = Service(LocalStore(path))
    exp = s1.run_experiment({"model_id": CXR, "baseline_dataset_id": "baseline", "current_dataset_id": "current",
                             "simulation": "imaging_equipment", "intensity": 0.7, "seed": 1})
    s1.patch_alert(exp["alerts"][0]["id"], "investigating", "note", "tester")
    s2 = Service(LocalStore(path))
    assert [a["id"] for a in s2.list_alerts(model_id=CXR)] == [a["id"] for a in s1.list_alerts(model_id=CXR)]
    assert s2.get_alert(exp["alerts"][0]["id"])["status"] == "investigating"
    assert s2.get_experiment(exp["id"])["config"]["seed"] == 1
    assert s2.get_dataset(CXR, f"exp:{exp['id']}").equals(s1.get_dataset(CXR, f"exp:{exp['id']}"))


def test_report_pdf_and_csv(client):
    exp = client.post("/experiments", json={"model_id": CXR, "simulation": "imaging_equipment", "intensity": 0.8}).json()
    r = client.post("/reports", json={"model_id": CXR, "experiment_id": exp["id"]})
    assert r.status_code == 201
    rid = r.json()["id"]
    pdf = client.get(f"/reports/{rid}/download?format=pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF" and len(pdf.content) > 20000
    csv_text = client.get(f"/reports/{rid}/download?format=csv").text
    assert "synthetic data" in csv_text.lower() and "performance,Sensitivity" in csv_text and "drift_feature" in csv_text
    plain = client.post("/reports", json={"model_id": CXR, "days": 30}).json()
    assert plain["period"]["days"] == 30 and plain["experiment"] is None
    assert len(client.get("/reports").json()) == 2
    assert client.get("/reports/RPT-9999/download").status_code == 404
