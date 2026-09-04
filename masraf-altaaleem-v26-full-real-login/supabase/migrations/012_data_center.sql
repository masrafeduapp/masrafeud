-- V14 data center profile + private tenant files
create table if not exists public.data_center_profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  teacher_name text not null default '',
  manager_name text not null default '',
  school_name text not null default '',
  teacher_rank text not null default '',
  primary_subject text not null default '',
  additional_subjects text[] not null default '{}',
  gregorian_year integer,
  hijri_year text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint data_center_year_check check (gregorian_year is null or gregorian_year between 2000 and 2200),
  constraint data_center_subjects_check check (coalesce(array_length(additional_subjects,1),0) <= 6)
);

create table if not exists public.data_center_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('school_logo','teacher_signature','ministry_logo')),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, kind)
);

alter table public.data_center_profiles enable row level security;
alter table public.data_center_files enable row level security;

revoke all on public.data_center_profiles, public.data_center_files from anon, authenticated;
grant select on public.data_center_profiles, public.data_center_files to authenticated;
grant insert, update, delete on public.data_center_profiles, public.data_center_files to authenticated;

create policy data_center_profiles_read on public.data_center_profiles
for select to authenticated using (public.is_tenant_member(tenant_id));
create policy data_center_profiles_manage on public.data_center_profiles
for all to authenticated
using (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]))
with check (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));

create policy data_center_files_read on public.data_center_files
for select to authenticated using (public.is_tenant_member(tenant_id));
create policy data_center_files_manage on public.data_center_files
for all to authenticated
using (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]))
with check (public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));

-- Private bucket. Files are accessed server-side after tenant membership verification.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'data-center',
  'data-center',
  false,
  8388608,
  array['image/png','image/jpeg','image/webp','application/pdf']
)
on conflict (id) do update set
  public=false,
  file_size_limit=8388608,
  allowed_mime_types=array['image/png','image/jpeg','image/webp','application/pdf'];

create index if not exists data_center_files_tenant_idx on public.data_center_files(tenant_id, kind);
