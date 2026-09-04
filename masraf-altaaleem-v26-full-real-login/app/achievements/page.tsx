import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { awardBadge, createBadge } from './actions'

export default async function Achievements(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,tenants(name)').eq('user_id',user.id).maybeSingle();if(!m)redirect('/dashboard')
 const [{data:students},{data:badges},{data:awards}]=await Promise.all([
  supabase.from('students').select('id,full_name,classes(name)').eq('tenant_id',m.tenant_id).order('full_name'),
  supabase.from('achievement_badges').select('*').eq('tenant_id',m.tenant_id).order('created_at',{ascending:false}),
  supabase.from('student_achievement_awards').select('id,student_id,badge_id,note,awarded_at,students(full_name),achievement_badges(name,icon,points_bonus)').eq('tenant_id',m.tenant_id).order('awarded_at',{ascending:false}).limit(100)
 ])
 const tenant=(m.tenants as any)?.name||'مساحتي التعليمية'
 return <DashboardShell active="/achievements" tenant={tenant}><div className="bankContent"><div className="pageTitle"><span className="badge">تحفيز حقيقي</span><h1>الإنجازات والشارات</h1><p className="muted">أنشئي شارات ثم امنحيها للطلاب. يمكن للشارة إضافة نقاط تلقائيًا مرة واحدة.</p></div>
 <div className="twoCol"><form action={createBadge} className="card composer"><h2>إنشاء شارة</h2><label className="field"><span>اسم الشارة</span><input name="name" required minLength={2} maxLength={100}/></label><label className="field"><span>الرمز</span><input name="icon" defaultValue="🏅" maxLength={20}/></label><label className="field"><span>وصف الشارة</span><textarea name="description" maxLength={400}/></label><label className="field"><span>نقاط المكافأة</span><input name="points_bonus" type="number" min="0" max="10000" defaultValue="0"/></label><button className="btn btn-primary">حفظ الشارة</button></form>
 <form action={awardBadge} className="card composer"><h2>منح شارة لطالب</h2><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختاري الطالب</option>{students?.map((s:any)=><option value={s.id} key={s.id}>{s.full_name} — {s.classes?.name||'—'}</option>)}</select></label><label className="field"><span>الشارة</span><select name="badge_id" required defaultValue=""><option value="" disabled>اختاري الشارة</option>{badges?.filter((b:any)=>b.active).map((b:any)=><option value={b.id} key={b.id}>{b.icon} {b.name}{b.points_bonus?` (+${b.points_bonus} نقطة)`:''}</option>)}</select></label><label className="field"><span>ملاحظة</span><textarea name="note" maxLength={400}/></label><button className="btn btn-primary">منح الشارة</button></form></div>
 <section className="card tableCard" style={{marginTop:18}}><h2>آخر الشارات الممنوحة</h2>{!awards?.length?<p className="muted">لا توجد شارات ممنوحة حتى الآن.</p>:<div className="tableWrap"><table><thead><tr><th>الطالب</th><th>الشارة</th><th>النقاط</th><th>الملاحظة</th><th>التاريخ</th></tr></thead><tbody>{awards.map((a:any)=><tr key={a.id}><td>{a.students?.full_name||'—'}</td><td>{a.achievement_badges?.icon} {a.achievement_badges?.name}</td><td>{a.achievement_badges?.points_bonus||0}</td><td>{a.note||'—'}</td><td>{new Date(a.awarded_at).toLocaleDateString('ar-SA')}</td></tr>)}</tbody></table></div>}</section>
 </div></DashboardShell>
}
