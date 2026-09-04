-- Real in-app student communication and achievements.
create table public.student_portal_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 2 and 1200),
  message_type text not null default 'info' check (message_type in ('info','success','warning','task')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index student_portal_messages_student_idx on public.student_portal_messages(student_id,created_at desc);

create table public.achievement_badges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text check (description is null or char_length(description) <= 400),
  icon text not null default '🏅' check (char_length(icon) between 1 and 20),
  points_bonus integer not null default 0 check (points_bonus between 0 and 10000),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index achievement_badges_tenant_idx on public.achievement_badges(tenant_id,active);

create table public.student_achievement_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  badge_id uuid not null references public.achievement_badges(id) on delete restrict,
  awarded_by uuid not null references auth.users(id) on delete restrict,
  note text check (note is null or char_length(note) <= 400),
  awarded_at timestamptz not null default now(),
  unique(student_id,badge_id)
);
create index student_achievement_awards_student_idx on public.student_achievement_awards(student_id,awarded_at desc);

create or replace function public.guard_engagement_student_tenant() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.students s where s.id=new.student_id and s.tenant_id=new.tenant_id) then
    raise exception 'student tenant mismatch';
  end if;
  return new;
end; $$;
create trigger portal_messages_tenant_guard before insert or update on public.student_portal_messages for each row execute function public.guard_engagement_student_tenant();
create trigger achievement_awards_tenant_guard before insert or update on public.student_achievement_awards for each row execute function public.guard_engagement_student_tenant();

create or replace function public.guard_achievement_badge_tenant() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.achievement_badges b where b.id=new.badge_id and b.tenant_id=new.tenant_id) then
    raise exception 'badge tenant mismatch';
  end if;
  return new;
end; $$;
create trigger achievement_awards_badge_guard before insert or update on public.student_achievement_awards for each row execute function public.guard_achievement_badge_tenant();

alter table public.student_portal_messages enable row level security;
alter table public.achievement_badges enable row level security;
alter table public.student_achievement_awards enable row level security;

revoke all on public.student_portal_messages,public.achievement_badges,public.student_achievement_awards from anon,authenticated;
grant select,insert on public.student_portal_messages to authenticated;
grant select,insert,update,delete on public.achievement_badges to authenticated;
grant select,insert,delete on public.student_achievement_awards to authenticated;

create policy portal_messages_staff_read on public.student_portal_messages for select to authenticated
using(public.can_access_student(tenant_id,student_id));
create policy portal_messages_staff_insert on public.student_portal_messages for insert to authenticated
with check(public.can_access_student(tenant_id,student_id) and created_by=auth.uid());

create policy achievement_badges_staff_read on public.achievement_badges for select to authenticated
using(public.is_tenant_member(tenant_id));
create policy achievement_badges_manage on public.achievement_badges for all to authenticated
using(public.is_tenant_member(tenant_id))
with check(public.is_tenant_member(tenant_id) and created_by=auth.uid());

create policy achievement_awards_staff_read on public.student_achievement_awards for select to authenticated
using(public.can_access_student(tenant_id,student_id));
create policy achievement_awards_staff_insert on public.student_achievement_awards for insert to authenticated
with check(public.can_access_student(tenant_id,student_id) and awarded_by=auth.uid());
create policy achievement_awards_staff_delete on public.student_achievement_awards for delete to authenticated
using(public.can_access_student(tenant_id,student_id));

-- Award badge atomically and apply its optional points bonus exactly once.
create or replace function public.award_student_badge(p_student uuid,p_badge uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_bonus integer; v_award uuid;
begin
  select tenant_id into v_tenant from public.students where id=p_student;
  if v_tenant is null or not public.can_access_student(v_tenant,p_student) then raise exception 'not allowed'; end if;
  select points_bonus into v_bonus from public.achievement_badges where id=p_badge and tenant_id=v_tenant and active=true;
  if v_bonus is null then raise exception 'badge unavailable'; end if;
  insert into public.student_achievement_awards(tenant_id,student_id,badge_id,awarded_by,note)
    values(v_tenant,p_student,p_badge,auth.uid(),nullif(trim(coalesce(p_note,'')),'')) returning id into v_award;
  if v_bonus>0 then perform public.adjust_student_points(p_student,v_bonus,'مكافأة شارة إنجاز'); end if;
  return v_award;
exception when unique_violation then
  raise exception 'badge already awarded';
end; $$;
grant execute on function public.award_student_badge(uuid,uuid,text) to authenticated;

alter table public.student_portal_settings add column if not exists show_messages boolean not null default true;
alter table public.student_portal_settings add column if not exists show_achievements boolean not null default true;

-- Atomic roulette spin for student portal; prevents double-spending a chance under concurrent requests.
create or replace function public.spin_student_roulette(p_actor_account uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid; v_student uuid; v_chances integer; v_reward public.rewards%rowtype;
  v_balance numeric; v_points integer;
begin
  select tenant_id,student_id into v_tenant,v_student from public.student_portal_accounts
    where id=p_actor_account and active=true;
  if v_tenant is null then raise exception 'not allowed'; end if;

  insert into public.student_metrics(student_id,tenant_id) values(v_student,v_tenant) on conflict(student_id) do nothing;
  select roulette_chances into v_chances from public.student_metrics where student_id=v_student for update;
  if coalesce(v_chances,0)<=0 then raise exception 'no chances'; end if;

  select * into v_reward from public.rewards where tenant_id=v_tenant and active=true order by random() limit 1;
  if v_reward.id is null then raise exception 'no rewards'; end if;

  update public.student_metrics
     set roulette_chances=roulette_chances-1,
         balance=balance+coalesce(v_reward.reward_balance,0),
         points=points+coalesce(v_reward.reward_points,0),
         updated_at=now()
   where student_id=v_student
   returning balance,points into v_balance,v_points;

  insert into public.reward_spin_history(tenant_id,student_id,reward_id,reward_name,balance_awarded,points_awarded)
  values(v_tenant,v_student,v_reward.id,v_reward.name,coalesce(v_reward.reward_balance,0),coalesce(v_reward.reward_points,0));

  if coalesce(v_reward.reward_balance,0)>0 then
    insert into public.student_operations(tenant_id,student_id,operation_type,amount,reason,actor_user_id,actor_student_account_id)
    values(v_tenant,v_student,'credit',v_reward.reward_balance,'جائزة الروليت: '||v_reward.name,null,p_actor_account);
  end if;
  if coalesce(v_reward.reward_points,0)>0 then
    insert into public.point_transactions(tenant_id,student_id,delta,reason,actor_user_id)
    values(v_tenant,v_student,v_reward.reward_points,'جائزة الروليت: '||v_reward.name,(select created_by from public.rewards where id=v_reward.id));
  end if;

  return jsonb_build_object('reward_name',v_reward.name,'balance_awarded',v_reward.reward_balance,'points_awarded',v_reward.reward_points,'balance',v_balance,'points',v_points,'chances_left',v_chances-1);
end; $$;
revoke all on function public.spin_student_roulette(uuid) from public,anon,authenticated;
grant execute on function public.spin_student_roulette(uuid) to service_role;
