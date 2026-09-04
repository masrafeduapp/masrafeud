-- Guardians + consent + outbound messaging with tenant isolation
create type public.message_channel as enum ('whatsapp','sms');
create type public.message_status as enum ('queued','sent','failed');

alter table public.students
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_consent boolean not null default false,
  add column if not exists guardian_consent_at timestamptz;

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  channel public.message_channel not null,
  recipient_phone_masked text not null,
  body text not null check (char_length(body) between 1 and 1200),
  status public.message_status not null default 'queued',
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outbound_messages_tenant_created_idx on public.outbound_messages(tenant_id, created_at desc);
create index if not exists outbound_messages_student_idx on public.outbound_messages(student_id);

alter table public.outbound_messages enable row level security;
revoke all on table public.outbound_messages from anon, authenticated;
grant select, insert on public.outbound_messages to authenticated;

create policy messages_select_member on public.outbound_messages for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy messages_insert_member on public.outbound_messages for insert to authenticated
with check (
  public.is_tenant_member(tenant_id)
  and actor_user_id = auth.uid()
  and exists(select 1 from public.students s where s.id=student_id and s.tenant_id=tenant_id)
);

-- Ensure class/student cross-tenant links cannot be created.
create or replace function public.enforce_student_class_tenant()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.class_id is not null and not exists(
    select 1 from public.classes c where c.id=new.class_id and c.tenant_id=new.tenant_id
  ) then raise exception 'class tenant mismatch'; end if;
  return new;
end; $$;

drop trigger if exists trg_student_class_tenant on public.students;
create trigger trg_student_class_tenant before insert or update on public.students
for each row execute function public.enforce_student_class_tenant();
