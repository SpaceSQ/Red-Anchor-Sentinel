-- Red Anchor Sentinel motherport.
-- Business records only. Fourteen-dimension readings, SOUL.md, hardware bindings,
-- and LAN inventories are not columns in this database and must not be inserted here.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) <= 120),
  display_name text not null default '' check (char_length(display_name) <= 40),
  tier text not null default 'free' check (tier in ('free', 'pro', 'enterprise')),
  created_at timestamptz not null default now()
);

create table if not exists public.s2_did_registry (
  did_hash text primary key check (did_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  registered_at timestamptz not null default now()
);

create index if not exists s2_did_registry_user_idx on public.s2_did_registry (user_id);

create table if not exists public.telemetry_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('parameter_note', 'threat_signature', 'crash')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (
    char_length(body) between 1 and 4000
    and body !~* 'smtp_pass|begin private key|api[_-]?key'
  ),
  app_version text not null default '' check (char_length(app_version) <= 32),
  created_at timestamptz not null default now()
);

create table if not exists public.push_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  did_hash text check (did_hash is null or did_hash ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(title) between 1 and 80),
  dimension text not null check (dimension in (
    'light', 'atmos', 'sound', 'wave', 'power', 'vision', 'air',
    'pressure', 'odor', 'tactile', 'magnetic', 'gravity', 'water', 'food'
  )),
  severity text not null check (severity in ('warning', 'critical')),
  delivered_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.s2_did_registry enable row level security;
alter table public.telemetry_feedback enable row level security;
alter table public.push_logs enable row level security;

create policy profiles_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and tier = (select p.tier from public.profiles p where p.id = auth.uid()));

create policy did_read_own on public.s2_did_registry
  for select using (auth.uid() = user_id);
create policy did_insert_own on public.s2_did_registry
  for insert with check (auth.uid() = user_id);

create policy feedback_read_own on public.telemetry_feedback
  for select using (auth.uid() = user_id);
create policy feedback_insert_own on public.telemetry_feedback
  for insert with check (auth.uid() = user_id);

create policy push_read_own on public.push_logs
  for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, tier)
  values (new.id, coalesce(new.email, ''), '', 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
