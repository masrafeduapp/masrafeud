-- مصرف التعليم: بنية Multi-Tenant آمنة
create extension if not exists pgcrypto;

create type public.member_role as enum ('tenant_owner','admin','teacher');
create type public.subscription_status as enum ('trialing','active','past_due','canceled','expired');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'teacher',
  created_at timestamptz not null default now(),
  unique(tenant_id,user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create index memberships_tenant_idx on public.memberships(tenant_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create index classes_tenant_idx on public.classes(tenant_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 160),
  student_ref text,
  created_at timestamptz not null default now(),
  unique(tenant_id, student_ref)
);
create index students_tenant_idx on public.students(tenant_id);
create index students_class_idx on public.students(class_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  status public.subscription_status not null default 'trialing',
  plan_code text not null default 'teacher',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

create or replace function public.is_tenant_member(target_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.tenant_id=target_tenant and m.user_id=auth.uid());
$$;

create or replace function public.has_tenant_role(target_tenant uuid, allowed public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.tenant_id=target_tenant and m.user_id=auth.uid() and m.role=any(allowed));
$$;

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.tenants, public.memberships, public.classes, public.students, public.subscriptions, public.audit_logs from anon, authenticated;
grant select on public.tenants to authenticated;
grant select on public.memberships to authenticated;
grant select,insert,update,delete on public.classes to authenticated;
grant select,insert,update,delete on public.students to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.audit_logs to authenticated;

create policy tenants_select_member on public.tenants for select to authenticated using (public.is_tenant_member(id));
create policy memberships_select_same_tenant on public.memberships for select to authenticated using (public.is_tenant_member(tenant_id));
create policy classes_select_member on public.classes for select to authenticated using (public.is_tenant_member(tenant_id));
create policy classes_insert_admin on public.classes for insert to authenticated with check (public.has_tenant_role(tenant_id, array['tenant_owner','admin']::public.member_role[]));
create policy classes_update_admin on public.classes for update to authenticated using (public.has_tenant_role(tenant_id, array['tenant_owner','admin']::public.member_role[])) with check (public.has_tenant_role(tenant_id, array['tenant_owner','admin']::public.member_role[]));
create policy classes_delete_admin on public.classes for delete to authenticated using (public.has_tenant_role(tenant_id, array['tenant_owner','admin']::public.member_role[]));
create policy students_select_member on public.students for select to authenticated using (public.is_tenant_member(tenant_id));
create policy students_insert_member on public.students for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy students_update_member on public.students for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy students_delete_admin on public.students for delete to authenticated using (public.has_tenant_role(tenant_id, array['tenant_owner','admin']::public.member_role[]));
create policy subscriptions_select_member on public.subscriptions for select to authenticated using (public.is_tenant_member(tenant_id));
create policy audit_select_admin on public.audit_logs for select to authenticated using (public.has_tenant_role(tenant_id, array['tenant_owner','admin']::public.member_role[]));

-- إنشاء مساحة جديدة يتم فقط من خادم موثوق/وظيفة إدارية؛ لا توجد سياسة INSERT عامة للـ tenants أو memberships.
