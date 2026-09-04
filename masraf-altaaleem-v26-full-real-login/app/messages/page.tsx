import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import MessageComposer from '@/components/MessageComposer'
import BulkMessageComposer from '@/components/BulkMessageComposer'
import { createClient } from '@/lib/supabase/server'
import { sendPortalMessage } from './actions'

export default async function Messages(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,tenants(name)').eq('user_id',user.id).maybeSingle();if(!m)redirect('/dashboard')
 const [{data:students},{data:classes},{data:messages},{data:portalMessages}]=await Promise.all([
  supabase.from('students').select('id,full_name,guardian_name,guardian_phone,guardian_consent').eq('tenant_id',m.tenant_id).order('full_name'),
  supabase.from('classes').select('id,name').eq('tenant_id',m.tenant_id).order('name'),
  supabase.from('outbound_messages').select('id,channel,recipient_phone_masked,body,status,created_at,students(full_name)').eq('tenant_id',m.tenant_id).order('created_at',{ascending:false}).limit(80),
  supabase.from('student_portal_messages').select('id,title,body,message_type,created_at,read_at,students(full_name)').eq('tenant_id',m.tenant_id).order('created_at',{ascending:false}).limit(80)
 ])
 const tenant=(m.tenants as any)?.name||'مساحتي التعليمية'
 return <DashboardShell active="/messages" tenant={tenant}><div className="bankContent"><div className="pageTitle"><span className="badge">مركز التواصل</span><h1>التواصل</h1><p className="muted">رسائل أولياء الأمور عبر واتساب/SMS، ورسائل داخلية تظهر مباشرة في حساب الطالب.</p></div>
 <div className="twoCol"><MessageComposer students={students||[]}/><BulkMessageComposer classes={classes||[]}/></div>
 <form action={sendPortalMessage} className="card composer" style={{marginTop:18}}><h2>رسالة داخل حساب الطالب</h2><div className="formGrid"><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختاري الطالب</option>{students?.map((s:any)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label className="field"><span>نوع الرسالة</span><select name="message_type" defaultValue="info"><option value="info">تنبيه</option><option value="success">إشادة</option><option value="warning">مهم</option><option value="task">متابعة مهمة</option></select></label><label className="field"><span>العنوان</span><input name="title" required minLength={2} maxLength={120}/></label></div><label className="field"><span>نص الرسالة</span><textarea name="body" required minLength={2} maxLength={1200}/></label><button className="btn btn-primary">إرسال إلى حساب الطالب</button></form>
 <section className="card tableCard" style={{marginTop:18}}><h2>رسائل حساب الطالب</h2>{!portalMessages?.length?<p className="muted">لا توجد رسائل داخلية حتى الآن.</p>:<div className="tableWrap"><table><thead><tr><th>الطالب</th><th>العنوان</th><th>النوع</th><th>الحالة</th><th>الرسالة</th><th>التاريخ</th></tr></thead><tbody>{portalMessages.map((x:any)=><tr key={x.id}><td>{x.students?.full_name||'—'}</td><td>{x.title}</td><td>{x.message_type==='success'?'إشادة':x.message_type==='warning'?'مهم':x.message_type==='task'?'مهمة':'تنبيه'}</td><td>{x.read_at?'مقروء':'غير مقروء'}</td><td className="messageCell">{x.body}</td><td>{new Date(x.created_at).toLocaleDateString('ar-SA')}</td></tr>)}</tbody></table></div>}</section>
 <section className="card tableCard" style={{marginTop:18}}><h2>سجل رسائل أولياء الأمور</h2>{!messages?.length?<p className="muted">لا توجد رسائل مرسلة حتى الآن.</p>:<div className="tableWrap"><table><thead><tr><th>الطالب</th><th>القناة</th><th>المستلم</th><th>الحالة</th><th>الرسالة</th></tr></thead><tbody>{messages.map((x:any)=><tr key={x.id}><td>{x.students?.full_name||'—'}</td><td>{x.channel==='whatsapp'?'واتساب':'SMS'}</td><td dir="ltr">{x.recipient_phone_masked}</td><td><span className={`status ${x.status}`}>{x.status==='sent'?'تم الإرسال':x.status==='failed'?'فشل':'قيد الإرسال'}</span></td><td className="messageCell">{x.body}</td></tr>)}</tbody></table></div>}</section>
 </div></DashboardShell>
}
