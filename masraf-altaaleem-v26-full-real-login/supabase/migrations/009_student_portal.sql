-- Student portal accounts are intentionally NOT exposed to authenticated/anon clients.
-- All credential operations are server-only through the service-role client.
create table public.student_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  username text not null,
  password_hash text not null,
  active boolean not null default true,
  failed_login_attempts integer not null default 0 check (failed_login_attempts between 0 and 1000),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (username),
  check (username = lower(username)),
  check (char_length(username) between 4 and 40),
  check (char_length(password_hash) between 40 and 400)
);
create index student_portal_accounts_tenant_idx on public.student_portal_accounts(tenant_id);
alter table public.student_portal_accounts enable row level security;
revoke all on public.student_portal_accounts from anon, authenticated;

-- Student portal presentation settings. Safe for tenant staff to manage/read via RLS.
create table public.student_portal_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  school_label text,
  subject_label text not null default 'التعليم',
  show_balance boolean not null default true,
  show_points boolean not null default true,
  show_honor_board boolean not null default true,
  show_rewards boolean not null default true,
  show_evaluations boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.student_portal_settings enable row level security;
revoke all on public.student_portal_settings from anon, authenticated;
grant select,insert,update on public.student_portal_settings to authenticated;
create policy student_portal_settings_read on public.student_portal_settings
for select to authenticated using(public.is_tenant_member(tenant_id));
create policy student_portal_settings_manage on public.student_portal_settings
for all to authenticated
using(public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]))
with check(public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));

-- Roulette chances and rewards are recorded separately from points redemptions.
alter table public.student_metrics add column if not exists roulette_chances integer not null default 0 check (roulette_chances between 0 and 10000);
alter table public.rewards add column if not exists reward_balance numeric(12,2) not null default 0 check (reward_balance between 0 and 1000000);
alter table public.rewards add column if not exists reward_points integer not null default 0 check (reward_points between 0 and 100000);

create table public.reward_spin_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  reward_name text not null,
  balance_awarded numeric(12,2) not null default 0,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now()
);
create index reward_spin_history_student_idx on public.reward_spin_history(student_id,created_at desc);
alter table public.reward_spin_history enable row level security;
revoke all on public.reward_spin_history from anon,authenticated;
grant select on public.reward_spin_history to authenticated;
create policy reward_spin_history_staff_read on public.reward_spin_history
for select to authenticated using(public.can_access_student(tenant_id,student_id));

-- Student-originated educational transfers are auditable and cannot mint balance.
alter table public.student_operations alter column actor_user_id drop not null;
alter table public.student_operations add column if not exists actor_student_account_id uuid references public.student_portal_accounts(id) on delete set null;

create or replace function public.transfer_student_educational_balance(
  p_actor_account uuid,
  p_from_student uuid,
  p_to_student uuid,
  p_amount numeric,
  p_reason text
) returns numeric
language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_to_tenant uuid; v_balance numeric;
begin
  if p_from_student=p_to_student then raise exception 'same account'; end if;
  if p_amount<=0 or p_amount>1000000 then raise exception 'invalid amount'; end if;
  if char_length(trim(coalesce(p_reason,'')))<2 then raise exception 'invalid reason'; end if;
  select tenant_id into v_tenant from public.student_portal_accounts where id=p_actor_account and student_id=p_from_student and active=true;
  if v_tenant is null then raise exception 'not allowed'; end if;
  select tenant_id into v_to_tenant from public.students where id=p_to_student;
  if v_to_tenant is distinct from v_tenant then raise exception 'cross tenant transfer blocked'; end if;
  insert into public.student_metrics(student_id,tenant_id) values(p_from_student,v_tenant) on conflict(student_id) do nothing;
  insert into public.student_metrics(student_id,tenant_id) values(p_to_student,v_tenant) on conflict(student_id) do nothing;
  select balance into v_balance from public.student_metrics where student_id=p_from_student for update;
  if v_balance<p_amount then raise exception 'insufficient balance'; end if;
  update public.student_metrics set balance=balance-p_amount,updated_at=now() where student_id=p_from_student returning balance into v_balance;
  update public.student_metrics set balance=balance+p_amount,updated_at=now() where student_id=p_to_student;
  insert into public.student_operations(tenant_id,student_id,operation_type,amount,reason,actor_user_id,actor_student_account_id)
    values(v_tenant,p_from_student,'debit',p_amount,'تحويل إلى طالب/ة: '||trim(p_reason),null,p_actor_account);
  insert into public.student_operations(tenant_id,student_id,operation_type,amount,reason,actor_user_id,actor_student_account_id)
    values(v_tenant,p_to_student,'credit',p_amount,'تحويل من طالب/ة: '||trim(p_reason),null,p_actor_account);
  return v_balance;
end; $$;
revoke all on function public.transfer_student_educational_balance(uuid,uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.transfer_student_educational_balance(uuid,uuid,uuid,numeric,text) to service_role;
-- This RPC is called only from trusted server code after a signed student session is verified.
