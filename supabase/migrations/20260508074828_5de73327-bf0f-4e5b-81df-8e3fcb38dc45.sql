
-- ============ ENUMS ============
create type public.app_role as enum ('agent', 'coordinator', 'admin');
create type public.task_status as enum ('planifie', 'en_cours', 'termine');
create type public.product_category as enum ('Engrais', 'Phyto', 'Semences');
create type public.product_unit as enum ('L', 'Kg', 'Sac');
create type public.equipment_status as enum ('OK', 'Maintenance requise', 'En panne');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  team text not null default '',
  hourly_rate numeric not null default 35,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles: read for authenticated"
  on public.profiles for select to authenticated using (true);
create policy "Profiles: update own"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Profiles: insert own"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;

create policy "User roles: read own"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
create policy "User roles: admin manage"
  on public.user_roles for all to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============ AUTO PROFILE ON SIGNUP ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  default_role public.app_role;
begin
  -- Récupération du rôle depuis les métadonnées (envoyées par le front)
  begin
    default_role := (new.raw_user_meta_data ->> 'role')::public.app_role;
  exception when others then
    default_role := 'agent'::public.app_role;
  end;

  insert into public.profiles (id, name, team)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'team', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, default_role);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ PRODUCTS ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category product_category not null,
  unit product_unit not null,
  stock numeric not null default 0,
  threshold numeric not null default 0,
  price_per_unit numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "Products: read auth" on public.products for select to authenticated using (true);
create policy "Products: coord/admin write" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'));

-- ============ EQUIPMENT ============
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  hours_used numeric not null default 0,
  hours_for_maintenance numeric not null default 0,
  status equipment_status not null default 'OK',
  last_maintenance date,
  hourly_cost numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.equipment enable row level security;
create policy "Equipment: read auth" on public.equipment for select to authenticated using (true);
create policy "Equipment: coord/admin write" on public.equipment for all to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'));
-- agents can mark anomaly status
create policy "Equipment: agent flag anomaly" on public.equipment for update to authenticated
  using (public.has_role(auth.uid(),'agent'))
  with check (public.has_role(auth.uid(),'agent'));

-- ============ TASKS ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client text not null default '',
  address text not null default '',
  lat numeric,
  lng numeric,
  scheduled_at timestamptz not null,
  duration numeric not null default 1,
  team text not null default '',
  status task_status not null default 'planifie',
  started_at timestamptz,
  finished_at timestamptz,
  budget numeric not null default 0,
  labor_cost numeric,
  signature_url text,
  photo_before_url text,
  photo_after_url text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.tasks enable row level security;

create table public.task_assignments (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);
alter table public.task_assignments enable row level security;

create table public.task_equipment (
  task_id uuid not null references public.tasks(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  primary key (task_id, equipment_id)
);
alter table public.task_equipment enable row level security;

create table public.task_products (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.task_products enable row level security;

-- helper: is current user assigned to task?
create or replace function public.is_assigned(_task uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.task_assignments where task_id = _task and user_id = _user)
$$;

-- tasks policies
create policy "Tasks: coord/admin read all"
  on public.tasks for select to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin') or public.is_assigned(id, auth.uid()));
create policy "Tasks: coord/admin write"
  on public.tasks for all to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'));
create policy "Tasks: assigned agent update"
  on public.tasks for update to authenticated
  using (public.is_assigned(id, auth.uid()))
  with check (public.is_assigned(id, auth.uid()));

-- task_assignments policies
create policy "Assignments: read auth" on public.task_assignments for select to authenticated using (true);
create policy "Assignments: coord/admin manage" on public.task_assignments for all to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'));

-- task_equipment policies
create policy "TaskEquip: read auth" on public.task_equipment for select to authenticated using (true);
create policy "TaskEquip: coord/admin manage" on public.task_equipment for all to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'));

-- task_products policies
create policy "TaskProducts: read auth" on public.task_products for select to authenticated using (true);
create policy "TaskProducts: assigned or coord write"
  on public.task_products for all to authenticated
  using (
    public.is_assigned(task_id, auth.uid())
    or public.has_role(auth.uid(),'coordinator')
    or public.has_role(auth.uid(),'admin')
  )
  with check (
    public.is_assigned(task_id, auth.uid())
    or public.has_role(auth.uid(),'coordinator')
    or public.has_role(auth.uid(),'admin')
  );

-- ============ ANOMALIES ============
create table public.anomalies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null,
  description text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.anomalies enable row level security;
create policy "Anomalies: read auth" on public.anomalies for select to authenticated using (true);
create policy "Anomalies: agent insert"
  on public.anomalies for insert to authenticated
  with check (reported_by = auth.uid());
create policy "Anomalies: coord/admin manage"
  on public.anomalies for all to authenticated
  using (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'coordinator') or public.has_role(auth.uid(),'admin'));

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public)
values ('task-media', 'task-media', true)
on conflict (id) do nothing;

create policy "Task media: public read"
  on storage.objects for select
  using (bucket_id = 'task-media');
create policy "Task media: auth upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-media');
create policy "Task media: auth update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'task-media' and owner = auth.uid());
create policy "Task media: auth delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-media' and owner = auth.uid());
