import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { addOperation } from './actions'
export default async function Operations(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,tenants(name)').eq('user_id',user.id).maybeSingle();if(!m)redirect('/dashboard')
 const [{data:students},{data:metrics},{data:ops}]=await Promise.all([
  supabase.from('students').select('id,full_name,classes(name)').eq('tenant_id',m.tenant_id).order('full_name'),
  supabase.from('student_metrics').select('student_id,balance').eq('tenant_id',m.tenant_id),
  supabase.from('student_operations').select('id,student_id,operation_type,amount,reason,created_at,students(full_name)').eq('tenant_id',m.tenant_id).order('created_at',{ascending:false}).limit(50)
 ])
 const balances=new Map((metrics||[]).map((x:any)=>[x.student_id,Number(x.balance||0)]));const total=[...balances.values()].reduce((a,b)=>a+b,0)
 return <DashboardShell active="/operations" tenant={(m.tenants as any)?.name||'مساحتي'}><div className="bankContent">
  <div className="pageTitle"><span className="badge">🧮 قسم بنك التعليم</span><h1>العمليات</h1><p className="muted">إيداع وحسم تعليمي بسجل واضح لكل طالب، دون أي علاقة بحسابات بنكية حقيقية.</p></div>
  <div className="summaryRow"><div className="summaryBox"><small className="muted">عدد الطلاب</small><strong>{students?.length||0}</strong></div><div className="summaryBox"><small className="muted">إجمالي الأرصدة التعليمية</small><strong>{total.toFixed(0)}</strong></div><div className="summaryBox"><small className="muted">آخر العمليات</small><strong>{ops?.length||0}</strong></div></div>
  <div className="twoCol" style={{marginTop:18}}><section className="card composer"><h2>عملية جديدة</h2><form action={addOperation}><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختاري الطالب</option>{students?.map((s:any)=><option value={s.id} key={s.id}>{s.full_name} — {s.classes?.name||'بدون فصل'}</option>)}</select></label><label className="field"><span>نوع العملية</span><select name="operation_type" defaultValue="credit"><option value="credit">إيداع تعليمي</option><option value="debit">حسم من الرصيد</option></select></label><label className="field"><span>القيمة</span><input name="amount" type="number" min="0.01" step="0.01" required/></label><label className="field"><span>السبب</span><input name="reason" maxLength={300} required/></label><button className="btn btn-primary">تنفيذ العملية</button></form></section>
  <section className="card tableCard"><h2>أرصدة الطلاب</h2><div className="tableWrap"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>الرصيد التعليمي</th></tr></thead><tbody>{students?.map((s:any)=><tr key={s.id}><td>{s.full_name}</td><td>{s.classes?.name||'—'}</td><td><b>{(balances.get(s.id)||0).toFixed(2)}</b></td></tr>)}</tbody></table></div></section></div>
  <section className="card tableCard" style={{marginTop:18}}><h2>سجل العمليات</h2><div className="tableWrap"><table><thead><tr><th>الطالب</th><th>النوع</th><th>القيمة</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody>{ops?.map((o:any)=><tr key={o.id}><td>{o.students?.full_name}</td><td>{o.operation_type==='credit'?'إيداع':'حسم'}</td><td>{Number(o.amount).toFixed(2)}</td><td>{o.reason}</td><td>{new Date(o.created_at).toLocaleDateString('ar-SA')}</td></tr>)}</tbody></table></div></section>
 </div></DashboardShell>
}
