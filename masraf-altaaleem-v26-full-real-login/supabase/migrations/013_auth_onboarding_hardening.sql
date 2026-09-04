-- V18: harden subscriber onboarding so invited staff do not receive an accidental private tenant.
-- Also honor only known requested plan codes for new subscriber trials.
create or replace function public.handle_new_subscriber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tenant_id uuid;
  org_name text;
  requested_plan text;
begin
  -- Accounts created through an administrator invitation belong to the inviter's tenant.
  -- Their membership is attached after OTP confirmation by the trusted server flow.
  if coalesce((new.raw_user_meta_data->>'invited_member')::boolean, false) then
    return new;
  end if;

  org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name','')), '');
  if org_name is null then org_name := 'مساحتي التعليمية'; end if;
  if char_length(org_name) > 160 then org_name := left(org_name,160); end if;

  requested_plan := lower(trim(coalesce(new.raw_user_meta_data->>'requested_plan','teacher')));
  if requested_plan not in ('teacher','school','enterprise') then requested_plan := 'teacher'; end if;

  insert into public.tenants(name) values (org_name) returning id into new_tenant_id;
  insert into public.memberships(tenant_id,user_id,role) values (new_tenant_id,new.id,'tenant_owner');
  insert into public.subscriptions(tenant_id,status,plan_code,current_period_end)
    values (new_tenant_id,'trialing',requested_plan,now() + interval '14 days');

  insert into public.audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,metadata)
    values (new_tenant_id,new.id,'tenant.created','tenant',new_tenant_id::text,jsonb_build_object('requested_plan',requested_plan));
  return new;
end;
$$;
