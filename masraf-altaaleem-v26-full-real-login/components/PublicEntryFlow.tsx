'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const roles = [
  {href:'/auth/teacher',title:'المعلمة',icon:'👩‍🏫',desc:'الفصول والطلاب والمتابعة والعمليات'},
  {href:'/auth/admin',title:'الإدارة',icon:'🏫',desc:'الإشراف والتقارير والصلاحيات'},
  {href:'/student/login',title:'طالب/طالبة',icon:'🎓',desc:'الرصيد والنقاط والمهام والإنجازات'},
  {href:'/auth/subscriber',title:'المشترك',icon:'💳',desc:'إدارة الحساب والاشتراك'}
]

export default function PublicEntryFlow(){
  const [progress,setProgress]=useState(0)
  const [ready,setReady]=useState(false)
  const [selected,setSelected]=useState(0)
  const seconds=useMemo(()=>Math.max(0,5-Math.floor(progress/20)),[progress])

  useEffect(()=>{
    const timer=window.setInterval(()=>setProgress(p=>{
      const next=Math.min(100,p+(p<70?4:p<92?2:1))
      if(next>=100){window.clearInterval(timer);window.setTimeout(()=>setReady(true),420)}
      return next
    }),70)
    return ()=>window.clearInterval(timer)
  },[])

  if(!ready) return <main className="bankSplash" dir="rtl">
    <div className="bankSplashGrid"/>
    <section className="bankSplashInner">
      <div className="bankSplashLogo">م</div>
      <span className="bankSplashKicker">EDUCATION BANK</span>
      <h1>مصرف <em>التعليم</em></h1>
      <p>يتم تجهيز بوابة الدخول الآمنة وتحميل صلاحيات الحساب.</p>
      <div className="bankProgress"><i style={{width:`${progress}%`}}/></div>
      <div className="bankProgressMeta"><span>جاري تهيئة النظام</span><b>{progress}%</b></div>
      <div className="bankSplashSafe"><i/> اتصال آمن ومشفّر</div>
      <button onClick={()=>setReady(true)} className="bankSkip">الدخول الآن {seconds>0?`· ${seconds} ث`:''}</button>
    </section>
  </main>

  const active=roles[selected]
  return <main className="bankEntry" dir="rtl">
    <div className="bankEntryGrid"/>
    <header className="bankEntryTop">
      <Link href="/" className="bankBrand"><span>م</span><div><b>مصرف التعليم</b><small>EDUCATION BANK</small></div></Link>
      <div className="bankSafe"><i/> اتصال آمن ومشفّر</div>
    </header>

    <section className="bankEntryMain">
      <div className="bankEntryIntro">
        <span className="bankEyebrow">✦ بوابة تعليمية مالية بطابع احترافي</span>
        <h1>كل أدواتك<br/><em>في مصرف واحد</em></h1>
        <p>إدارة الفصول، متابعة الطلاب، النقاط، المكافآت، التواصل والتقارير—كلها في منصة واحدة بهوية أنيقة وصلاحيات منفصلة.</p>
        <div className="bankTrust"><span>✓ بيانات خاصة لكل مشترك</span><span>✓ صلاحيات منفصلة</span><span>✓ دخول آمن</span></div>
      </div>

      <div className="bankLoginCard">
        <div className="bankCardHead"><div><small>مرحبًا بك</small><h2>تسجيل الدخول</h2><p>اختاري نوع الحساب للانتقال إلى نموذج الدخول الحقيقي.</p></div><span>● متصل</span></div>
        <div className="bankRoleGrid">
          {roles.map((r,i)=><button key={r.href} onClick={()=>setSelected(i)} className={selected===i?'active':''}><span>{r.icon}</span><b>{r.title}</b></button>)}
        </div>
        <div className="bankSelected">
          <span className="bankSelectedIcon">{active.icon}</span>
          <div><b>دخول {active.title}</b><small>{active.desc}</small></div>
        </div>
        <Link className="bankEnter" href={active.href}>متابعة الدخول الآمن ←</Link>
        <div className="bankUtility"><Link href="/auth/forgot-username">نسيت اسم المستخدم؟</Link><Link href="/auth/forgot">نسيت كلمة المرور؟</Link></div>
        <div className="bankAlt"><Link href="/auth/register">إنشاء حساب جديد</Link><Link href="/subscription">عروض الاشتراك</Link></div>
      </div>
    </section>
    <footer className="bankEntryFoot"><span>© مصرف التعليم</span><span>منصة تعليمية لإدارة الفصول والمتابعة والتواصل</span></footer>
  </main>
}
