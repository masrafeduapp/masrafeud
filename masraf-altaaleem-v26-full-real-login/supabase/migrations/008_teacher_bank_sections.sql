-- Bank-style teacher sections backed by real tenant-scoped data.
create type public.educational_operation_type as enum ('credit','debit');

create table public.student_metrics (
  student_id uuid primary key references public.students(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now()
);
create index student_metrics_tenant_idx on public.student_metrics(tenant_id);

create table public.student_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  operation_type public.educational_operation_type not null,
  amount numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  reason text not null check (char_length(reason) between 2 and 300),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index student_operations_tenant_created_idx on public.student_operations(tenant_id,created_at desc);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  delta integer not null check (delta between -100000 and 100000 and delta <> 0),
  reason text not null check (char_length(reason) between 2 and 300),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index point_transactions_tenant_created_idx on public.point_transactions(tenant_id,created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  points_cost integer not null check (points_cost between 0 and 100000),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index rewards_tenant_idx on public.rewards(tenant_id,active);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  points_spent integer not null check (points_spent >= 0),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.teacher_bank_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  auto_deduction_enabled boolean not null default false,
  absence_points_deduction integer not null default 0 check (absence_points_deduction between 0 and 1000),
  late_points_deduction integer not null default 0 check (late_points_deduction between 0 and 1000),
  honor_board_count integer not null default 5 check (honor_board_count between 1 and 20),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.student_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 100),
  score numeric(5,2) not null check (score between 0 and 100),
  note text check (note is null or char_length(note) <= 500),
  evaluated_by uuid not null references auth.users(id) on delete restrict,
  evaluation_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index student_evaluations_tenant_date_idx on public.student_evaluations(tenant_id,evaluation_date desc);

-- Tenant integrity for student-linked records.
create or replace function public.guard_student_metric_tenant() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.students s where s.id=new.student_id and s.tenant_id=new.tenant_id) then raise exception 'student tenant mismatch'; end if;
  return new;
end; $$;
create trigger student_metrics_tenant_guard before insert or update on public.student_metrics for each row execute function public.guard_student_metric_tenant();
create trigger student_operations_tenant_guard before insert or update on public.student_operations for each row execute function public.guard_student_metric_tenant();
create trigger point_transactions_tenant_guard before insert or update on public.point_transactions for each row execute function public.guard_student_metric_tenant();
create trigger student_evaluations_tenant_guard before insert or update on public.student_evaluations for each row execute function public.guard_student_metric_tenant();

create or replace function public.can_access_student(target_tenant uuid,target_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.students s where s.id=target_student and s.tenant_id=target_tenant and s.class_id is not null and public.can_access_class(target_tenant,s.class_id));
$$;

-- Atomic balance adjustment; caller must be allowed to access the student's class.
create or replace function public.adjust_student_balance(p_student uuid,p_type public.educational_operation_type,p_amount numeric,p_reason text)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_balance numeric;
begin
  select tenant_id into v_tenant from public.students where id=p_student;
  if v_tenant is null or not public.can_access_student(v_tenant,p_student) then raise exception 'not allowed'; end if;
  if p_amount <= 0 or p_amount > 1000000 or char_length(trim(p_reason)) < 2 then raise exception 'invalid operation'; end if;
  insert into public.student_metrics(student_id,tenant_id) values(p_student,v_tenant) on conflict(student_id) do nothing;
  if p_type='debit' then
    select balance into v_balance from public.student_metrics where student_id=p_student for update;
    if v_balance < p_amount then raise exception 'insufficient educational balance'; end if;
    update public.student_metrics set balance=balance-p_amount,updated_at=now() where student_id=p_student returning balance into v_balance;
  else
    update public.student_metrics set balance=balance+p_amount,updated_at=now() where student_id=p_student returning balance into v_balance;
  end if;
  insert into public.student_operations(tenant_id,student_id,operation_type,amount,reason,actor_user_id) values(v_tenant,p_student,p_type,p_amount,trim(p_reason),auth.uid());
  return v_balance;
end; $$;

create or replace function public.adjust_student_points(p_student uuid,p_delta integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_points integer;
begin
  select tenant_id into v_tenant from public.students where id=p_student;
  if v_tenant is null or not public.can_access_student(v_tenant,p_student) then raise exception 'not allowed'; end if;
  if p_delta=0 or abs(p_delta)>100000 or char_length(trim(p_reason))<2 then raise exception 'invalid points transaction'; end if;
  insert into public.student_metrics(student_id,tenant_id) values(p_student,v_tenant) on conflict(student_id) do nothing;
  select points into v_points from public.student_metrics where student_id=p_student for update;
  if v_points + p_delta < 0 then raise exception 'insufficient points'; end if;
  update public.student_metrics set points=points+p_delta,updated_at=now() where student_id=p_student returning points into v_points;
  insert into public.point_transactions(tenant_id,student_id,delta,reason,actor_user_id) values(v_tenant,p_student,p_delta,trim(p_reason),auth.uid());
  return v_points;
end; $$;

alter table public.student_metrics enable row level security;
alter table public.student_operations enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.teacher_bank_settings enable row level security;
alter table public.student_evaluations enable row level security;

revoke all on public.student_metrics,public.student_operations,public.point_transactions,public.rewards,public.reward_redemptions,public.teacher_bank_settings,public.student_evaluations from anon,authenticated;
grant select on public.student_metrics,public.student_operations,public.point_transactions,public.rewards,public.reward_redemptions,public.teacher_bank_settings,public.student_evaluations to authenticated;
grant insert,update,delete on public.rewards to authenticated;
grant insert on public.student_evaluations to authenticated;
grant insert,update on public.teacher_bank_settings to authenticated;
grant execute on function public.adjust_student_balance(uuid,public.educational_operation_type,numeric,text) to authenticated;
grant execute on function public.adjust_student_points(uuid,integer,text) to authenticated;

create policy metrics_read on public.student_metrics for select to authenticated using(public.can_access_student(tenant_id,student_id));
create policy operations_read on public.student_operations for select to authenticated using(public.can_access_student(tenant_id,student_id));
create policy points_read on public.point_transactions for select to authenticated using(public.can_access_student(tenant_id,student_id));
create policy rewards_read on public.rewards for select to authenticated using(public.is_tenant_member(tenant_id));
create policy rewards_manage on public.rewards for all to authenticated using(public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[])) with check(public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]) and created_by=auth.uid());
create policy redemptions_read on public.reward_redemptions for select to authenticated using(public.can_access_student(tenant_id,student_id));
create policy teacher_settings_read on public.teacher_bank_settings for select to authenticated using(public.is_tenant_member(tenant_id));
create policy teacher_settings_manage on public.teacher_bank_settings for all to authenticated using(public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[])) with check(public.has_tenant_role(tenant_id,array['tenant_owner','admin']::public.member_role[]));
create policy evaluations_read on public.student_evaluations for select to authenticated using(public.can_access_student(tenant_id,student_id));
create policy evaluations_insert on public.student_evaluations for insert to authenticated with check(public.can_access_student(tenant_id,student_id) and evaluated_by=auth.uid());

create or replace function public.redeem_reward(p_student uuid,p_reward uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_cost integer; v_points integer;
begin
  select tenant_id into v_tenant from public.students where id=p_student;
  if v_tenant is null or not public.can_access_student(v_tenant,p_student) then raise exception 'not allowed'; end if;
  select points_cost into v_cost from public.rewards where id=p_reward and tenant_id=v_tenant and active=true;
  if v_cost is null then raise exception 'reward unavailable'; end if;
  insert into public.student_metrics(student_id,tenant_id) values(p_student,v_tenant) on conflict(student_id) do nothing;
  select points into v_points from public.student_metrics where student_id=p_student for update;
  if v_points < v_cost then raise exception 'insufficient points'; end if;
  update public.student_metrics set points=points-v_cost,updated_at=now() where student_id=p_student returning points into v_points;
  insert into public.point_transactions(tenant_id,student_id,delta,reason,actor_user_id) values(v_tenant,p_student,-v_cost,'استبدال جائزة',auth.uid());
  insert into public.reward_redemptions(tenant_id,reward_id,student_id,points_spent,actor_user_id) values(v_tenant,p_reward,p_student,v_cost,auth.uid());
  return v_points;
end; $$;
grant execute on function public.redeem_reward(uuid,uuid) to authenticated;

create table public.attendance_point_effects (
  attendance_id uuid primary key references public.attendance_records(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  delta integer not null check (delta <= 0),
  created_at timestamptz not null default now()
);
alter table public.attendance_point_effects enable row level security;
revoke all on public.attendance_point_effects from anon,authenticated;
grant select on public.attendance_point_effects to authenticated;
create policy attendance_effects_read on public.attendance_point_effects for select to authenticated using(public.can_access_student(tenant_id,student_id));

create or replace function public.apply_attendance_point_setting() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_enabled boolean; v_absent integer; v_late integer; v_requested integer:=0; v_current integer:=0; v_applied integer:=0; v_old integer:=0;
begin
  -- Reverse any prior automatic effect before recalculating an updated attendance record.
  select -delta into v_old from public.attendance_point_effects where attendance_id=new.id;
  if coalesce(v_old,0)>0 then
    insert into public.student_metrics(student_id,tenant_id) values(new.student_id,new.tenant_id) on conflict(student_id) do nothing;
    update public.student_metrics set points=points+v_old,updated_at=now() where student_id=new.student_id;
    insert into public.point_transactions(tenant_id,student_id,delta,reason,actor_user_id) values(new.tenant_id,new.student_id,v_old,'تصحيح حسم تلقائي للحضور',new.recorded_by);
    delete from public.attendance_point_effects where attendance_id=new.id;
  end if;
  select auto_deduction_enabled,absence_points_deduction,late_points_deduction into v_enabled,v_absent,v_late from public.teacher_bank_settings where tenant_id=new.tenant_id;
  if not coalesce(v_enabled,false) then return new; end if;
  if new.status='absent' then v_requested:=coalesce(v_absent,0); elsif new.status='late' then v_requested:=coalesce(v_late,0); else v_requested:=0; end if;
  if v_requested<=0 then return new; end if;
  insert into public.student_metrics(student_id,tenant_id) values(new.student_id,new.tenant_id) on conflict(student_id) do nothing;
  select points into v_current from public.student_metrics where student_id=new.student_id for update;
  v_applied:=least(v_current,v_requested);
  if v_applied>0 then
    update public.student_metrics set points=points-v_applied,updated_at=now() where student_id=new.student_id;
    insert into public.point_transactions(tenant_id,student_id,delta,reason,actor_user_id) values(new.tenant_id,new.student_id,-v_applied,case when new.status='absent' then 'حسم تلقائي: غياب' else 'حسم تلقائي: تأخر' end,new.recorded_by);
    insert into public.attendance_point_effects(attendance_id,tenant_id,student_id,delta) values(new.id,new.tenant_id,new.student_id,-v_applied);
  end if;
  return new;
end; $$;
create trigger attendance_auto_points after insert or update of status on public.attendance_records for each row execute function public.apply_attendance_point_setting();
