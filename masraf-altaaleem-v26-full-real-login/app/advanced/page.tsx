import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'

function formatNumber(value:number){
  return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(value)
}

function initials(name:string){
  return name.trim().slice(0,1) || 'ف'
}

export default async function Advanced(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/auth/login')

  const {data:m}=await supabase
    .from('memberships')
    .select('tenant_id,role,tenants(name)')
    .eq('user_id',user.id)
    .maybeSingle()
  if(!m) redirect('/dashboard')

  const tenant=(m.tenants as any)?.name||'مساحتي التعليمية'
  const [{data:classes},{data:students},{data:metrics}]=await Promise.all([
    supabase.from('classes').select('id,name,created_at').eq('tenant_id',m.tenant_id).order('name'),
    supabase.from('students').select('id,class_id,full_name').eq('tenant_id',m.tenant_id),
    supabase.from('student_metrics').select('student_id,balance,points').eq('tenant_id',m.tenant_id),
  ])

  const safeClasses=classes||[]
  const safeStudents=students||[]
  const safeMetrics=metrics||[]
  const metricByStudent=new Map(safeMetrics.map(row=>[row.student_id,row]))

  const cards=safeClasses.map(cls=>{
    const classStudents=safeStudents.filter(student=>student.class_id===cls.id)
    const balance=classStudents.reduce((sum,student)=>sum+Number(metricByStudent.get(student.id)?.balance||0),0)
    const points=classStudents.reduce((sum,student)=>sum+Number(metricByStudent.get(student.id)?.points||0),0)
    return {...cls,studentCount:classStudents.length,balance,points}
  })

  const totalBalance=safeStudents.reduce((sum,student)=>sum+Number(metricByStudent.get(student.id)?.balance||0),0)
  const totalPoints=safeStudents.reduce((sum,student)=>sum+Number(metricByStudent.get(student.id)?.points||0),0)
  const userName=(user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||'المعلمة') as string

  return <DashboardShell active="/advanced" tenant={tenant}>
    <div className="advancedPage" dir="rtl">
      <div className="advancedTopRow">
        <div>
          <span className="advancedKicker">الرئيسية / لوحة التحكم المتقدمة</span>
          <h1>لوحة التحكم المتقدمة</h1>
          <p>إدارة الفصول ومؤشرات الأداء العامة</p>
        </div>
        <div className="advancedActions">
          <Link className="advancedSelect" href="/classes">كل الفصول⌄</Link>
          <Link className="advancedRefresh" href="/advanced">↻ تحديث البيانات</Link>
        </div>
      </div>

      <section className="classesHero">
        <div className="classesHeroCopy">
          <span>مصرف التعليم</span>
          <h2>بطاقات الفصول</h2>
          <p>نظرة سريعة على كل فصل: الطلاب، الأرصدة، النقاط وحالة الفصل.</p>
        </div>
        <div className="classesHeroMark">∑</div>
      </section>

      <section className="advancedStats">
        <article>
          <div className="advancedStatIcon">🏫</div>
          <div><span>عدد الفصول</span><strong>{formatNumber(safeClasses.length)}</strong><small>فصول مسجلة</small></div>
        </article>
        <article>
          <div className="advancedStatIcon">👥</div>
          <div><span>إجمالي الطلاب</span><strong>{formatNumber(safeStudents.length)}</strong><small>طلاب وطالبات</small></div>
        </article>
        <article>
          <div className="advancedStatIcon">◉</div>
          <div><span>إجمالي الأرصدة</span><strong>{formatNumber(totalBalance)}</strong><small>رصيد تعليمي</small></div>
        </article>
        <article>
          <div className="advancedStatIcon gold">✦</div>
          <div><span>إجمالي النقاط</span><strong>{formatNumber(totalPoints)}</strong><small>نقاط مكتسبة</small></div>
        </article>
      </section>

      <section className="registeredClasses">
        <div className="registeredHead">
          <div><h2>الفصول المسجلة</h2><p>كل بطاقة تعرض أهم مؤشرات الفصل مع الوصول السريع.</p></div>
          <Link href="/classes" className="manageClassesBtn">إدارة الفصول</Link>
        </div>

        {!cards.length ? <div className="advancedEmpty">
          <div>🏫</div><h3>لا توجد فصول حتى الآن</h3><p>ابدئي بإضافة فصل من صفحة إدارة الفصول، وسيظهر هنا مباشرة.</p>
          <Link href="/classes" className="advancedPrimary">إضافة فصل</Link>
        </div> : <div className="classCardsGrid">
          {cards.map(cls=><article className="advancedClassCard" key={cls.id}>
            <div className="classCardTop">
              <div className="classIdentity"><span className="classAvatar">{initials(cls.name)}</span><div><h3>{cls.name}</h3><p>{tenant} • {userName}</p></div></div>
              <span className="classState">مسجل</span>
            </div>
            <div className="classFacts">
              <div><span>الطلاب</span><b>{formatNumber(cls.studentCount)}</b></div>
              <div><span>الرصيد</span><b>{formatNumber(cls.balance)}</b></div>
              <div><span>النقاط</span><b>{formatNumber(cls.points)}</b></div>
            </div>
            <div className="classCardActions">
              <Link className="classOpen" href={`/classes/${encodeURIComponent(cls.id)}`}>الدخول للفصل</Link>
              <Link className="classEdit" href="/classes">إدارة الفصل</Link>
            </div>
          </article>)}
        </div>}
      </section>
    </div>
  </DashboardShell>
}
