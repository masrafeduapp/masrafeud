import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteTeacher, revokeInvite, setTeacherClasses } from './actions'

function roleAr(role:string){ return role==='tenant_owner'?'مالك المساحة':role==='admin'?'مدير':'معلم' }
export default async function Teachers(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,role,tenants(name)').eq('user_id',user.id).maybeSingle(); if(!m)redirect('/dashboard')
 const tenant=(m.tenants as any)?.name||'مساحتي التعليمية'; const canManage=['tenant_owner','admin'].includes(m.role)
 const [{data:members},{data:classes},{data:assignments},{data:profiles},{data:invites}]=await Promise.all([
  supabase.from('memberships').select('id,user_id,role,created_at').eq('tenant_id',m.tenant_id).order('created_at'),
  supabase.from('classes').select('id,name').eq('tenant_id',m.tenant_id).order('name'),
  supabase.from('teacher_class_assignments').select('membership_id,class_id,classes(name)').eq('tenant_id',m.tenant_id),
  supabase.from('member_profiles').select('user_id,full_name'),
  canManage?supabase.from('teacher_invites').select('id,email,full_name,role,status,expires_at,created_at').eq('tenant_id',m.tenant_id).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}) as any
 ])
 const profileMap=new Map((profiles||[]).map((p:any)=>[p.user_id,p.full_name])); const emailMap=new Map<string,string>()
 if(canManage){ const admin=createAdminClient(); for(const member of members||[]){ const {data:u}=await admin.auth.admin.getUserById(member.user_id); if(u.user?.email) emailMap.set(member.user_id,u.user.email) } }
 return <DashboardShell active="/teachers" tenant={tenant}><div className="bankContent">
  <div className="pageTitle"><span className="badge">إدارة الفريق</span><h1>المعلمين والصلاحيات</h1><p className="muted">دعوة المعلمين وربط كل معلم بفصوله فقط. المعلم لا يرى فصولًا غير مرتبطة به.</p></div>
  {canManage&&<section className="card composer"><h2>دعوة معلم جديد</h2><form action={inviteTeacher} className="inlineForm"><label className="field"><span>اسم المعلم</span><input name="full_name" required minLength={2} maxLength={160}/></label><label className="field"><span>البريد الإلكتروني</span><input type="email" name="email" required dir="ltr"/></label><label className="field"><span>الصلاحية</span><select name="role" defaultValue="teacher"><option value="teacher">معلم</option><option value="admin">مدير</option></select></label><button className="btn btn-primary">إرسال الدعوة</button></form><p className="muted" style={{marginBottom:0}}>ترسل الدعوة عبر نظام المصادقة الحقيقي عند إعداد البريد في Supabase.</p></section>}
  <section className="card tableCard" style={{marginTop:18}}><h2>الأعضاء الحاليون</h2><div className="tableWrap"><table><thead><tr><th>المعلم</th><th>الدور</th><th>الفصول المرتبطة</th>{canManage&&<th>إدارة الفصول</th>}</tr></thead><tbody>{members?.map((x:any)=>{const selected=new Set((assignments||[]).filter((a:any)=>a.membership_id===x.id).map((a:any)=>a.class_id));return <tr key={x.id}><td><b>{profileMap.get(x.user_id)||'عضو مسجل'}</b>{canManage&&<small dir="ltr">{emailMap.get(x.user_id)||'—'}</small>}</td><td>{roleAr(x.role)}</td><td>{(assignments||[]).filter((a:any)=>a.membership_id===x.id).map((a:any)=>a.classes?.name).filter(Boolean).join('، ')|| (x.role!=='teacher'?'جميع الفصول':'—')}</td>{canManage&&<td>{x.role==='tenant_owner'?<span className="muted">جميع الفصول تلقائيًا</span>:<form action={setTeacherClasses}><input type="hidden" name="membership_id" value={x.id}/><div className="classChecks">{classes?.map(c=><label key={c.id} className="miniCheck"><input type="checkbox" name="class_id" value={c.id} defaultChecked={selected.has(c.id)}/><span>{c.name}</span></label>)}</div><button className="btn btn-light" style={{marginTop:8}}>حفظ الربط</button></form>}</td>}</tr>})}</tbody></table></div></section>
  {canManage&&<section className="card tableCard" style={{marginTop:18}}><h2>الدعوات المرسلة</h2>{!invites?.length?<p className="muted">لا توجد دعوات بعد.</p>:<div className="tableWrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>إدارة</th></tr></thead><tbody>{invites.map((i:any)=><tr key={i.id}><td>{i.full_name}</td><td dir="ltr">{i.email}</td><td>{roleAr(i.role)}</td><td><span className={`status ${i.status==='accepted'?'sent':i.status==='pending'?'queued':'failed'}`}>{i.status==='accepted'?'مقبولة':i.status==='pending'?'بانتظار القبول':i.status==='revoked'?'ملغاة':'منتهية'}</span></td><td>{i.status==='pending'?<form action={revokeInvite}><input type="hidden" name="invite_id" value={i.id}/><button className="btn btn-light">إلغاء الدعوة</button></form>:'—'}</td></tr>)}</tbody></table></div>}</section>}
 </div></DashboardShell>
}
