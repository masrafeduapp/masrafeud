import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function n(v:any){return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(Number(v||0))}
function pin(ref:string|undefined,id:string){const raw=(ref||id.replace(/-/g,'')).replace(/\D/g,'');return raw.slice(-6).padStart(6,'0')}

export default async function ClassDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,tenants(name)').eq('user_id',user.id).maybeSingle();if(!m)redirect('/dashboard')
 const {data:cls}=await supabase.from('classes').select('id,name').eq('tenant_id',m.tenant_id).eq('id',id).maybeSingle();if(!cls)notFound()
 const {data:students}=await supabase.from('students').select('id,full_name,student_ref,guardian_name,guardian_phone,guardian_consent').eq('tenant_id',m.tenant_id).eq('class_id',id).order('full_name')
 const ids=(students||[]).map((s:any)=>s.id);const admin=createAdminClient()
 let metrics:any[]=[];let accounts:any[]=[];let submissions:any[]=[]
 if(ids.length){
  const results=await Promise.all([
   admin.from('student_metrics').select('student_id,balance,points,roulette_chances').eq('tenant_id',m.tenant_id).in('student_id',ids),
   admin.from('student_portal_accounts').select('student_id,username,active,last_login_at').eq('tenant_id',m.tenant_id).in('student_id',ids),
   supabase.from('task_submissions').select('student_id,status').eq('tenant_id',m.tenant_id).in('student_id',ids)
  ]); metrics=results[0].data||[];accounts=results[1].data||[];submissions=results[2].data||[]
 }
 const mm=new Map(metrics.map(x=>[x.student_id,x]));const am=new Map(accounts.map(x=>[x.student_id,x]))
 const pending=new Map<string,number>();for(const s of submissions){if(s.status==='missing')pending.set(s.student_id,(pending.get(s.student_id)||0)+1)}
 const totalBalance=(students||[]).reduce((a:any,s:any)=>a+Number(mm.get(s.id)?.balance||0),0)
 const totalPoints=(students||[]).reduce((a:any,s:any)=>a+Number(mm.get(s.id)?.points||0),0)
 const tenant=(m.tenants as any)?.name||'مصرف التعليم';const teacher=(user.user_metadata?.full_name||user.user_metadata?.name||'المعلمة') as string
 return <DashboardShell active="/advanced" tenant={tenant}><div className="classDetailPage" dir="rtl">
  <div className="classDetailHead"><div><span>لوحة التحكم المتقدمة / الفصول</span><h1>{cls.name}</h1><p>{tenant} • {teacher}</p></div><Link href="/advanced" className="backClasses">رجوع إلى الفصول</Link></div>
  <section className="classToolCard">
   <div className="classQuickActions"><Link href={`/operations?class=${id}&type=credit`} className="qa primary">إيداع للكل</Link><Link href={`/operations?class=${id}&type=debit`} className="qa">سحب للكل</Link><Link href={`/reports?class=${id}`} className="qa">تقرير PDF</Link><Link href={`/messages?class=${id}`} className="qa">رسالة جماعية</Link><Link href={`/messages?class=${id}`} className="qa">رسالة لولي أمر محدد</Link></div>
   <div className="classFilters"><div>⌕ <span>فلترة بالاسم</span></div><div>كل المستويات⌄</div><div>كل الحالات⌄</div></div>
   <div className="classMiniStats"><div><span>إجمالي أرصدة الفصل</span><b>{n(totalBalance)}</b></div><div><span>إجمالي النقاط</span><b>{n(totalPoints)}</b></div><div><span>الطلاب النشطون</span><b>{n((students||[]).filter((s:any)=>am.get(s.id)?.active!==false).length)}</b></div><div><span>المهام غير المسلمة</span><b>{n([...pending.values()].reduce((a,b)=>a+b,0))}</b></div></div>
  </section>
  {!students?.length?<div className="classEmpty"><h2>لا يوجد طلاب في هذا الفصل</h2><Link href="/students">إضافة طالب</Link></div>:<div className="studentBankGrid">{students.map((s:any)=>{const metric:any=mm.get(s.id)||{};const acc:any=am.get(s.id);const isActive=acc?.active!==false;return <article className="studentBankCard" key={s.id}>
   <div className="studentCardIdentity"><div className="miniBankCard">💳</div><div className="studentName"><h2>{s.full_name}</h2><p>اسم المستخدم: <b dir="ltr">{acc?.username||'غير منشأ'}</b></p><p>ولي الأمر: {s.guardian_name||'—'} • <span dir="ltr">{s.guardian_phone||'—'}</span></p></div><span className="levelPill">الحساب • {isActive?'نشط':'موقوف'}</span></div>
   <div className="studentTopFacts"><div><span>الرصيد</span><b>{n(metric.balance)}</b></div><div><span>عدد السحوبات</span><b>—</b></div><div><span>النقاط</span><b>{n(metric.points)}</b></div></div>
   <div className="studentInfoGrid"><div><span>نوع الحساب</span><b>طالب</b></div><div><span>الرقم السري</span><b dir="ltr">{pin(s.student_ref,s.id)}</b></div><div><span>الحالة</span><b className={isActive?'greenText':'redText'}>{isActive?'نشط':'موقوف'}</b></div><div><span>المادة</span><b>التعليم</b></div><div><span>المعلمة</span><b>{teacher}</b></div><div><span>المهام غير المسلمة</span><b>{n(pending.get(s.id)||0)}</b></div></div>
   <div className="absenceBar"><span>شريط المتابعة</span><b>اضغطي للتعديل</b><i></i></div>
   <div className="studentActionGrid"><Link href={`/operations?student=${s.id}`} className="studentAction statement">كشف الحساب</Link><Link href={`/operations?student=${s.id}&type=credit`} className="studentAction">إيداع</Link><Link href={`/operations?student=${s.id}&type=debit`} className="studentAction warn">سحب</Link><Link href={`/operations?student=${s.id}&mode=transfer`} className="studentAction">تحويل</Link><Link href={`/points?student=${s.id}`} className="studentAction">مكافأة</Link><Link href={`/followup?student=${s.id}`} className="studentAction">المهام</Link><Link href={`/messages?student=${s.id}`} className="studentAction">رسالة ولي الأمر</Link><Link href={`/students?student=${s.id}`} className="studentAction">تعديل الاسم</Link><Link href={`/students?student=${s.id}`} className="studentAction">تعديل اسم المستخدم</Link><Link href={`/students?student=${s.id}`} className="studentAction">تغيير كلمة السر</Link><Link href={`/students?student=${s.id}`} className="studentAction">تفعيل الحساب</Link><Link href={`/messages?student=${s.id}`} className="studentAction">ملاحظة</Link><Link href={`/data?student=${s.id}`} className="studentAction">رفع ملف</Link><Link href={`/students?student=${s.id}`} className="studentAction freeze">تجميد</Link><Link href={`/students?student=${s.id}`} className="studentAction danger">حذف الطالب</Link></div>
  </article>})}</div>}
 </div></DashboardShell>
}
