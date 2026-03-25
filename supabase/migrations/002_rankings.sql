create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  score integer not null,
  correct_count integer not null,
  quiz_mode text not null default 'multiple-choice',
  created_at timestamptz not null default now()
);

create index if not exists rankings_score_idx on public.rankings(score desc);
create index if not exists rankings_created_at_idx on public.rankings(created_at desc);

alter table public.rankings enable row level security;
