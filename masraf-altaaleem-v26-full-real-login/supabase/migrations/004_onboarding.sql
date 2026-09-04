-- Automatic, isolated tenant provisioning for each new subscribing account.
create or replace function public.handle_new_subscriber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tenant_id uuid;
  org_name text;
begin
  org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name','')), '');
  if org_name is null then org_name := 'مساحتي التعليمية'; end if;
  if char_length(org_name) > 160 then org_name := left(org_name,160); end if;

  insert into public.tenants(name) values (org_name) returning id into new_tenant_id;
  insert into public.memberships(tenant_id,user_id,role) values (new_tenant_id,new.id,'tenant_owner');
  insert into public.subscriptions(tenant_id,status,plan_code,current_period_end)
    values (new_tenant_id,'trialing','teacher',now() + interval '14 days');

  insert into public.audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,metadata)
    values (new_tenant_id,new.id,'tenant.created','tenant',new_tenant_id::text,'{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_masraf on auth.users;
create trigger on_auth_user_created_masraf
after insert on auth.users
for each row execute function public.handle_new_subscriber();
