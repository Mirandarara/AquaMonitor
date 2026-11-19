-- Execute no SQL Editor de um projeto Supabase novo (Postgres 15+).
-- Dados ambientais publicados são públicos para leitura; escrita só no backend.
begin;
create table public.monitoring_points (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  location text not null default 'Juazeiro do Norte, CE',
  attention_cm numeric not null default 60 check (attention_cm >= 0),
  critical_cm numeric not null default 100,
  published boolean not null default false,
  check (critical_cm > attention_cm)
);
create table public.water_readings (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.monitoring_points(id) on delete cascade,
  level_cm numeric not null check (level_cm >= 0),
  recorded_at timestamptz not null default now()
);
create index water_readings_point_time_idx on public.water_readings (point_id, recorded_at desc);
alter table public.monitoring_points enable row level security;
alter table public.water_readings enable row level security;
create policy "Read published monitoring points" on public.monitoring_points
  for select to anon, authenticated using (published = true);
create policy "Read readings of published points" on public.water_readings
  for select to anon, authenticated using (
    exists (select 1 from public.monitoring_points p where p.id = point_id and p.published = true)
  );
create view public.monitoring_overview with (security_invoker = true) as
  select p.*, r.level_cm, r.recorded_at from public.monitoring_points p
  left join lateral (
    select level_cm, recorded_at from public.water_readings
    where point_id = p.id order by recorded_at desc limit 1
  ) r on true;
revoke all on public.monitoring_points, public.water_readings, public.monitoring_overview from anon, authenticated;
grant select on public.monitoring_points, public.water_readings, public.monitoring_overview to anon, authenticated;
commit;
