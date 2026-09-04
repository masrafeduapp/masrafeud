import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addStudent, saveStudentPortalAccount } from './actions'

export default async function Students(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,tenants(name)').eq('user_id',user.id).maybeSingle();if(!m)redirect('/dashboard')
 const [{data:students},{data:classes}]=await Promise.all([
  supabase.from('students').select('id,full_name,guardian_name,guardian_phone,guardian_consent,classes(name)').eq('tenant_id',m.tenant_id).order('full_name'),
  supabase.from('classes').select('id,name').eq('tenant_id',m.tenant_id).order('name')
 ])
 const ids=(students||[]).map((s:any)=>s.id)
 const admin=createAdminClient()
 const [{data:accounts},{data:metrics}]=ids.length?await Promise.all([
  admin.from('student_portal_accounts').select('student_id,username,active,last_login_at').eq('tenant_id',m.tenant_id).in('student_id',ids),
  admin.from('student_metrics').select('student_id,roulette_chances').eq('tenant_id',m.tenant_id).in('student_id',ids)
 ]):[{data:[]},{data:[]} ] as any
 const am=new Map((accounts||[]).map((a:any)=>[a.student_id,a]));const mm=new Map((metrics||[]).map((x:any)=>[x.student_id,x]))
 const tenant=(m.tenants as any)?.name||'مساحتي التعليمية'
 return <DashboardShell active="/students" tenant={tenant}><div className="bankContent">
  <div className="pageTitle"><span className="badge">بيانات خاصة</span><h1>الطلاب وأولياء الأمور</h1><p className="muted">الطلاب وحسابات دخولهم مرتبطة بمساحة المشترك الحالية وبالفصول المصرح للمعلم بها.</p></div>
  <div className="twoCol">
   <form className="card composer" action={addStudent}><h2>إضافة طالب</h2><label className="field"><span>اسم الطالب</span><input name="full_name" required minLength={2}/></label><label className="field"><span>الفصل</span><select name="class_id" required defaultValue=""><option value="" disabled>اختاري الفصل</option>{classes?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>اسم ولي الأمر</span><input name="guardian_name"/></label><label className="field"><span>جوال ولي الأمر</span><input name="guardian_phone" inputMode="tel" placeholder="05xxxxxxxx"/></label><label className="check"><input type="checkbox" name="guardian_consent"/><span>تم الحصول على موافقة ولي الأمر على التواصل عبر المنصة</span></label><button className="btn btn-primary">حفظ الطالب</button></form>
   <form className="card composer" action={saveStudentPortalAccount}><h2>حساب دخول الطالب</h2><p className="muted">إنشاء أو تغيير بيانات دخول الطالب للوحة الخاصة به.</p><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختاري الطالب</option>{students?.map((s:any)=><option key={s.id} value={s.id}>{s.full_name} — {s.classes?.name||'—'}</option>)}</select></label><label className="field"><span>اسم المستخدم</span><input name="username" required minLength={4} maxLength={40} pattern="[A-Za-z0-9._-]+" placeholder="student.101" dir="ltr"/></label><label className="field"><span>كلمة المرور</span><input name="password" type="password" required minLength={8} autoComplete="new-password"/></label><label className="field"><span>فرص الروليت</span><input name="roulette_chances" type="number" min="0" max="10000" defaultValue="0"/></label><button className="btn btn-primary">حفظ حساب الطالب</button><small className="muted">كلمة المرور لا تُحفظ كنص؛ تُحفظ كقيمة مشفرة مخصصة للتحقق.</small></form>
  </div>
  <section className="card tableCard" style={{marginTop:18}}><h2>قائمة الطلاب والحسابات</h2>{!students?.length?<p className="muted">لا يوجد طلاب حتى الآن.</p>:<div className="tableWrap"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>ولي الأمر</th><th>الجوال</th><th>التواصل</th><th>دخول الطالب</th><th>فرص الروليت</th></tr></thead><tbody>{students.map((s:any)=>{const a:any=am.get(s.id),metric:any=mm.get(s.id);return <tr key={s.id}><td>{s.full_name}</td><td>{s.classes?.name||'—'}</td><td>{s.guardian_name||'—'}</td><td dir="ltr">{s.guardian_phone||'—'}</td><td>{s.guardian_consent?'مسموح':'غير مفعّل'}</td><td>{a?<><b dir="ltr">{a.username}</b><br/><small>{a.active?'نشط':'موقوف'}{a.last_login_at?` • آخر دخول ${new Date(a.last_login_at).toLocaleDateString('ar-SA')}`:''}</small></>:'غير منشأ'}</td><td>{metric?.roulette_chances||0}</td></tr>})}</tbody></table></div>}</section>
 </div></DashboardShell>
}
