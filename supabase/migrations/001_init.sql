create extension if not exists pgcrypto;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists people_name_lower_idx
  on public.people (lower(name));

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  original_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.faces (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  crop_path text not null,
  bbox jsonb not null,
  person_id uuid references public.people(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists faces_status_idx on public.faces(status);
create index if not exists faces_photo_id_idx on public.faces(photo_id);
create index if not exists faces_person_id_idx on public.faces(person_id);

create table if not exists public.name_submissions (
  id uuid primary key default gen_random_uuid(),
  face_id uuid not null references public.faces(id) on delete cascade,
  submitted_name text not null,
  submitted_by text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists name_submissions_face_id_idx on public.name_submissions(face_id);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  face_id uuid not null references public.faces(id) on delete cascade,
  guessed_name text not null,
  correct boolean not null,
  response_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_face_id_idx on public.quiz_attempts(face_id);
create index if not exists quiz_attempts_created_at_idx on public.quiz_attempts(created_at desc);

alter table public.people enable row level security;
alter table public.photos enable row level security;
alter table public.faces enable row level security;
alter table public.name_submissions enable row level security;
alter table public.quiz_attempts enable row level security;

insert into storage.buckets (id, name, public)
values
  ('group-photos', 'group-photos', false),
  ('face-crops', 'face-crops', false)
on conflict (id) do nothing;
