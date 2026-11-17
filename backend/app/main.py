"""ScanWatch API. Statistics, data generation, alerts and reports for the synthetic
medical-imaging-AI monitoring prototype. All data is synthetic; nothing here is clinical."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .reports import build_report, render_csv, render_pdf, report_brief
from .schemas import AlertPatch, ExperimentRequest, Health, ReportRequest
from .service import BadRequest, NotFound, Service
from .simulations import SIMULATION_INFO
from .store import make_store
from .util import jsonable

app = FastAPI(
    title="ScanWatch API",
    description="Educational medical AI observability prototype. Synthetic data only; not a clinical product.",
    version="1.0.0",
)
origins = [o.strip() for o in os.environ.get("SCANWATCH_CORS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

_service: Optional[Service] = None


def svc() -> Service:
    global _service
    if _service is None:
        _service = Service(make_store())
    return _service


@app.exception_handler(NotFound)
async def _nf(_: Request, exc: NotFound):
    return JSONResponse({"detail": str(exc)}, status_code=404)


@app.exception_handler(BadRequest)
async def _br(_: Request, exc: BadRequest):
    return JSONResponse({"detail": str(exc)}, status_code=400)


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    return JSONResponse({"detail": "Unexpected server error. Check the backend log."}, status_code=500)


Days = Query(None, description="Limit the current dataset to its most recent N days", ge=1, le=365)
Site = Query(None, description="Hospital identifier (e.g. HOSP-A) or 'all'")


@app.get("/health", response_model=Health, tags=["system"])
def health() -> Health:
    s = svc()
    return Health(status="ok", version=app.version, data="synthetic", persistence=s.store.mode)


@app.get("/config", tags=["system"])
def config():
    s = svc()
    return {"thresholds": s.thresholds(), "persistence": s.store.mode}


@app.post("/demo/reset", tags=["system"])
def reset_demo():
    svc().reset()
    return {"status": "reset"}


@app.get("/simulations", tags=["experiments"])
def simulations():
    return [{"id": k, **v} for k, v in SIMULATION_INFO.items()]


@app.get("/models", tags=["models"])
def models():
    return jsonable(svc().models())


@app.get("/models/{model_id}", tags=["models"])
def model_detail(model_id: str):
    return jsonable(svc().model_detail(model_id))


@app.get("/datasets/{model_id}", tags=["models"])
def datasets(model_id: str):
    return jsonable(svc().list_datasets(model_id))


@app.get("/overview", tags=["dashboard"])
def overview(days: Optional[int] = Days, site: Optional[str] = Site):
    return svc().overview(days, site)


@app.get("/performance/{model_id}", tags=["performance"])
def performance(model_id: str, days: Optional[int] = Days, site: Optional[str] = Site,
                baseline: str = "baseline", current: str = "current"):
    return svc().performance(model_id, days, site, baseline, current)


@app.get("/subgroups/{model_id}", tags=["performance"])
def subgroups(model_id: str, days: Optional[int] = Days, site: Optional[str] = Site,
              baseline: str = "baseline", current: str = "current"):
    return svc().subgroups(model_id, days, site, baseline, current)


@app.post("/experiments", tags=["experiments"], status_code=201)
def create_experiment(req: ExperimentRequest):
    return svc().run_experiment(req.model_dump())


@app.get("/experiments", tags=["experiments"])
def list_experiments(model_id: Optional[str] = None):
    return jsonable(svc().list_experiments(model_id))


@app.get("/experiments/{experiment_id}", tags=["experiments"])
def get_experiment(experiment_id: str):
    return svc().get_experiment(experiment_id)


@app.get("/alerts", tags=["alerts"])
def alerts(model_id: Optional[str] = None, status: Optional[str] = Query(None, pattern="^(open|investigating|resolved)$"),
           severity: Optional[str] = Query(None, pattern="^(info|warning|critical)$")):
    return jsonable(svc().list_alerts(model_id, status, severity))


@app.get("/alerts/{alert_id}", tags=["alerts"])
def get_alert(alert_id: str):
    return jsonable(svc().get_alert(alert_id))


@app.patch("/alerts/{alert_id}", tags=["alerts"])
def patch_alert(alert_id: str, body: AlertPatch):
    return jsonable(svc().patch_alert(alert_id, body.status, body.note, body.author))


@app.post("/reports", tags=["reports"], status_code=201)
def create_report(req: ReportRequest):
    return build_report(svc(), req)


@app.get("/reports", tags=["reports"])
def list_reports():
    rows = sorted(svc().store.all("reports"), key=lambda r: r["id"], reverse=True)
    return jsonable([report_brief(r) for r in rows])


@app.get("/reports/{report_id}/download", tags=["reports"])
def download_report(report_id: str, format: str = Query("pdf", pattern="^(pdf|csv)$")):
    r = svc().store.get("reports", report_id)
    if not r:
        raise HTTPException(404, f"Report '{report_id}' not found.")
    if format == "csv":
        return Response(render_csv(r["data"]), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="scanwatch-{report_id}.csv"'})
    return Response(render_pdf(r["data"]), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="scanwatch-{report_id}.pdf"'})
