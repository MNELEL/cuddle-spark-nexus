
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- classes
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grid_cols int not null default 6,
  grid_rows int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.classes enable row level security;
create policy "classes_owner_all" on public.classes for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  notes text default '',
  height text not null default 'mid' check (height in ('low','mid','high')),
  row_pref text not null default 'any' check (row_pref in ('front','mid','back','any')),
  corner_pref boolean not null default false,
  gender text default null,
  created_at timestamptz not null default now()
);
alter table public.students enable row level security;
create policy "students_owner_all" on public.students for all
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));
create index students_class_idx on public.students(class_id);

-- student_relations
create table public.student_relations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_a uuid not null references public.students(id) on delete cascade,
  student_b uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('friend','avoid','distance')),
  created_at timestamptz not null default now(),
  check (student_a <> student_b)
);
alter table public.student_relations enable row level security;
create policy "relations_owner_all" on public.student_relations for all
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));
create index relations_class_idx on public.student_relations(class_id);
