import { requirePlatformOwner } from '@/lib/owner'
import { setTenantPlan, setTenantStatus } from './actions'

function arStatus(status:string){
  const labels:Record<string,string>={trialing:'تجريبي',active:'نشط',past_due:'متأخر',canceled:'ملغي',expired:'منتهي',suspended:'موقوف'}
  return labels[status]||status
}

function dateText(value:string|null){
  if(!value)return '—'
  return new Intl.DateTimeFormat('ar-SA',{year:'numeric',month:'short',day:'numeric'}).format(new Date(value))
}

export default async function Owner(){
  const {admin}=await requirePlatformOwner()
  const [{data:tenants},{data:subs},{data:memberships},{data:plans},{data:logs}]=await Promise.all([
    admin.from('tenants').select('id,name,created_at').order('created_at',{ascending:false}),
    admin.from('subscriptions').select('tenant_id,status,plan_code,current_period_end,provider,updated_at'),
    admin.from('memberships').select('tenant_id,role'),
    admin.from('plans').select('code,name_ar,monthly_price_sar,is_active,sort_order').order('sort_order'),
    admin.from('audit_logs').select('id,tenant_id,action,metadata,created_at').like('action','platform.%').order('created_at',{ascending:false}).limit(8)
  ])

  const subMap=new Map((subs||[]).map(s=>[s.tenant_id,s]))
  const memberCounts=new Map<string,number>()
  for(const m of memberships||[]) memberCounts.set(m.tenant_id,(memberCounts.get(m.tenant_id)||0)+1)
  const activeCount=(subs||[]).filter(s=>s.status==='active'||s.status==='trialing').length
  const suspendedCount=(subs||[]).filter(s=>s.status==='suspended').length
  const priceMap=new Map((plans||[]).map(p=>[p.code,Number(p.monthly_price_sar||0)]))
  const mrr=(subs||[]).filter(s=>s.status==='active').reduce((sum,s)=>sum+(priceMap.get(s.plan_code)||0),0)
  const tenantName=new Map((tenants||[]).map(t=>[t.id,t.name]))

  return <main className="ownerShell">
    <header className="ownerTop"><div><span className="badge">إدارة المنصة</span><h1>لوحة مالك مصرف التعليم</h1><p>إدارة الحسابات والباقات والاشتراكات دون عرض محتوى الطلاب.</p></div><div className="ownerSeal">م</div></header>

    <section className="ownerMetrics">
      <article><small>إجمالي المشتركين</small><strong>{tenants?.length||0}</strong><span>مساحات مستقلة</span></article>
      <article><small>نشط / تجريبي</small><strong>{activeCount}</strong><span>حساب متاح</span></article>
      <article><small>الإيراد الشهري المحسوب</small><strong>{mrr.toLocaleString('ar-SA')} ر.س</strong><span>من الاشتراكات النشطة فقط</span></article>
      <article><small>حسابات موقوفة</small><strong>{suspendedCount}</strong><span>لا تدخل للنظام التشغيلي</span></article>
    </section>

    <section className="ownerCard">
      <div className="ownerSectionHead"><div><h2>المشتركون</h2><p>تظهر بيانات الحساب والإشتراك فقط؛ لا تظهر أسماء الطلاب أو رسائل أولياء الأمور.</p></div><span className="privacyChip">خصوصية العملاء مفعّلة</span></div>
      <div className="ownerTableWrap"><table className="ownerTable"><thead><tr><th>المشترك</th><th>الأعضاء</th><th>الباقة</th><th>الحالة</th><th>التجديد</th><th>إدارة</th></tr></thead><tbody>
        {(tenants||[]).map(t=>{const sub=subMap.get(t.id);return <tr key={t.id}>
          <td><b>{t.name}</b><small>منذ {dateText(t.created_at)}</small></td>
          <td>{memberCounts.get(t.id)||0}</td>
          <td><form action={setTenantPlan} className="ownerInline"><input type="hidden" name="tenant_id" value={t.id}/><select name="plan_code" defaultValue={sub?.plan_code||'teacher'}>{(plans||[]).filter(p=>p.is_active).map(p=><option key={p.code} value={p.code}>{p.name_ar}</option>)}</select><button>حفظ</button></form></td>
          <td><span className={`ownerStatus s-${sub?.status||'none'}`}>{sub?arStatus(sub.status):'بلا اشتراك'}</span></td>
          <td>{dateText(sub?.current_period_end||null)}</td>
          <td>{sub?<form action={setTenantStatus} className="ownerInline"><input type="hidden" name="tenant_id" value={t.id}/>{sub.status==='suspended'?<><input type="hidden" name="status" value="active"/><button className="activate">إعادة التفعيل</button></>:<><input type="hidden" name="status" value="suspended"/><button className="suspend">إيقاف الحساب</button></>}</form>:<span>—</span>}</td>
        </tr>})}
      </tbody></table></div>
    </section>

    <div className="ownerTwo">
      <section className="ownerCard"><div className="ownerSectionHead"><div><h2>الباقات</h2><p>الأسعار المرجعية المستخدمة في حساب الإيراد الشهري.</p></div></div><div className="ownerPlans">{(plans||[]).map(p=><div key={p.code}><b>{p.name_ar}</b><strong>{p.monthly_price_sar==null?'حسب الاتفاق':`${Number(p.monthly_price_sar).toLocaleString('ar-SA')} ر.س`}</strong><small>{p.code}</small></div>)}</div></section>
      <section className="ownerCard"><div className="ownerSectionHead"><div><h2>آخر عمليات المالك</h2><p>سجل تدقيق لتغييرات الاشتراك والباقات.</p></div></div><div className="ownerLog">{!logs?.length?<p className="muted">لا توجد عمليات بعد.</p>:logs.map(l=><div key={l.id}><span>{l.action==='platform.plan_changed'?'تغيير باقة':'تغيير حالة اشتراك'}</span><b>{l.tenant_id?tenantName.get(l.tenant_id)||'حساب محذوف':'—'}</b><small>{dateText(l.created_at)}</small></div>)}</div></section>
    </div>
  </main>
}
