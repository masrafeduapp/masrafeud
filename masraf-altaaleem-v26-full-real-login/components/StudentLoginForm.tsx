'use client'
import Link from 'next/link'
import { useState } from 'react'
import { studentLogin } from '@/app/student/login/actions'

export default function StudentLoginForm({error,locked}:{error?:boolean;locked?:boolean}){
 const [gender,setGender]=useState<'male'|'female'>('male')
 const [focus,setFocus]=useState<'none'|'user'|'pass'>('none')
 const [show,setShow]=useState(false)
 const face=focus==='pass'?(show?'🐵':'🙈'):focus==='user'?'🐒':gender==='female'?'👩‍🎓':'👨‍🎓'
 return <section className="studentLoginCard">
   <div className="studentGenderPick"><button type="button" onClick={()=>setGender('male')} className={gender==='male'?'active':''}>👨‍🎓 طالب</button><button type="button" onClick={()=>setGender('female')} className={gender==='female'?'active':''}>👩‍🎓 طالبة</button></div>
   <div className="studentFace">{face}</div><span className="studentKicker">مصرف التعليم</span><h1>دخول {gender==='female'?'الطالبة':'الطالب'}</h1><p>أدخل بيانات حسابك التعليمي للوصول إلى رصيدك ونقاطك ومتابعتك.</p>
   {locked?<div className="studentError">تم إيقاف محاولات الدخول مؤقتًا لمدة 10 دقائق بعد محاولات متكررة غير صحيحة.</div>:error&&<div className="studentError">اسم المستخدم أو كلمة المرور غير صحيحة.</div>}
   <form action={studentLogin}>
    <label><span>اسم المستخدم</span><input name="username" autoComplete="username" required minLength={4} onFocus={()=>setFocus('user')} onBlur={()=>setFocus('none')}/></label>
    <label><span>كلمة المرور</span><div className="passwordField"><input name="password" type={show?'text':'password'} autoComplete="current-password" required minLength={8} onFocus={()=>setFocus('pass')} onBlur={()=>setFocus('none')}/><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setShow(v=>!v)}>{show?'🙈':'👁️'}</button></div></label>
    <div className="studentRecovery"><Link href="/auth/forgot-username">نسيت اسم المستخدم؟</Link><span title="كلمة مرور الطالب تديرها المعلمة من حسابها">نسيت كلمة المرور؟ تواصل مع المعلمة</span></div>
    <button>دخول إلى حسابي</button>
   </form>
   <small>بيانات هذا الحساب خاصة بك ولا تظهر حسابات الطلاب الآخرين.</small>
 </section>
}
