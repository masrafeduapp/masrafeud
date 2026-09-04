-- لوحة مالك المنصة وإدارة الباقات والحسابات
-- لا تمنح هذه الجداول مالك المنصة أي وصول تلقائي إلى بيانات الطلاب.

do $$ begin
  alter type public.subscription_status add value if not exists 'suspended';
exception when duplicate_object then null;
end $$;

create table if not exists public.plans (
  code text primary key,
  name_ar text not null,
  monthly_price_sar numeric(10,2),
  max_members integer check (max_members is null or max_members > 0),
  max_students integer check (max_students is null or max_students > 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans(code,name_ar,monthly_price_sar,max_members,max_students,sort_order)
values
  ('teacher','معلمة',49,1,250,10),
  ('school','مدرسة',199,25,2500,20),
  ('enterprise','مؤسسة',null,null,null,30)
on conflict (code) do nothing;

alter table public.plans enable row level security;
revoke all on table public.plans from anon, authenticated;
grant select on public.plans to authenticated;
create policy plans_read_authenticated on public.plans for select to authenticated using (is_active = true);

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists subscriptions_plan_idx on public.subscriptions(plan_code);
