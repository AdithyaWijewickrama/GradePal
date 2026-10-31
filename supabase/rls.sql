-- ============================================================================
-- GRADE PAL — ROW LEVEL SECURITY
-- Run in Supabase: SQL Editor → New query → paste → Run.
--
-- The anon key in js/config.js is public by design. These policies are what
-- actually stop someone using that key from reading or changing other
-- students' data. Safe to re-run: it drops every existing policy on the
-- tables below and recreates them, all inside one transaction.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- is_admin(): true when the signed-in user's verified email matches
-- app_settings.admin_email. SECURITY DEFINER so it can read app_settings even
-- though students can't.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_settings
    where key = 'admin_email'
      and lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Start clean: enable RLS and drop whatever policies exist today.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['profiles', 'grades', 'semesters', 'modules', 'app_settings', 'target_gpa'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PROFILES — students see and edit only their own row; admin can read all.
-- ---------------------------------------------------------------------------
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- fallback insert in main.js when the signup trigger hasn't fired yet
create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and lower(email) = lower(auth.jwt() ->> 'email')
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: delete own"
  on public.profiles for delete to authenticated
  using (id = auth.uid());

-- Column-level lock: students may only change their own editable fields, so
-- they can't flip is_admin or spoof their email through the API.
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, full_name) on public.profiles to authenticated;
grant update (full_name, student_number, batch, department) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- GRADES — students fully manage their own rows; admin can read all.
-- ---------------------------------------------------------------------------
create policy "grades: read own or admin"
  on public.grades for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "grades: insert own"
  on public.grades for insert to authenticated
  with check (user_id = auth.uid());

create policy "grades: update own"
  on public.grades for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "grades: delete own"
  on public.grades for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SEMESTERS / MODULES — readable by any signed-in user, writable by admin.
-- ---------------------------------------------------------------------------
create policy "semesters: read signed in"
  on public.semesters for select to authenticated
  using (true);

create policy "semesters: admin write"
  on public.semesters for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "modules: read signed in"
  on public.modules for select to authenticated
  using (true);

create policy "modules: admin write"
  on public.modules for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- APP_SETTINGS — admin only (is_admin() reads it as definer, so students
-- don't need access).
-- ---------------------------------------------------------------------------
create policy "app_settings: admin read"
  on public.app_settings for select to authenticated
  using (public.is_admin());

create policy "app_settings: admin update"
  on public.app_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- TARGET_GPA — not used by the current app yet; locked to the owning user.
-- ---------------------------------------------------------------------------
create policy "target_gpa: own rows"
  on public.target_gpa for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- FOREIGN KEYS — add ON DELETE CASCADE where the app expects it.
-- Without these, "Delete profile" fails for any student with saved grades,
-- and admin "Remove module" fails once anyone has graded that module.
-- ---------------------------------------------------------------------------
alter table public.grades drop constraint grades_user_id_fkey,
  add constraint grades_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade;

alter table public.grades drop constraint grades_module_id_fkey,
  add constraint grades_module_id_fkey foreign key (module_id)
    references public.modules(id) on delete cascade;

alter table public.target_gpa drop constraint target_gpa_user_id_fkey,
  add constraint target_gpa_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade;

-- deleting a user under Authentication → Users also removes their profile
alter table public.profiles drop constraint profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id)
    references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- GRADES UPSERT KEY — main.js saves with onConflict 'user_id,module_id',
-- which needs a unique index on exactly those columns. Created only if
-- missing. If this step fails, a student has duplicate rows for one module.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.grades'::regclass
      and i.indisunique
      and (select array_agg(a.attname::text order by a.attname)
           from pg_attribute a
           where a.attrelid = i.indrelid and a.attnum = any (i.indkey))
          = array['module_id', 'user_id']
  ) then
    create unique index grades_user_id_module_id_key on public.grades (user_id, module_id);
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- CHECK: every table should show rowsecurity = true.
-- ---------------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
