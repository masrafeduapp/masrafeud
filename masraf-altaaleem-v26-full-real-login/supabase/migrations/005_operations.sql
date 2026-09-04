-- Operational features: teacher/class assignment, attendance, tasks, submissions.
create type public.attendance_status as enum ('present','absent','late','excused');
create type public.task_submission_status as enum ('submitted','missing','excused');

create table public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(membership_id,class_id)
);
create index teacher_class_assignments_tenant_idx on public.teacher_class_assignments(tenant_id);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  attendance_date date not null default current_date,
  status public.attendance_status not null,
  note text check (note is null or char_length(note) <= 500),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,attendance_date)
);
create index attendance_tenant_date_idx on public.attendance_records(tenant_id,attendance_date desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  due_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index tasks_tenant_class_idx on public.tasks(tenant_id,class_id,created_at desc);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.task_submission_status not null,
  note text check (note is null or char_length(note) <= 500),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(task_id,student_id)
);
create index task_submissions_tenant_idx on public.task_submissions(tenant_id,task_id);

-- Cross-tenant integrity guards.
create or replace function public.enforce_assignment_tenant() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.memberships m where m.id=new.membership_id and m.tenant_id=new.tenant_id) then raise exception 'membership tenant mismatch'; end if;
  if not exists(select 1 from public.classes c where c.id=new.class_id and c.tenant_id=new.tenant_id) then raise exception 'class tenant mismatch'; end if;
  return new;
end; $$;
create trigger assignment_tenant_guard before insert or update on public.teacher_class_assignments for each row execute function public.enforce_assignment_tenant();

create or replace function public.enforce_attendance_tenant() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.students s where s.id=new.student_id and s.tenant_id=new.tenant_id and s.class_id=new.class_id) then raise exception 'student/class tenant mismatch'; end if;
  return new;
end; $$;
create trigger attendance_tenant_guard before insert or update on public.attendance_records for each row execute function public.enforce_attendance_tenant();

create or replace function public.enforce_task_tenant() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.classes c where c.id=new.class_id and c.tenant_id=new.tenant_id) then raise exception 'class tenant mismatch'; end if;
  return new;
end; $$;
create trigger task_tenant_guard before insert or update on public.tasks for each row execute function public.enforce_task_tenant();

create or replace function public.enforce_submission_tenant() returns trigger
language plpgsql set search_path='' as $$
declare task_class uuid;
begin
  select t.class_id into task_class from public.tasks t where t.id=new.task_id and t.tenant_id=new.tenant_id;
  if task_class is null then raise exception 'task tenant mismatch'; end if;
  if not exists(select 1 from public.students s where s.id=new.student_id and s.tenant_id=new.tenant_id and s.class_id=task_class) then raise exception 'student task mismatch'; end if;
  return new;
end; $$;
create trigger submission_tenant_guard before insert or update on public.task_submissions for each row execute function public.enforce_submission_tenant();

alter table public.teacher_class_assignments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;

revoke all on public.teacher_class_assignments,public.attendance_records,public.tasks,public.task_submissions from anon,authenticated;
grant select on public.teacher_class_assignments,public.attendance_records,public.tasks,public.task_submissions to authenticated;
grant insert,update,delete on public.teacher_class_assignments to authenticated;
grant insert,update on public.attendance_records,public.task_submissions to authenticated;
grant insert,update,delete on public.tasks to authenticated;

create policy assignments_select on public.teacher_class_assignments for select to authenticated using (public.is_tenant_member(tenant_id));
create policy assignments_manage on public.teacher_class_assignments for all to authenticated using (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[])) with check (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));

create policy attendance_select on public.attendance_records for select to authenticated using (public.is_tenant_member(tenant_id));
create policy attendance_insert on public.attendance_records for insert to authenticated with check (public.is_tenant_member(tenant_id) and recorded_by=auth.uid());
create policy attendance_update on public.attendance_records for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id) and recorded_by=auth.uid());

create policy tasks_select on public.tasks for select to authenticated using (public.is_tenant_member(tenant_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_tenant_member(tenant_id) and created_by=auth.uid());
create policy tasks_update on public.tasks for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy tasks_delete on public.tasks for delete to authenticated using (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));

create policy submissions_select on public.task_submissions for select to authenticated using (public.is_tenant_member(tenant_id));
create policy submissions_insert on public.task_submissions for insert to authenticated with check (public.is_tenant_member(tenant_id) and updated_by=auth.uid());
create policy submissions_update on public.task_submissions for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id) and updated_by=auth.uid());
