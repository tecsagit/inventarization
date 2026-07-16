-- Run in Supabase → SQL Editor for project "invent"

create table if not exists public.employees (
  id text primary key,
  name text not null
);

create table if not exists public.items (
  id text primary key,
  name text not null default '',
  model text not null default '',
  inv_number text not null default '',
  working boolean not null default true,
  site text not null default 'Ігорівська',
  employee_id text not null default '',
  specs text not null default '',
  note text not null default '',
  action text not null default '',
  problems text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_site_idx on public.items (site);
create index if not exists items_employee_id_idx on public.items (employee_id);
create index if not exists items_name_idx on public.items (name);

alter table public.employees enable row level security;
alter table public.items enable row level security;

drop policy if exists "employees_all" on public.employees;
create policy "employees_all" on public.employees
  for all using (true) with check (true);

drop policy if exists "items_all" on public.items;
create policy "items_all" on public.items
  for all using (true) with check (true);

-- Realtime: у Table Editor увімкни Replication для employees та items (або розкоментуй нижче).
-- alter publication supabase_realtime add table public.employees;
-- alter publication supabase_realtime add table public.items;
