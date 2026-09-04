'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { requestPasswordReset } from '../role-actions'

function Button(){const {pending}=useFormStatus();return <button className="loginSubmit" disabled={pending}>{pending?'جارٍ الإرسال…':'إرسال رابط الاستعادة'}</button>}
export default function Forgot(){
 const [state,action]=useActionState(requestPasswordReset,{error:''})
 const params=useSearchParams(); const sent=params.get('sent')==='1'
 return <main className="authWrap" dir="rtl"><form className="card authCard" action={action}><div className="brand"><span className="logo">م</span> مصرف التعليم</div><h1>استعادة كلمة المرور</h1><p className="muted">أدخلي البريد المرتبط بالحساب وسنرسل رابطًا آمنًا لتعيين كلمة مرور جديدة.</p>{sent&&<div className="notice">تم إرسال رابط الاستعادة إذا كان البريد مرتبطًا بحساب. تحققي من البريد الوارد.</div>}<label className="field">البريد الإلكتروني<input name="email" type="email" autoComplete="email" required/></label>{state.error&&<p className="error">{state.error}</p>}<Button/><p className="muted"><Link href="/">العودة إلى بوابة الدخول</Link></p></form></main>
}
