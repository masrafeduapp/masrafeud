-- Follow-up workspace enhancements: task metadata and per-student notes.
alter table public.tasks add column if not exists task_type text not null default 'واجب' check (char_length(task_type) between 1 and 80);
alter table public.tasks add column if not exists grade numeric(6,2) not null default 0 check (grade >= 0 and grade <= 9999);
alter table public.tasks add column if not exists starts_on date;
alter table public.tasks add column if not exists is_published boolean not null default true;

create table if not exists public.student_followup_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(student_id)
);
create index if not exists student_followup_notes_tenant_idx on public.student_followup_notes(tenant_id,updated_at desc);

alter table public.student_followup_notes enable row level security;
revoke all on public.student_followup_notes from anon,authenticated;
grant select,insert,update,delete on public.student_followup_notes to authenticated;

create policy followup_notes_select on public.student_followup_notes for select to authenticated
using (public.can_access_student(tenant_id,student_id));
create policy followup_notes_insert on public.student_followup_notes for insert to authenticated
with check (public.can_access_student(tenant_id,student_id) and updated_by=auth.uid());
create policy followup_notes_update on public.student_followup_notes for update to authenticated
using (public.can_access_student(tenant_id,student_id))
with check (public.can_access_student(tenant_id,student_id) and updated_by=auth.uid());
create policy followup_notes_delete on public.student_followup_notes for delete to authenticated
using (public.can_access_student(tenant_id,student_id));
