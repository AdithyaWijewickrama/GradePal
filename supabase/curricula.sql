-- ============================================================================
-- GRADE PAL — CURRICULA
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Different batches follow different curricula (module lists and CGPA rules).
--   curricula        one row per curriculum, with its CGPA weights
--   batch_curricula  which curriculum each batch follows
--   semesters.curriculum_code
--                    which curriculum a semester's module list belongs to;
--                    NULL = shared by every curriculum (existing semesters)
--
-- CGPA weights, from the FoE UoR Student Handbook 2024/2025 (26th batch),
-- section 12.5, Equation 12.2: each module's credits are weighted 0.05 in
-- semesters 1–2 and 0.15 in semesters 3–8. A curriculum with both weights
-- at 1 gives a plain credit-weighted average.
-- ============================================================================

begin;

create table if not exists public.curricula (
  code text primary key,
  name text not null,
  weight_common numeric not null default 1 check (weight_common > 0),
  weight_specialisation numeric not null default 1 check (weight_specialisation > 0),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.batch_curricula (
  batch text primary key,
  curriculum_code text not null references public.curricula(code) on update cascade on delete cascade
);

alter table public.semesters
  add column if not exists curriculum_code text references public.curricula(code) on update cascade;

-- ---------------------------------------------------------------------------
-- RLS — anyone signed in can read (students need their batch's curriculum
-- and weights); only the admin can change anything.
-- ---------------------------------------------------------------------------
alter table public.curricula enable row level security;
alter table public.batch_curricula enable row level security;
revoke all on public.curricula, public.batch_curricula from anon;

drop policy if exists "curricula: read signed in" on public.curricula;
drop policy if exists "curricula: admin write" on public.curricula;
drop policy if exists "batch_curricula: read signed in" on public.batch_curricula;
drop policy if exists "batch_curricula: admin write" on public.batch_curricula;

create policy "curricula: read signed in"
  on public.curricula for select to authenticated
  using (true);

create policy "curricula: admin write"
  on public.curricula for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "batch_curricula: read signed in"
  on public.batch_curricula for select to authenticated
  using (true);

create policy "batch_curricula: admin write"
  on public.batch_curricula for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SEED — Curriculum 2023 with the handbook's weights, and batch 27 on it.
-- Map the other batches from Admin → Curricula once confirmed.
-- ---------------------------------------------------------------------------
insert into public.curricula (code, name, weight_common, weight_specialisation)
values ('2023', 'Curriculum 2023', 0.05, 0.15)
on conflict (code) do nothing;

insert into public.batch_curricula (batch, curriculum_code)
values ('27', '2023')
on conflict (batch) do nothing;

commit;
