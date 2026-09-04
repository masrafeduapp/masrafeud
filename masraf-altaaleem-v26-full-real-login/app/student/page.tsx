import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStudentSessionAccountId } from '@/lib/student-auth'
import { markStudentMessageRead, spinStudentRoulette, studentLogout, transferEducationalBalance } from './actions'
import StudentPrintButton from '@/components/StudentPrintButton'

function level(points:number){
 if(points>=300)return {name:'ماسي',next:null,from:300,to:300}
 if(points>=150)return {name:'بلاتيني',next:'ماسي',from:150,to:300}
 if(points>=75)return {name:'ذهبي',next:'بلاتيني',from:75,to:150}
 if(points>=30)return {name:'فضي',next:'ذهبي',from:30,to:75}
 return {name:'برونزي',next:'فضي',from:0,to:30}
}
const ar=(n:number)=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(n)
const date=(v:string)=>new Date(v).toLocaleDateString('ar-SA')

export default async function StudentPortal({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const q=await searchParams
 const aid=await getStudentSessionAccountId();if(!aid)redirect('/student/login')
 const admin=createAdminClient()
 const {data:account}=await admin.from('student_portal_accounts').select('id,tenant_id,student_id,username,active').eq('id',aid).maybeSingle()
 if(!account?.active)redirect('/student/login')
 const [{data:subscription},{data:student},{data:tenant},{data:settings},{data:metric}]=await Promise.all([
  admin.from('subscriptions').select('status').eq('tenant_id',account.tenant_id).maybeSingle(),
  admin.from('students').select('id,full_name,class_id,student_ref,classes(name)').eq('id',account.student_id).eq('tenant_id',account.tenant_id).maybeSingle(),
  admin.from('tenants').select('name').eq('id',account.tenant_id).maybeSingle(),
  admin.from('student_portal_settings').select('*').eq('tenant_id',account.tenant_id).maybeSingle(),
  admin.from('student_metrics').select('balance,points,roulette_chances').eq('student_id',account.student_id).maybeSingle()
 ])
 if(!student)redirect('/student/login')
 if(subscription && ['suspended','expired','canceled'].includes(subscription.status)) return <main className="studentBlocked"><div><span>مصرف التعليم</span><h1>الحساب التعليمي غير متاح حاليًا</h1><p>اشتراك الجهة التعليمية متوقف. تواصل مع المعلم أو إدارة المدرسة.</p><form action={studentLogout}><button>تسجيل خروج</button></form></div></main>
 const points=Number(metric?.points||0),balance=Number(metric?.balance||0),chances=Number(metric?.roulette_chances||0),lv=level(points)
 const progress=lv.next?Math.max(0,Math.min(100,((points-lv.from)/(lv.to-lv.from))*100)):100
 const classId=student.class_id
 const [opsR,ptsR,attendanceR,tasksR,subsR,evalR,rewardsR,spinsR,allStudentsR,allMetricsR,messagesR,awardsR]=await Promise.all([
  admin.from('student_operations').select('id,operation_type,amount,reason,created_at').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('created_at',{ascending:false}).limit(20),
  admin.from('point_transactions').select('id,delta,reason,created_at').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('created_at',{ascending:false}).limit(20),
  admin.from('attendance_records').select('id,status,note,attendance_date').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('attendance_date',{ascending:false}).limit(40),
  classId?admin.from('tasks').select('id,title,due_date,created_at').eq('tenant_id',account.tenant_id).eq('class_id',classId).order('created_at',{ascending:false}).limit(20):Promise.resolve({data:[] as any[]}),
  admin.from('task_submissions').select('task_id,status,note,updated_at').eq('tenant_id',account.tenant_id).eq('student_id',student.id),
  admin.from('student_evaluations').select('id,category,score,note,evaluation_date').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('evaluation_date',{ascending:false}).limit(20),
  admin.from('rewards').select('id,name,points_cost,reward_balance,reward_points,active').eq('tenant_id',account.tenant_id).eq('active',true).order('created_at'),
  admin.from('reward_spin_history').select('id,reward_name,balance_awarded,points_awarded,created_at').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('created_at',{ascending:false}).limit(10),
  admin.from('students').select('id,full_name,class_id,classes(name)').eq('tenant_id',account.tenant_id),
  admin.from('student_metrics').select('student_id,points,balance').eq('tenant_id',account.tenant_id),
  admin.from('student_portal_messages').select('id,title,body,message_type,created_at,read_at').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('created_at',{ascending:false}).limit(50),
  admin.from('student_achievement_awards').select('id,note,awarded_at,achievement_badges(name,description,icon,points_bonus)').eq('tenant_id',account.tenant_id).eq('student_id',student.id).order('awarded_at',{ascending:false}).limit(50)
 ])
 const ops=opsR.data||[], pointTx=ptsR.data||[], attendance=attendanceR.data||[], tasks=tasksR.data||[], submissions=subsR.data||[], evaluations=evalR.data||[], rewards=rewardsR.data||[], spins=spinsR.data||[], portalMessages=messagesR.data||[], badgeAwards=awardsR.data||[]
 const subMap=new Map(submissions.map((s:any)=>[s.task_id,s]))
 const taskRows=tasks.map((t:any)=>({...t,submission:subMap.get(t.id)}))
 const missing=taskRows.filter((t:any)=>!t.submission||t.submission.status==='missing').length
 const absences=attendance.filter((x:any)=>x.status==='absent').length
 const late=attendance.filter((x:any)=>x.status==='late').length
 const latestNote=attendance.find((x:any)=>x.note)?.note||evaluations.find((x:any)=>x.note)?.note||'لا توجد ملاحظات مسجلة.'
 const deposits=ops.filter((o:any)=>o.operation_type==='credit').reduce((n:number,o:any)=>n+Number(o.amount||0),0)
 const withdrawals=ops.filter((o:any)=>o.operation_type==='debit').reduce((n:number,o:any)=>n+Number(o.amount||0),0)
 const avgEval=evaluations.length?evaluations.reduce((n:number,e:any)=>n+Number(e.score||0),0)/evaluations.length:null
 const mm=new Map((allMetricsR.data||[]).map((x:any)=>[x.student_id,x]))
 const ranked=(allStudentsR.data||[]).map((s:any)=>({...s,points:Number((mm.get(s.id) as any)?.points||0)})).sort((a:any,b:any)=>b.points-a.points||a.full_name.localeCompare(b.full_name,'ar'))
 const schoolTop=ranked.slice(0,3),classTop=ranked.filter((s:any)=>s.class_id===classId).slice(0,5),rank=ranked.findIndex((s:any)=>s.id===student.id)+1
 const achievements=[points>=30&&'وصلت إلى المستوى الفضي',points>=75&&'وصلت إلى المستوى الذهبي',points>=150&&'وصلت إلى المستوى البلاتيني',absences===0&&attendance.length>0&&'حضور بلا غياب في السجل الحالي',taskRows.length>0&&missing===0&&'جميع المهام الحالية مكتملة'].filter(Boolean) as string[]
 const unreadMessages=portalMessages.filter((m:any)=>!m.read_at).length
 const school=settings?.school_label||tenant?.name||'الجهة التعليمية';const subject=settings?.subject_label||'التعليم'
 const cardNumber=(student.student_ref||student.id.replaceAll('-','').slice(0,16)).padEnd(16,'0').slice(0,16).match(/.{1,4}/g)?.join('  ')||'0000  0000  0000  0000'
 return <main className="studentPortal">
  <header className="studentTop"><div><span className="studentLogo">م</span><div><b>لوحة الطالب/ة</b><small>مصرف التعليم • {school}</small></div></div><form action={studentLogout}><button>تسجيل خروج</button></form></header>
  <div className="studentPortalBody">
   {q.transfer==='success'&&<div className="studentNotice ok">تم التحويل بنجاح وسُجلت العملية في كشف الحساب.</div>}{q.transfer==='insufficient'&&<div className="studentNotice err">الرصيد غير كافٍ لإتمام التحويل.</div>}{(q.transfer==='invalid'||q.transfer==='failed')&&<div className="studentNotice err">تعذر تنفيذ التحويل. تحقّق من بيانات المستفيد والمبلغ.</div>}{q.spin==='success'&&<div className="studentNotice ok">تم تشغيل الروليت وتسجيل الجائزة في حسابك.</div>}{q.spin==='none'&&<div className="studentNotice err">لا توجد فرصة روليت أو جائزة مفعلة حاليًا.</div>}{q.spin==='failed'&&<div className="studentNotice err">تعذر تشغيل الروليت الآن. حاول مرة أخرى.</div>}
   <section className="studentVipCard"><div className="studentVipHead"><div><span>EDUCATION BANK • STUDENT</span><b>★ المستوى الحالي: {lv.name}</b></div><i/></div><h1>{student.full_name}</h1><div className="studentCardNo" dir="ltr">{cardNumber}</div><div className="studentVipMeta">{settings?.show_balance!==false&&<div><small>الرصيد التعليمي</small><b>{ar(balance)}</b></div>}{settings?.show_points!==false&&<div><small>النقاط</small><b>{ar(points)}</b></div>}<div><small>المستوى الحالي</small><b>{lv.name}</b></div><div><small>المادة / الصف</small><b>{subject} • {(student.classes as any)?.name||'—'}</b></div></div></section>

   <section className="studentStats">{settings?.show_balance!==false&&<article><span>الرصيد</span><b>{ar(balance)}</b><small>رصيد تعليمي غير نقدي</small></article>}{settings?.show_points!==false&&<article><span>النقاط</span><b>{ar(points)}</b><small>نقاط التحفيز</small></article>}<article><span>المستوى</span><b>{lv.name}</b><small>{rank?`ترتيبك العام #${ar(rank)}`:'استمر في التقدم'}</small></article><article><span>المهام غير المسلمة</span><b>{ar(missing)}</b><small>{missing?'تحتاج متابعة':'ممتاز، لا توجد مهام ناقصة'}</small></article></section>

   <section className="studentTwoCols">
    <article className="studentPanel"><h2>التقدم نحو المستوى التالي</h2><div className="studentProgress"><span style={{width:`${progress}%`}}/></div><p>{lv.next?`باقي ${ar(Math.max(0,lv.to-points))} نقطة للوصول إلى ${lv.next}.`:'وصلت إلى أعلى مستوى حاليًا.'}</p><div className="studentMini"><div><span>الغياب</span><b>{ar(absences)}</b></div><div><span>التأخر</span><b>{ar(late)}</b></div><div><span>متوسط التقييم</span><b>{avgEval===null?'—':`${ar(avgEval)}%`}</b></div></div></article>
    <article className="studentPanel"><h2>آخر العمليات</h2><div className="studentLedger">{ops.slice(0,4).length?ops.slice(0,4).map((o:any)=><div key={o.id}><span><b>{o.reason}</b><small>{date(o.created_at)}</small></span><strong className={o.operation_type==='credit'?'plus':'minus'}>{o.operation_type==='credit'?'+':'−'}{ar(Number(o.amount))}</strong></div>):<p className="studentEmpty">لا توجد عمليات مالية تعليمية بعد.</p>}</div></article>
   </section>

   <section className="studentPanel studentTransfer"><div className="studentSectionHead"><div><span className="studentKicker">عملية مصرفية تعليمية</span><h2>تحويل رصيد تعليمي</h2><p>الطالب يستطيع تحويل جزء من رصيده إلى طالب آخر داخل نفس الجهة فقط. الإيداع والحسم يبقيان من صلاحيات المعلم.</p></div><span className="studentPill">لا قيمة نقدية</span></div><form action={transferEducationalBalance} className="studentTransferForm"><label><span>اسم مستخدم المستفيد</span><input name="recipient_username" required minLength={4} dir="ltr" placeholder="student.102"/></label><label><span>المبلغ</span><input name="amount" type="number" min="1" max={balance} step="1" required/></label><label className="wide"><span>السبب</span><input name="reason" required minLength={2} maxLength={300} placeholder="مثال: هدية تحفيزية"/></label><button disabled={balance<=0}>تنفيذ التحويل</button></form></section>

   <section className="studentDashboardGrid"><div>
    <article className="studentPanel"><div className="studentSectionHead"><div><h2>المهام والمتابعة</h2><p>حالة المهام المسجلة لفصلك.</p></div><span className="studentPill">{ar(missing)} غير مسلمة</span></div><div className="studentTasks">{taskRows.length?taskRows.slice(0,8).map((t:any)=>{const st=t.submission?.status||'missing';return <div key={t.id}><span><b>{t.title}</b><small>{t.due_date?`الاستحقاق ${new Date(t.due_date+'T00:00:00').toLocaleDateString('ar-SA')}`:'بدون تاريخ استحقاق'}</small></span><strong className={st}>{st==='submitted'?'تم التسليم':st==='excused'?'معذور':'غير مسلم'}</strong></div>}):<p className="studentEmpty">لا توجد مهام مسجلة حاليًا.</p>}</div></article>
    {settings?.show_rewards!==false&&<article className="studentReward"><div><span>✦</span><h2>الجوائز والتحفيز</h2><p>{chances>0?`لديك ${ar(chances)} فرصة في الروليت.`:'لا توجد فرص روليت متاحة حاليًا.'}</p><form action={spinStudentRoulette}><button disabled={chances<=0||!rewards.length}>تشغيل الروليت</button></form>{spins[0]&&<small>آخر جائزة: {spins[0].reward_name} • {date(spins[0].created_at)}</small>}{rewards.length>0&&<div className="studentRewardList">{rewards.slice(0,6).map((r:any)=><span key={r.id}><b>{r.name}</b><small>استبدال {r.points_cost} نقطة • روليت +{r.reward_points||0} نقطة / +{ar(Number(r.reward_balance||0))} رصيد</small></span>)}</div>}</div></article>}
   </div><div>
    <article className="studentPanel"><div className="studentSectionHead"><div><h2>الغياب والملاحظات</h2><p>ملخص حضورك وآخر ملاحظة.</p></div><span className="studentPill">غياب {ar(absences)}</span></div><div className="studentAttendanceBar"><span style={{width:`${Math.min(100,absences*12)}%`}}/></div><div className="studentNote"><span>آخر ملاحظة</span><b>{latestNote}</b></div>{attendance.slice(0,5).map((a:any)=><div className="attendanceLine" key={a.id}><span>{new Date(a.attendance_date+'T00:00:00').toLocaleDateString('ar-SA')}</span><b>{a.status==='present'?'حاضر':a.status==='absent'?'غائب':a.status==='late'?'متأخر':'بعذر'}</b></div>)}</article>
    <article className="studentPanel"><h2>الوصول السريع</h2><div className="studentQuick">{settings?.show_balance!==false&&<a href="#statement"><span>💳</span><b>كشف الحساب</b><small>الرصيد والعمليات</small></a>}{settings?.show_points!==false&&<a href="#points"><span>⭐</span><b>النقاط</b><small>سجل نقاطك</small></a>}{settings?.show_achievements!==false&&<a href="#achievements"><span>🏅</span><b>الإنجازات</b><small>إنجازات حقيقية</small></a>}{settings?.show_messages!==false&&<a href="#student-messages"><span>💬</span><b>الرسائل</b><small>{unreadMessages?`${ar(unreadMessages)} غير مقروءة`:'لا رسائل جديدة'}</small></a>}<a href="#evaluations"><span>📈</span><b>التقييمات</b><small>متابعة تقييمك</small></a>{settings?.show_honor_board!==false&&<a href="#honor"><span>🏆</span><b>لوحة الشرف</b><small>أفضل المدرسة والفصل</small></a>}<StudentPrintButton/><a href="/api/student/report"><span>⬇️</span><b>تنزيل التقرير</b><small>CSV من بياناتك</small></a><a href="#profile"><span>⚙️</span><b>بياناتي</b><small>الحساب والصف</small></a></div></article>
   </div></section>

   {settings?.show_balance!==false&&<section id="statement" className="studentPanel studentSection"><div className="studentSectionHead"><div><span className="studentKicker">كشف الحساب</span><h2>الرصيد والعمليات</h2></div><div className="statementTotals"><span>إيداعات <b>+{ar(deposits)}</b></span><span>سحوبات <b>−{ar(withdrawals)}</b></span></div></div><div className="studentTable"><table><thead><tr><th>التاريخ</th><th>العملية</th><th>السبب</th><th>المبلغ</th></tr></thead><tbody>{ops.length?ops.map((o:any)=><tr key={o.id}><td>{date(o.created_at)}</td><td>{o.operation_type==='credit'?'إيداع':'سحب/تحويل'}</td><td>{o.reason}</td><td className={o.operation_type==='credit'?'plus':'minus'}>{o.operation_type==='credit'?'+':'−'}{ar(Number(o.amount))}</td></tr>):<tr><td colSpan={4}>لا توجد عمليات بعد.</td></tr>}</tbody></table></div></section>}

   {settings?.show_points!==false&&<section id="points" className="studentPanel studentSection"><div className="studentSectionHead"><div><span className="studentKicker">النقاط</span><h2>سجل نقاط التحفيز</h2></div><span className="studentPill">الرصيد {ar(points)} نقطة</span></div><div className="studentLedger">{pointTx.length?pointTx.map((p:any)=><div key={p.id}><span><b>{p.reason}</b><small>{date(p.created_at)}</small></span><strong className={p.delta>0?'plus':'minus'}>{p.delta>0?'+':''}{ar(Number(p.delta))}</strong></div>):<p className="studentEmpty">لا توجد حركات نقاط بعد.</p>}</div></section>}

   {settings?.show_achievements!==false&&<section id="achievements" className="studentPanel studentSection"><div className="studentSectionHead"><div><span className="studentKicker">الإنجازات</span><h2>شاراتك وإنجازاتك</h2></div><span className="studentPill">{ar(badgeAwards.length)} شارة</span></div><div className="achievementGrid">{badgeAwards.map((a:any)=><article key={a.id}><span>{a.achievement_badges?.icon||'🏅'}</span><b>{a.achievement_badges?.name||'شارة إنجاز'}</b><small>{a.achievement_badges?.description||a.note||`مُنحت في ${date(a.awarded_at)}`}{a.achievement_badges?.points_bonus?` • +${ar(a.achievement_badges.points_bonus)} نقطة`:''}</small></article>)}{achievements.map((a,i)=><article key={`auto-${i}`}><span>★</span><b>{a}</b><small>إنجاز تلقائي مستند إلى بيانات حسابك الحالية</small></article>)}{!badgeAwards.length&&!achievements.length&&<p className="studentEmpty">أكمل المهام واجمع النقاط لتظهر إنجازاتك هنا.</p>}</div></section>}

   {settings?.show_messages!==false&&<section id="student-messages" className="studentPanel studentSection"><div className="studentSectionHead"><div><span className="studentKicker">رسائل المعلم</span><h2>الرسائل والتنبيهات</h2></div>{unreadMessages>0&&<span className="studentPill">{ar(unreadMessages)} جديدة</span>}</div><div className="studentMessageList">{portalMessages.length?portalMessages.map((m:any)=><article key={m.id} className={`studentMessage ${m.read_at?'read':'unread'} ${m.message_type}`}><div><span>{m.message_type==='success'?'إشادة':m.message_type==='warning'?'مهم':m.message_type==='task'?'متابعة مهمة':'تنبيه'}</span><small>{date(m.created_at)}</small></div><h3>{m.title}</h3><p>{m.body}</p>{!m.read_at&&<form action={markStudentMessageRead}><input type="hidden" name="message_id" value={m.id}/><button>تحديد كمقروءة</button></form>}</article>):<p className="studentEmpty">لا توجد رسائل في حسابك حتى الآن.</p>}</div></section>}

   {settings?.show_evaluations!==false&&<section id="evaluations" className="studentPanel studentSection"><div className="studentSectionHead"><div><span className="studentKicker">التقييم والإشراف</span><h2>تقييماتي</h2></div>{avgEval!==null&&<span className="studentPill">المتوسط {ar(avgEval)}%</span>}</div><div className="evaluationGrid">{evaluations.length?evaluations.map((e:any)=><article key={e.id}><span>{date(e.evaluation_date)}</span><h3>{e.category}</h3><b>{ar(Number(e.score))}%</b><p>{e.note||'بدون ملاحظة'}</p></article>):<p className="studentEmpty">لا توجد تقييمات مسجلة بعد.</p>}</div></section>}

   {settings?.show_honor_board!==false&&<section id="honor" className="studentPanel studentSection honorStudent"><div className="studentSectionHead"><div><span className="studentKicker">لوحة الشرف</span><h2>المتميزون</h2><p>ترتيب حقيقي حسب نقاط الطلاب داخل نفس الجهة.</p></div><span className="studentPill">ترتيبك #{rank||'—'}</span></div><h3>أفضل 3 على مستوى الجهة</h3><div className="honorStudentGrid">{schoolTop.map((s:any,i:number)=><article key={s.id} className={s.id===student.id?'me':''}><span>#{i+1}</span><i>{s.full_name.slice(0,1)}</i><b>{s.full_name}</b><small>{ar(s.points)} نقطة</small></article>)}</div><h3>أفضل 5 في الفصل</h3><div className="honorStudentGrid five">{classTop.map((s:any,i:number)=><article key={s.id} className={s.id===student.id?'me':''}><span>#{i+1}</span><i>{s.full_name.slice(0,1)}</i><b>{s.full_name}</b><small>{ar(s.points)} نقطة</small></article>)}</div></section>}

   <section id="profile" className="studentPanel studentSection"><div className="studentSectionHead"><div><span className="studentKicker">إعدادات الطالب/ة</span><h2>بيانات حسابي</h2></div></div><div className="studentProfileGrid"><div><span>الاسم</span><b>{student.full_name}</b></div><div><span>الفصل</span><b>{(student.classes as any)?.name||'—'}</b></div><div><span>اسم المستخدم</span><b dir="ltr">{account.username}</b></div><div><span>الجهة</span><b>{school}</b></div><div><span>المادة</span><b>{subject}</b></div><div><span>نوع الرصيد</span><b>تعليمي غير نقدي</b></div></div></section>
  </div>
 </main>
}
