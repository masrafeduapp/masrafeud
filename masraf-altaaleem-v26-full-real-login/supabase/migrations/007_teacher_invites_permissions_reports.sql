-- Teacher invitations, profiles, and class-scoped teacher access.
create type public.invite_status as enum ('pending','accepted','revoked','expired');

create table public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 2 and 160),
  role public.member_role not null default 'teacher' check (role in ('admin','teacher')),
  status public.invite_status not null default 'pending',
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index teacher_invites_tenant_idx on public.teacher_invites(tenant_id, created_at desc);
create unique index teacher_invites_pending_unique on public.teacher_invites(tenant_id, lower(email)) where status='pending';

alter table public.member_profiles enable row level security;
alter table public.teacher_invites enable row level security;
revoke all on public.member_profiles, public.teacher_invites from anon, authenticated;
grant select on public.member_profiles, public.teacher_invites to authenticated;
grant insert,update on public.teacher_invites to authenticated;

create policy profiles_tenant_read on public.member_profiles for select to authenticated using (
  exists(select 1 from public.memberships mine join public.memberships theirs on theirs.user_id=member_profiles.user_id and theirs.tenant_id=mine.tenant_id where mine.user_id=auth.uid())
);
create policy invites_admin_read on public.teacher_invites for select to authenticated using (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));
create policy invites_admin_insert on public.teacher_invites for insert to authenticated with check (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]) and invited_by=auth.uid());
create policy invites_admin_update on public.teacher_invites for update to authenticated using (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[])) with check (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));

create or replace function public.can_access_class(target_tenant uuid, target_class uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.memberships m
    where m.tenant_id=target_tenant and m.user_id=auth.uid() and (
      m.role in ('tenant_owner','admin') or exists(
        select 1 from public.teacher_class_assignments a
        where a.tenant_id=target_tenant and a.membership_id=m.id and a.class_id=target_class
      )
    )
  );
$$;

-- Replace broad operational read/write policies with class-scoped rules for teachers.
drop policy if exists classes_select_member on public.classes;
create policy classes_select_scoped on public.classes for select to authenticated using (public.can_access_class(tenant_id,id));

drop policy if exists students_select_member on public.students;
drop policy if exists students_insert_member on public.students;
drop policy if exists students_update_member on public.students;
create policy students_select_scoped on public.students for select to authenticated using (class_id is not null and public.can_access_class(tenant_id,class_id));
create policy students_insert_scoped on public.students for insert to authenticated with check (class_id is not null and public.can_access_class(tenant_id,class_id));
create policy students_update_scoped on public.students for update to authenticated using (class_id is not null and public.can_access_class(tenant_id,class_id)) with check (class_id is not null and public.can_access_class(tenant_id,class_id));

drop policy if exists attendance_select on public.attendance_records;
drop policy if exists attendance_insert on public.attendance_records;
drop policy if exists attendance_update on public.attendance_records;
create policy attendance_select_scoped on public.attendance_records for select to authenticated using (public.can_access_class(tenant_id,class_id));
create policy attendance_insert_scoped on public.attendance_records for insert to authenticated with check (public.can_access_class(tenant_id,class_id) and recorded_by=auth.uid());
create policy attendance_update_scoped on public.attendance_records for update to authenticated using (public.can_access_class(tenant_id,class_id)) with check (public.can_access_class(tenant_id,class_id) and recorded_by=auth.uid());

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
create policy tasks_select_scoped on public.tasks for select to authenticated using (public.can_access_class(tenant_id,class_id));
create policy tasks_insert_scoped on public.tasks for insert to authenticated with check (public.can_access_class(tenant_id,class_id) and created_by=auth.uid());
create policy tasks_update_scoped on public.tasks for update to authenticated using (public.can_access_class(tenant_id,class_id)) with check (public.can_access_class(tenant_id,class_id));

drop policy if exists submissions_select on public.task_submissions;
drop policy if exists submissions_insert on public.task_submissions;
drop policy if exists submissions_update on public.task_submissions;
create policy submissions_select_scoped on public.task_submissions for select to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.tenant_id=tenant_id and public.can_access_class(tenant_id,t.class_id))
);
create policy submissions_insert_scoped on public.task_submissions for insert to authenticated with check (
  updated_by=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id and t.tenant_id=tenant_id and public.can_access_class(tenant_id,t.class_id))
);
create policy submissions_update_scoped on public.task_submissions for update to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.tenant_id=tenant_id and public.can_access_class(tenant_id,t.class_id))
) with check (updated_by=auth.uid());

-- Messaging follows the same class scope; teachers cannot read/send for unassigned classes.
drop policy if exists messages_select_member on public.outbound_messages;
drop policy if exists messages_insert_member on public.outbound_messages;
create policy messages_select_scoped on public.outbound_messages for select to authenticated using (
  exists(select 1 from public.students s where s.id=student_id and s.tenant_id=tenant_id and s.class_id is not null and public.can_access_class(tenant_id,s.class_id))
);
create policy messages_insert_scoped on public.outbound_messages for insert to authenticated with check (
  actor_user_id=auth.uid() and exists(select 1 from public.students s where s.id=student_id and s.tenant_id=tenant_id and s.class_id is not null and public.can_access_class(tenant_id,s.class_id))
);
