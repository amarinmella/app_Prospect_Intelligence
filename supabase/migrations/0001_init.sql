-- Prospect Intelligence · esquema inicial
-- Compatible con Supabase (Postgres 15+) y PGlite (desarrollo local).

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create type crm_status as enum (
  'new', 'analyzed', 'priority', 'contacted', 'replied',
  'meeting', 'proposal', 'won', 'lost'
);

create type search_status as enum ('pending', 'running', 'completed', 'failed');
create type message_channel as enum ('email', 'linkedin', 'whatsapp');
create type confidence_level as enum ('low', 'medium', 'high');

-- Búsquedas: "clínicas dentales en Santiago", 50 empresas
create table searches (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  location text not null,
  target_count int not null default 20 check (target_count between 1 and 500),
  status search_status not null default 'pending',
  provider text,
  found_count int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- Empresas descubiertas (una fila por negocio real)
create table companies (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references searches(id) on delete set null,
  name text not null,
  niche text,
  category text,
  website text,
  address text,
  city text,
  region text,
  country text,
  lat double precision,
  lng double precision,
  phone text,
  email text,
  rating numeric(2,1) check (rating between 0 and 5),
  review_count int check (review_count >= 0),
  opening_hours jsonb,
  socials jsonb not null default '{}'::jsonb,       -- {instagram: url, facebook: url, ...}
  description text,
  size_hint text,                                    -- señal de tamaño/actividad, con su origen
  -- CRM
  crm_status crm_status not null default 'new',
  owner text,
  next_action text,
  follow_up_date date,
  -- Resultado vigente del scoring (el histórico vive en company_scores)
  score int check (score between 0 and 100),
  score_confidence confidence_level,
  opportunity_count int not null default 0,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_search_idx on companies(search_id);
create index companies_status_idx on companies(crm_status);
create index companies_score_idx on companies(score desc nulls last);
create index companies_follow_up_idx on companies(follow_up_date) where follow_up_date is not null;
-- Evita duplicados por sitio web dentro de la base
create unique index companies_website_uidx on companies(lower(website)) where website is not null;

-- Trazabilidad: de qué fuente salió cada dato
create table company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null,              -- 'google_places', 'website', 'manual', ...
  external_id text,
  url text,
  raw jsonb,
  fetched_at timestamptz not null default now(),
  unique (company_id, provider, external_id)
);

-- Análisis (versionado: cada re-análisis crea una fila)
create table analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  summary text not null,
  signals jsonb not null default '{}'::jsonb,      -- hallazgos estructurados de la web / reseñas
  website_snapshot jsonb,                           -- {url, status, fetched_at, load_ms, ...}
  model text,                                       -- modelo/versión que interpretó
  confidence confidence_level not null default 'medium',
  created_at timestamptz not null default now()
);
create index analyses_company_idx on analyses(company_id, created_at desc);

-- Oportunidades detectadas (problema → evidencia → consecuencia → solución)
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  analysis_id uuid references analyses(id) on delete set null,
  problem_key text not null,                        -- slug estable: 'no_whatsapp', 'no_booking', ...
  title text not null,
  problem text not null,
  evidence jsonb not null default '[]'::jsonb,      -- [{text, source, url?}]
  consequence text not null,
  solution text not null,
  service text not null,                            -- servicio de Innova que lo resuelve
  impact text not null,
  impact_level confidence_level not null default 'medium',
  severity int not null check (severity between 1 and 5),
  confidence confidence_level not null default 'medium',
  created_at timestamptz not null default now()
);
create index opportunities_company_idx on opportunities(company_id);
create index opportunities_key_idx on opportunities(problem_key);
create index opportunities_service_idx on opportunities(service);

-- Histórico de puntuaciones, con desglose legible
create table company_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  total int not null check (total between 0 and 100),
  confidence confidence_level not null,
  breakdown jsonb not null,                         -- [{factor, weight, value, points, explanation}]
  method text not null,                             -- nombre/versión de la heurística
  created_at timestamptz not null default now()
);
create index company_scores_company_idx on company_scores(company_id, created_at desc);

-- Mensajes de contacto generados
create table messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  channel message_channel not null,
  subject text,
  body text not null,
  evidence_used jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_company_idx on messages(company_id, created_at desc);

-- Informes comerciales
create table reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  content jsonb not null,                           -- estructura tipada en lib/reports/types.ts
  pdf_path text,                                    -- ruta en Supabase Storage, si se persiste
  created_at timestamptz not null default now()
);
create index reports_company_idx on reports(company_id, created_at desc);

-- Notas del CRM
create table notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  body text not null,
  author text,
  created_at timestamptz not null default now()
);
create index notes_company_idx on notes(company_id, created_at desc);

-- Bitácora de actividad (alimenta el dashboard)
create table activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  search_id uuid references searches(id) on delete cascade,
  type text not null,                               -- 'status_changed', 'note_added', 'analysis_done', ...
  description text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_created_idx on activities(created_at desc);

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- Seguridad: la app accede solo desde el servidor con la conexión directa a Postgres.
-- RLS activado sin políticas => la API pública (anon/authenticated) de Supabase no puede leer nada.
alter table searches enable row level security;
alter table companies enable row level security;
alter table company_sources enable row level security;
alter table analyses enable row level security;
alter table opportunities enable row level security;
alter table company_scores enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table notes enable row level security;
alter table activities enable row level security;
