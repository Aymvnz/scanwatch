"""Monitoring report generation (PDF and CSV). Reports describe synthetic data only."""
from __future__ import annotations

import csv
import io

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from reportlab.lib import colors  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import cm  # noqa: E402
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle  # noqa: E402

from .drift import compute_drift  # noqa: E402
from .interpret import LIMITATIONS  # noqa: E402
from .service import Service, BadRequest, now_iso  # noqa: E402
from .util import jsonable  # noqa: E402

PRIMARY, NAVY, MUTED, LINE = "#246B8E", "#18354A", "#5F7587", "#E3E9EF"
DISCLAIMER = ("This report is based entirely on synthetic data generated for demonstration. It is not clinical validation, "
              "does not diagnose patients, and must not be used to make clinical or operational decisions.")
METHODOLOGY = [
    "Datasets: a reference (baseline) dataset and a current dataset of synthetic imaging cases, each with model predictions, prediction scores and synthetic confirmed outcomes.",
    "Performance: sensitivity, specificity, precision, accuracy, false-negative and false-positive rates and F1 are computed from the confusion matrix. Metrics with a zero denominator are reported as unavailable.",
    "Calibration: expected calibration error (10 equal-width score bins) and Brier score.",
    "Drift: Kolmogorov–Smirnov test for numeric features, chi-square for categorical features and missing-value rates, and Population Stability Index (PSI) with deciles taken from the reference data (empty bins are smoothed). Maximum Mean Discrepancy (RBF kernel, permutation p-value) is reported as an advanced joint test.",
    "Multiple comparisons: p-values are Bonferroni-adjusted across all compared features. A feature is flagged only when the adjusted test is significant and the shift is practically meaningful (PSI >= 0.10, or a >= 2 point change in a missing rate).",
    "Subgroups: sensitivity, specificity and false-negative rate by age group and clinical setting, with Wilson 95% intervals. Groups with too few confirmed cases are flagged.",
]


def build_report(svc: Service, req) -> dict:
    mid = req.model_id
    svc._spec(mid)
    exp = None
    baseline_id, current_id, days = req.baseline_dataset_id, req.current_dataset_id, req.days
    if req.experiment_id:
        exp = svc.get_experiment(req.experiment_id)
        if exp["config"]["model_id"] != mid:
            raise BadRequest("That experiment belongs to a different model.")
        baseline_id, current_id, days = exp["config"]["baseline_dataset_id"], f"exp:{exp['id']}", None
    base, cur = svc._pair(mid, days, req.site, baseline_id, current_id)
    drift = exp["drift"] if exp else compute_drift(base, cur, seed=0, n_perm=200)
    perf = svc.performance(mid, days, req.site, baseline_id, current_id)
    subs = svc.subgroups(mid, days, req.site, baseline_id, current_id)
    alerts = svc.list_alerts(model_id=mid)
    rid = svc._next_id("RPT", "reports")
    data = jsonable({
        "id": rid, "created_at": now_iso(), "model": perf["model"],
        "period": {"start": perf["current"]["dataset"]["start"], "end": perf["current"]["dataset"]["end"], "days": days, "site": req.site or "all"},
        "datasets": {"baseline": perf["baseline"]["dataset"], "current": perf["current"]["dataset"]},
        "performance": {"baseline": perf["baseline"]["metrics"], "current": perf["current"]["metrics"], "deltas": perf["deltas"]},
        "drift": drift, "subgroups": subs["groups"], "alerts": alerts,
        "experiment": ({"id": exp["id"], "simulation": exp["simulation"], "interpretation": exp["interpretation"]} if exp else None),
        "methodology": METHODOLOGY, "limitations": LIMITATIONS, "disclaimer": DISCLAIMER,
    })
    svc.store.put("reports", rid, {"id": rid, "model_id": mid, "created_at": data["created_at"], "data": data})
    svc._activity("report", f"Monitoring report {rid} generated for {data['model']['name']}.", mid)
    return data


def report_brief(r: dict) -> dict:
    d = r["data"]
    return {"id": r["id"], "model_id": r["model_id"], "model_name": d["model"]["name"], "created_at": r["created_at"],
            "period": d["period"], "baseline": d["datasets"]["baseline"]["label"], "current": d["datasets"]["current"]["label"],
            "experiment_id": d["experiment"]["id"] if d["experiment"] else None, "alerts": len(d["alerts"])}


# ---------- helpers ----------
def _pct(v): return "unavailable" if v is None else f"{v * 100:.1f}%"
def _num(v, nd=3): return "—" if v is None else f"{v:.{nd}f}"
def _pp(v): return "—" if v is None else f"{v * 100:+.1f} pts"
METRICS = [("accuracy", "Accuracy"), ("sensitivity", "Sensitivity (recall)"), ("specificity", "Specificity"), ("precision", "Precision"),
           ("fnr", "False-negative rate"), ("fpr", "False-positive rate"), ("f1", "F1 score")]


# ---------- CSV ----------
def render_csv(d: dict) -> str:
    out = io.StringIO(); w = csv.writer(out)
    w.writerow(["section", "item", "baseline", "current", "detail"])
    w.writerow(["report", "ScanWatch monitoring report", d["id"], d["created_at"], d["disclaimer"]])
    w.writerow(["report", "model", d["model"]["name"], d["model"]["identifier"], d["model"]["version"]])
    w.writerow(["report", "period", d["period"]["start"], d["period"]["end"], f"site={d['period']['site']}"])
    w.writerow(["report", "datasets", d["datasets"]["baseline"]["label"], d["datasets"]["current"]["label"],
                f"n_baseline={d['datasets']['baseline']['n']}; n_current={d['datasets']['current']['n']}"])
    pb, pc = d["performance"]["baseline"], d["performance"]["current"]
    for k in ("tp", "fp", "tn", "fn"):
        w.writerow(["confusion_matrix", k.upper(), pb[k], pc[k], ""])
    for k, label in METRICS:
        w.writerow(["performance", label, "" if pb[k] is None else round(pb[k], 4), "" if pc[k] is None else round(pc[k], 4),
                    "unavailable" if pc[k] is None or pb[k] is None else ""])
    cal_b, cal_c = pb.get("calibration"), pc.get("calibration")
    if cal_b and cal_c:
        w.writerow(["calibration", "ECE", round(cal_b["ece"], 4), round(cal_c["ece"], 4), ""])
        w.writerow(["calibration", "Brier score", round(cal_b["brier"], 4), round(cal_c["brier"], 4), ""])
    ov = d["drift"]["overall"]
    w.writerow(["drift_summary", "features flagged", "", f"{ov['n_drifted']} of {ov['n_features_tested']}", f"adjusted alpha={ov['alpha_adjusted']:.4f}"])
    mmd = d["drift"]["mmd"]
    if mmd.get("available"):
        w.writerow(["drift_summary", "MMD", "", round(mmd["statistic"], 5), f"permutation p={mmd['p_value']:.3f}"])
    for f in d["drift"]["features"]:
        w.writerow(["drift_feature", f["label"], "" if f["reference_value"] is None else round(f["reference_value"], 4),
                    "" if f["current_value"] is None else round(f["current_value"], 4),
                    f"test={f['test']}; stat={_num(f['statistic'], 4)}; p={_num(f['p_value'], 4)}; p_adj={_num(f['p_adjusted'], 4)}; PSI={_num(f['psi'])}; flagged={f['drifted']}"])
    for g in d["subgroups"]:
        b, c = g["baseline"], g["current"]
        for k, label in (("sensitivity", "Sensitivity"), ("specificity", "Specificity"), ("fnr", "False-negative rate")):
            w.writerow(["subgroup", f"{g['group']} - {label}", "" if b[k] is None else round(b[k], 4), "" if c[k] is None else round(c[k], 4),
                        f"n_current={c['n']}; positives={c['positives']}" + ("; LOW SAMPLE: " + c["low_sample_reason"] if c["low_sample"] else "")])
    for a in d["alerts"]:
        w.writerow(["alert", f"{a['id']} {a['type_label']}", a["baseline_value"], a["current_value"], f"severity={a['severity']}; status={a['status']}; {a['explanation']}"])
        for h in a["history"]:
            w.writerow(["investigation_history", a["id"], h["at"], h["event"], f"{h['author']}: {h['detail']}"])
    for t in d["limitations"]:
        w.writerow(["limitation", t, "", "", ""])
    return out.getvalue()


# ---------- PDF ----------
def _fig_bytes(fig) -> io.BytesIO:
    buf = io.BytesIO(); fig.savefig(buf, format="png", dpi=170, bbox_inches="tight"); plt.close(fig); buf.seek(0); return buf


def _style_ax(ax):
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color(LINE)
    ax.tick_params(colors=MUTED, labelsize=8); ax.yaxis.label.set_color(MUTED)


def _grouped_bars(labels, base, cur, title, ylabel="Percent"):
    fig, ax = plt.subplots(figsize=(7.2, 2.7))
    x = range(len(labels)); w = 0.38
    ax.bar([i - w / 2 for i in x], [(v or 0) * 100 for v in base], w, color="#9FB3C2", label="Baseline")
    ax.bar([i + w / 2 for i in x], [(v or 0) * 100 for v in cur], w, color=PRIMARY, label="Current")
    for i, (b, c) in enumerate(zip(base, cur)):
        for off, v in ((-w / 2, b), (w / 2, c)):
            ax.text(i + off, (v or 0) * 100 + 1, "n/a" if v is None else f"{v * 100:.0f}", ha="center", fontsize=7, color=NAVY)
    ax.set_xticks(list(x)); ax.set_xticklabels(labels); ax.set_ylim(0, 112); ax.set_ylabel(ylabel, fontsize=8)
    ax.set_title(title, fontsize=9, color=NAVY, loc="left"); ax.legend(fontsize=7, frameon=False, ncol=2, loc="upper right"); _style_ax(ax)
    return _fig_bytes(fig)


def _hist(feat):
    fig, ax = plt.subplots(figsize=(7.2, 2.5))
    h = feat["histogram"]; xs = range(len(h)); w = 0.8
    ax.bar(xs, [r["baseline"] * 100 for r in h], w, color="#9FB3C2", alpha=0.85, label="Baseline")
    ax.bar(xs, [r["current"] * 100 for r in h], w, color=PRIMARY, alpha=0.55, label="Current")
    step = max(1, len(h) // 8)
    ax.set_xticks(list(xs)[::step]); ax.set_xticklabels([r["x"] for r in h][::step], fontsize=7)
    ax.set_ylabel("% of records", fontsize=8); ax.legend(fontsize=7, frameon=False)
    ax.set_title(f"{feat['label']}: baseline vs current distribution", fontsize=9, color=NAVY, loc="left"); _style_ax(ax)
    return _fig_bytes(fig)


def render_pdf(d: dict) -> bytes:
    ss = getSampleStyleSheet()
    body = ParagraphStyle("b", parent=ss["BodyText"], fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor(NAVY))
    small = ParagraphStyle("s", parent=body, fontSize=7.5, leading=10, textColor=colors.HexColor(MUTED))
    h1 = ParagraphStyle("h1", parent=body, fontName="Helvetica-Bold", fontSize=20, leading=24, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=body, fontName="Helvetica-Bold", fontSize=12, leading=16, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor(PRIMARY))
    cell = ParagraphStyle("c", parent=body, fontSize=8, leading=10.5)

    def P(t, s=body): return Paragraph(str(t).replace("&", "&amp;").replace("<", "&lt;"), s)

    def table(rows, widths, header=True):
        t = Table([[c if not isinstance(c, str) else P(c, cell) for c in r] for r in rows], colWidths=[x * cm for x in widths], repeatRows=1 if header else 0)
        st = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor(LINE)), ("VALIGN", (0, 0), (-1, -1), "TOP"),
              ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
        if header: st += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8F1F6"))]
        t.setStyle(TableStyle(st)); return t

    def page(canvas, doc):
        canvas.saveState(); w, h = A4
        canvas.setFillColor(colors.HexColor(PRIMARY)); canvas.rect(0, h - 1.5 * cm, w, 1.5 * cm, stroke=0, fill=1)
        canvas.setFillColor(colors.white); canvas.setFont("Helvetica-Bold", 13); canvas.drawString(1.8 * cm, h - 1.0 * cm, "ScanWatch")
        canvas.setFont("Helvetica", 8); canvas.drawRightString(w - 1.8 * cm, h - 1.0 * cm, "Know when your medical AI changes")
        canvas.setFillColor(colors.HexColor(MUTED)); canvas.setFont("Helvetica", 7)
        canvas.drawString(1.8 * cm, 1.0 * cm, "Synthetic data only. Not clinical validation.")
        canvas.drawRightString(w - 1.8 * cm, 1.0 * cm, f"{d['id']}  |  Page {doc.page}"); canvas.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=2.4 * cm, bottomMargin=1.8 * cm,
                            title=f"ScanWatch monitoring report {d['id']}", author="ScanWatch")
    s: list = []
    m, per = d["model"], d["period"]
    s += [P("Monitoring Report", h1), P(f"{m['name']} ({m['identifier']}, {m['version']})", body), Spacer(1, 6)]
    s.append(table([
        ["Report ID", d["id"], "Date generated", d["created_at"][:19].replace("T", " ") + " UTC"],
        ["Reporting period", f"{per['start']} to {per['end']}" + (f" (last {per['days']} days)" if per["days"] else ""), "Site", per["site"]],
        ["Baseline dataset", f"{d['datasets']['baseline']['label']} (n={d['datasets']['baseline']['n']})", "Current dataset", f"{d['datasets']['current']['label']} (n={d['datasets']['current']['n']})"],
    ], [3, 5.6, 3, 5.6], header=False))
    s += [Spacer(1, 8), table([[P("Disclaimer: " + d["disclaimer"], small)]], [17.2], header=False)]

    if d["experiment"]:
        s.append(P("Experiment interpretation", h2))
        s.append(P(f"{d['experiment']['id']}: {d['experiment']['simulation']['label']}. {d['experiment']['interpretation']['headline']}."))
        for t in d["experiment"]["interpretation"]["paragraphs"]: s += [Spacer(1, 3), P(t)]

    pb, pc, dl = d["performance"]["baseline"], d["performance"]["current"], d["performance"]["deltas"]
    s.append(P("Performance metrics", h2))
    s.append(table([["Metric", "Baseline", "Current", "Change"]] + [[lbl, _pct(pb[k]), _pct(pc[k]), _pp(dl.get(k))] for k, lbl in METRICS]
                   + [["Confirmed positives / negatives", f"{pb['positives']} / {pb['negatives']}", f"{pc['positives']} / {pc['negatives']}", ""],
                      ["Calibration (ECE / Brier)", f"{_num(pb['calibration']['ece'])} / {_num(pb['calibration']['brier'])}",
                       f"{_num(pc['calibration']['ece'])} / {_num(pc['calibration']['brier'])}", ""]], [6.4, 3.6, 3.6, 3.6]))
    s.append(Spacer(1, 4))
    s.append(P(f"Confusion matrix (current): TP {pc['tp']}, FP {pc['fp']}, TN {pc['tn']}, FN {pc['fn']}. Metrics with a zero denominator are shown as unavailable. Outcome labels can arrive late, so recent periods may be incomplete.", small))
    keys = ["sensitivity", "specificity", "precision", "accuracy"]
    s += [Spacer(1, 6), Image(_grouped_bars(["Sensitivity", "Specificity", "Precision", "Accuracy"], [pb[k] for k in keys], [pc[k] for k in keys], "Baseline vs current performance"), width=16 * cm, height=6 * cm)]

    ov, mmd = d["drift"]["overall"], d["drift"]["mmd"]
    s.append(P("Drift results", h2))
    s.append(P(f"{ov['n_drifted']} of {ov['n_features_tested']} compared features met the drift criteria (Bonferroni-adjusted alpha {ov['alpha_adjusted']:.4f}). "
               + (f"MMD (joint test) = {mmd['statistic']:.4f}, permutation p = {mmd['p_value']:.3f}. " if mmd.get("available") else "")
               + "Statistical drift does not by itself mean model failure."))
    s.append(Spacer(1, 4))
    s.append(table([["Feature", "Test", "Statistic", "p (adj.)", "PSI", "Flagged"]] +
                   [[f["label"], f["test"], _num(f["statistic"], 3), _num(f["p_adjusted"], 4), _num(f["psi"], 3), "Yes" if f["drifted"] else "No"] for f in d["drift"]["features"]],
                   [4.4, 4.4, 2.2, 2.2, 1.8, 2.2]))
    numeric = [f for f in d["drift"]["features"] if f["kind"] == "numeric" and f["histogram"]]
    if numeric:
        top = max(numeric, key=lambda f: f["psi"] or 0)
        s += [Spacer(1, 6), Image(_hist(top), width=16 * cm, height=5.5 * cm)]

    s.append(P("Patient subgroup comparison", h2))
    s.append(table([["Subgroup", "n (current)", "Positives", "Sensitivity (base → current)", "Specificity (base → current)", "FNR (current)", "Note"]] +
                   [[g["group"], g["current"]["n"], g["current"]["positives"], f"{_pct(g['baseline']['sensitivity'])} → {_pct(g['current']['sensitivity'])}",
                     f"{_pct(g['baseline']['specificity'])} → {_pct(g['current']['specificity'])}", _pct(g["current"]["fnr"]),
                     "Low sample" if g["current"]["low_sample"] else ""] for g in d["subgroups"]], [3.2, 1.8, 1.7, 3.6, 3.6, 1.7, 1.6]))
    s.append(Spacer(1, 4))
    s.append(P("Overall performance can hide differences between groups. Differences here are statistical observations on synthetic data; they do not establish biological causes or show discrimination.", small))
    s += [Spacer(1, 6), Image(_grouped_bars([g["group"] for g in d["subgroups"]], [g["baseline"]["sensitivity"] for g in d["subgroups"]],
                                            [g["current"]["sensitivity"] for g in d["subgroups"]], "Sensitivity by subgroup"), width=16 * cm, height=6 * cm)]

    s.append(P("Alerts and investigation history", h2))
    if d["alerts"]:
        s.append(table([["ID", "Type", "Severity", "Status", "Baseline → current"]] +
                       [[a["id"], a["type_label"], a["severity"].capitalize() if a["severity"] != "info" else "Informational", a["status"].capitalize(),
                         ("—" if a["baseline_value"] is None else _fmt(a["baseline_value"], a["value_format"])) + " → " + ("—" if a["current_value"] is None else _fmt(a["current_value"], a["value_format"]))] for a in d["alerts"]],
                       [2, 6.2, 2.6, 2.6, 3.8]))
        for a in d["alerts"]:
            block = [P(f"{a['id']}: {a['explanation']}", cell)]
            for h in a["history"]:
                block.append(P(f"• {h['at'][:16].replace('T', ' ')} {h['event'].replace('_', ' ')} ({h['author']}): {h['detail']}", small))
            s += [Spacer(1, 5), KeepTogether(block)]
    else:
        s.append(P("No alerts recorded for this model."))

    s.append(P("Methodology", h2)); s += [P("• " + t, body) for t in d["methodology"]]
    s.append(P("Data limitations", h2)); s += [P("• " + t, body) for t in d["limitations"]]
    doc.build(s, onFirstPage=page, onLaterPages=page)
    return buf.getvalue()


def _fmt(v, kind):
    return f"{v * 100:.1f}%" if kind == "pct" else f"{v:.0f}" if kind == "count" else f"{v:.2f}"
