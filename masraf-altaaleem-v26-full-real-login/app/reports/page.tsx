import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'

export default async function Reports(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,tenants(name)').eq('user_id',user.id).maybeSingle(); if(!m) redirect('/dashboard')
 const tenant=(m.tenants as any)?.name||'مساحتي التعليمية'
 const [{data:classes},{data:students},{data:attendance},{data:tasks},{data:subs},{data:messages}]=await Promise.all([
  supabase.from('classes').select('id,name').eq('tenant_id',m.tenant_id).order('name'),
  supabase.from('students').select('id,class_id').eq('tenant_id',m.tenant_id),
  supabase.from('attendance_records').select('student_id,class_id,status,attendance_date').eq('tenant_id',m.tenant_id),
  supabase.from('tasks').select('id,class_id').eq('tenant_id',m.tenant_id),
  supabase.from('task_submissions').select('task_id,student_id,status').eq('tenant_id',m.tenant_id),
  supabase.from('outbound_messages').select('status,created_at').eq('tenant_id',m.tenant_id).order('created_at',{ascending:false}).limit(1000)
 ])
 const totalStudents=students?.length||0; const absences=(attendance||[]).filter((a:any)=>a.status==='absent').length; const submitted=(subs||[]).filter((s:any)=>s.status==='submitted').length; const missing=(subs||[]).filter((s:any)=>s.status==='missing').length; const sent=(messages||[]).filter((x:any)=>x.status==='sent').length
 const rows=(classes||[]).map(c=>{const sids=new Set((students||[]).filter((s:any)=>s.class_id===c.id).map((s:any)=>s.id)); const tids=new Set((tasks||[]).filter((t:any)=>t.class_id===c.id).map((t:any)=>t.id)); const att=(attendance||[]).filter((a:any)=>a.class_id===c.id); const ss=(subs||[]).filter((x:any)=>tids.has(x.task_id)&&sids.has(x.student_id)); return {id:c.id,name:c.name,students:sids.size,absent:att.filter((a:any)=>a.status==='absent').length,late:att.filter((a:any)=>a.status==='late').length,submitted:ss.filter((x:any)=>x.status==='submitted').length,missing:ss.filter((x:any)=>x.status==='missing').length} })
 return <DashboardShell active="/reports" tenant={tenant}><div className="bankContent"><div className="pageTitle"><span className="badge">تقارير فورية</span><h1>التقارير والإحصائيات</h1><p className="muted">الأرقام محسوبة من البيانات التي يحق لحسابك الوصول إليها فقط.</p></div>
  <div className="grid4"><div className="card metric"><small>الطلاب</small><strong>{totalStudents}</strong></div><div className="card metric"><small>إجمالي الغياب</small><strong>{absences}</strong></div><div className="card metric"><small>المهام المسلمة</small><strong>{submitted}</strong></div><div className="card metric"><small>الرسائل المرسلة</small><strong>{sent}</strong></div></div>
  <section className="card tableCard" style={{marginTop:18}}><div className="ownerSectionHead"><div><h2>ملخص الفصول</h2><p>حضور ومهام لكل فصل ضمن صلاحية المستخدم.</p></div><a className="btn btn-light" href="/api/reports/class-summary">تنزيل CSV</a></div><div className="tableWrap"><table><thead><tr><th>الفصل</th><th>الطلاب</th><th>غياب</th><th>تأخر</th><th>مسلمة</th><th>غير مسلمة</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.students}</td><td>{r.absent}</td><td>{r.late}</td><td>{r.submitted}</td><td>{r.missing}</td></tr>)}</tbody></table></div></section>
  <div className="summaryRow" style={{marginTop:18}}><div className="summaryBox"><small className="muted">إجمالي حالات المهام</small><strong>{submitted+missing}</strong></div><div className="summaryBox"><small className="muted">غير مسلمة</small><strong>{missing}</strong></div><div className="summaryBox"><small className="muted">نجاح إرسال الرسائل</small><strong>{sent}</strong></div></div>
 </div></DashboardShell>
}
