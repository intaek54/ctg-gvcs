-- ============================================================
-- CTG — database schema for Supabase
--
-- Run this whole file once in:
--   Supabase dashboard > SQL Editor > New query > paste > Run
-- It is safe to run again; it won't duplicate anything.
--
-- Then add each admin account (see the bottom of this file).
-- ============================================================

-- ----- Who counts as an admin -----
-- One row per student council account. Rows are added by hand
-- (bottom of this file); the website itself can never add one.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies on purpose: nobody can read or change this table
-- through the website. is_admin() below reads it with elevated rights.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ----- Private: questions and prayer requests -----
create table if not exists public.submissions (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('ask', 'prayer')),
  name       text not null default '' check (char_length(name) < 100),
  message    text not null check (char_length(message) between 1 and 4999),
  date       timestamptz not null default now(),
  seen       boolean not null default false
);
alter table public.submissions enable row level security;

-- Anyone may send one in, but it has to look like a real submission.
drop policy if exists "anyone can submit" on public.submissions;
create policy "anyone can submit" on public.submissions
  for insert to anon, authenticated
  with check (seen = false);

-- Only listed admins can ever read them back.
drop policy if exists "admins read submissions" on public.submissions;
create policy "admins read submissions" on public.submissions
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update submissions" on public.submissions;
create policy "admins update submissions" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete submissions" on public.submissions;
create policy "admins delete submissions" on public.submissions
  for delete to authenticated using (public.is_admin());

-- ----- Public: the answered board -----
create table if not exists public.board (
  id          uuid primary key default gen_random_uuid(),
  question_en text not null default '',
  question_ko text not null default '',
  answer_en   text not null default '',
  answer_ko   text not null default '',
  date        timestamptz not null default now()
);
alter table public.board enable row level security;

drop policy if exists "anyone reads board" on public.board;
create policy "anyone reads board" on public.board
  for select to anon, authenticated using (true);

drop policy if exists "admins write board" on public.board;
create policy "admins write board" on public.board
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Don't let the browser pick the date or flip `seen` on insert.
revoke insert on public.submissions from anon, authenticated;
grant insert (type, name, message) on public.submissions to anon, authenticated;

-- ----- Live updates -----
-- Lets open pages refresh by themselves when something changes.
-- (Row Level Security still decides who receives what.)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'submissions') then
    alter publication supabase_realtime add table public.submissions;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'board') then
    alter publication supabase_realtime add table public.board;
  end if;
end $$;

-- ============================================================
-- Adding an admin
--
-- 1. Authentication > Users > Add user > Create new user
--    (tick "Auto Confirm User").
-- 2. Copy that user's UID, then run (keep the quotes):
--
--    insert into public.admins (user_id)
--    values ('PASTE_THE_UID_HERE');
--
-- Or, by email:
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'someone@example.com';
-- ============================================================
