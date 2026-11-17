-- ScanWatch schema (run in the Supabase SQL editor). Synthetic data only.
-- The backend uses the service-role key server-side; it is never exposed to the frontend.
create table if not exists models (
  id text primary key, identifier text not null, name text not null, purpose text,
  modality text, version text, created_at timestamptz default now());

create table if not exists datasets (
  id text primary key, model_id text references models(id) on delete cascade,
  kind text not null check (kind in ('baseline','current','experiment')),
  label text, n_records int, seed int, created_at timestamptz default now());

create table if not exists experiments (
  id text primary key, model_id text references models(id) on delete cascade,
  config jsonb not null, payload jsonb, created_at timestamptz default now());
create index if not exists experiments_model_idx on experiments(model_id, created_at desc);

create table if not exists experiment_results (
  experiment_id text primary key references experiments(id) on delete cascade,
  result jsonb not null, created_at timestamptz default now());

create table if not exists alerts (
  id text primary key, model_id text references models(id) on delete cascade,
  type text not null, severity text not null check (severity in ('info','warning','critical')),
  status text not null check (status in ('open','investigating','resolved')),
  payload jsonb not null, created_at timestamptz default now());
create index if not exists alerts_model_status_idx on alerts(model_id, status);

create table if not exists investigation_notes (
  id text primary key, alert_id text references alerts(id) on delete cascade,
  author text, body text not null, created_at timestamptz default now());
create index if not exists notes_alert_idx on investigation_notes(alert_id);

create table if not exists reports (
  id text primary key, model_id text references models(id) on delete cascade,
  payload jsonb not null, created_at timestamptz default now());

create table if not exists activity_log (
  id text primary key, payload jsonb not null, created_at timestamptz default now());

-- Enable row-level security; the backend's service role bypasses it, browsers get no access.
alter table models enable row level security;
alter table datasets enable row level security;
alter table experiments enable row level security;
alter table experiment_results enable row level security;
alter table alerts enable row level security;
alter table investigation_notes enable row level security;
alter table reports enable row level security;
alter table activity_log enable row level security;
