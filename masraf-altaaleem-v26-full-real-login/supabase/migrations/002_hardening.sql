-- يمنع ربط طالب بفصل تابع لمشترك آخر.
create or replace function public.enforce_student_class_tenant()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.class_id is not null and not exists(select 1 from public.classes c where c.id=new.class_id and c.tenant_id=new.tenant_id) then
    raise exception 'class does not belong to tenant';
  end if;
  return new;
end; $$;
create trigger students_class_tenant_guard before insert or update on public.students for each row execute function public.enforce_student_class_tenant();

-- لا تسمح للمستخدم بتغيير tenant_id لسجل قائم عبر update.
create or replace function public.prevent_tenant_reassignment()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.tenant_id is distinct from new.tenant_id then raise exception 'tenant reassignment is forbidden'; end if;
  return new;
end; $$;
create trigger classes_no_tenant_move before update on public.classes for each row execute function public.prevent_tenant_reassignment();
create trigger students_no_tenant_move before update on public.students for each row execute function public.prevent_tenant_reassignment();
