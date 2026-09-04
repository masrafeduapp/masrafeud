import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'

export default async function AdminHome(){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user) redirect('/auth/admin')
 const {data:memberships}=await supabase.from('memberships').select('role,tenant_id,tenants(name)').eq('user_id',user.id)
 const membership=(memberships||[]).find((m:any)=>m.role==='tenant_owner'||m.role==='admin') as any
 if(!membership) redirect('/auth/admin?denied=1')
 const tenant=(membership.tenants as any)?.name||'مصرف التعليم'
 const [teachers,classes,students]=await Promise.all([
   supabase.from('memberships').select('*',{count:'exact',head:true}).eq('tenant_id',membership.tenant_id),
   supabase.from('classes').select('*',{count:'exact',head:true}).eq('tenant_id',membership.tenant_id),
   supabase.from('students').select('*',{count:'exact',head:true}).eq('tenant_id',membership.tenant_id),
 ])
 return <DashboardShell active="/admin" tenant={tenant}><div className="bankContent"><section className="bankHero"><div className="welcomeCard"><span className="badge">بوابة الإدارة</span><h1>مركز إدارة مصرف التعليم</h1><p>إدارة المعلمين والفصول والتقارير والاشتراك من مساحة إدارية محمية بالصلاحيات.</p></div></section><div className="grid4"><div className="card metric"><small>الأعضاء</small><strong>{teachers.count||0}</strong></div><div className="card metric"><small>الفصول</small><strong>{classes.count||0}</strong></div><div className="card metric"><small>الطلاب</small><strong>{students.count||0}</strong></div><div className="card metric"><small>حالة البوابة</small><strong style={{fontSize:20}}>نشطة</strong></div></div><section className="card composer" style={{marginTop:18}}><h2>الإدارة السريعة</h2><div className="quickGrid"><Link className="quickCard" href="/teachers"><b>المعلمين والصلاحيات</b><p className="muted">الدعوات وتوزيع الصلاحيات</p></Link><Link className="quickCard" href="/classes"><b>الفصول</b><p className="muted">إدارة الفصول وربط المعلمين</p></Link><Link className="quickCard" href="/reports"><b>التقارير</b><p className="muted">تقارير وإحصاءات المدرسة</p></Link><Link className="quickCard" href="/subscription"><b>الاشتراك</b><p className="muted">حالة الباقة والفوترة</p></Link></div></section></div></DashboardShell>
}
