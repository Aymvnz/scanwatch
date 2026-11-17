# ScanWatch: know when your medical AI changes

Educational medical-AI observability prototype. **Synthetic data only. Not a clinical product.**
It never diagnoses, gives medical advice, or validates a model for clinical use.

## Run it (two terminals)

**1. Backend** (Python 3.10+)
```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows;  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000  (API docs at /docs)
```

**2. Frontend** (Node 18.17+)
```
cd frontend
npm install
npm run dev                     # http://localhost:3000
```
No sign-in, API keys or paid services. If the backend isn't running, the app says so and shows the command.

## Tests
```
cd backend  && python -m pytest          # statistics, simulations, metrics, API, persistence, reports
cd frontend && npm test                  # renders every page and the demo workflow against a running backend
```
(The frontend tests need the backend running on port 8000.)

## What's inside
- `backend/app/synth.py` deterministic synthetic data (2,400 records per dataset, fixed seeds)
- `backend/app/drift.py` KS, chi-square, PSI (reference-based bins, smoothing), MMD (RBF, permutation test), Bonferroni adjustment
- `backend/app/simulations.py` five simulations; input-drift simulations never change predictions or outcomes; only "Performance Degradation" changes errors
- `backend/app/metrics.py`, `subgroups.py`, `alert_rules.py`, `reports.py` (PDF + CSV), `store.py` (local JSON or Supabase)
- `supabase/schema.sql` optional tables (models, datasets, experiments, experiment_results, alerts, investigation_notes, reports)
- `frontend/` Next.js App Router, TypeScript, Tailwind, Recharts, Lucide

## Persistence
Default: `backend/data/state.json` (created automatically). Optional Supabase: copy `backend/.env.example` to `.env`, run `supabase/schema.sql`, set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (server-side only).
The Supabase adapter was written to the schema but not exercised against a live project here.

## Honest limitations
- Evidently is not used; KS, PSI, chi-square and MMD are implemented directly with SciPy/NumPy so every calculation is inspectable and unit-tested.
- Patient Population simulation resamples rows, so some cases repeat; effective sample size is smaller than the row count.
- Alert thresholds are conventional defaults (read-only in Settings), not clinical standards.
- Page layouts were verified by rendering in a simulated DOM and by type-checking; they have not been visually inspected on real phones in this environment.
