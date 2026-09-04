'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { roleLogin } from '@/app/auth/role-actions'

type Kind='teacher'|'admin'|'subscriber'

function SubmitButton(){
 const {pending}=useFormStatus()
 return <button className="loginSubmit" disabled={pending}>{pending?'جارٍ التحقق الآمن…':'دخول آمن'}</button>
}

export default function RoleLogin({kind}:{kind:Kind}){
 const [state,action]=useActionState(roleLogin,{error:''})
 const [show,setShow]=useState(false)
 const [focus,setFocus]=useState<'none'|'user'|'pass'>('none')
 const meta={
  teacher:{icon:'👩‍🏫',title:'بوابة المعلمة',headline:'أهلًا بكِ في مصرف التعليم',desc:'إدارة الفصول والطلاب والمتابعة والتواصل من مساحة واحدة آمنة.'},
  admin:{icon:'🏫',title:'بوابة الإدارة',headline:'لوحة الإدارة تبدأ من هنا',desc:'إدارة الصلاحيات والمعلمين والتقارير والاشتراك من بوابة إدارية مستقلة.'},
  subscriber:{icon:'💳',title:'حساب المشترك',headline:'إدارة اشتراكك تبدأ من هنا',desc:'دخول حساب المشترك للوصول إلى المساحة المرتبطة بخطتك وصلاحياتك.'}
 }[kind]
 const face=focus==='pass'?(show?'🐵':'🙈'):focus==='user'?'🐒':meta.icon
 return <main className="roleLoginPage" dir="rtl">
   <Link className="loginBack" href="/">رجوع إلى البوابة</Link>
   <section className="roleLoginShell">
    <aside className={`loginVisual ${kind==='admin'?'adminVisual':''}`}>
      <div className="loginVisualMark">م</div><span>{meta.title}</span>
      <h1>{meta.headline}</h1><p>{meta.desc}</p>
      <div className="visualBullets"><i>✓ جلسة دخول آمنة</i><i>✓ عزل بيانات كل مشترك</i><i>✓ تحقق فعلي من الصلاحية</i></div>
    </aside>
    <form className="loginFormCard" action={action}>
      <input type="hidden" name="kind" value={kind}/>
      <div className="publicBrand"><span>م</span><div><b>مصرف التعليم</b><small>EDUCATION BANK</small></div></div>
      <div className="interactiveFace" aria-hidden="true">{face}</div>
      <span className="loginPill">{meta.title}</span>
      <h2>تسجيل الدخول</h2><p>أدخلي بيانات الحساب للوصول إلى المساحة الخاصة بك.</p>
      <label className="field">البريد الإلكتروني<input name="email" type="email" autoComplete="email" inputMode="email" required onFocus={()=>setFocus('user')} onBlur={()=>setFocus('none')}/></label>
      <label className="field">كلمة المرور<div className="passwordField"><input name="password" type={show?'text':'password'} autoComplete="current-password" minLength={10} required onFocus={()=>setFocus('pass')} onBlur={()=>setFocus('none')}/><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setShow(v=>!v)}>{show?'🙈':'👁️'}</button></div></label>
      {state.error&&<div className="loginError" role="alert">{state.error}</div>}
      <div className="loginUtility"><Link href="/auth/forgot-username">نسيت اسم المستخدم؟</Link><Link href="/auth/forgot">نسيت كلمة المرور؟</Link></div>
      <SubmitButton/>
      <div className="loginFoot"><Link href="/subscription">عروض الاشتراك</Link><Link href="/auth/register">إنشاء حساب جديد</Link></div>
    </form>
   </section>
 </main>
}
