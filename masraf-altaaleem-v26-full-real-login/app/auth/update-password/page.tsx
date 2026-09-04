'use client'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePassword } from '../role-actions'
function Button(){const {pending}=useFormStatus();return <button className="loginSubmit" disabled={pending}>{pending?'جارٍ الحفظ…':'حفظ كلمة المرور الجديدة'}</button>}
export default function UpdatePassword(){const [state,action]=useActionState(updatePassword,{error:''});return <main className="authWrap" dir="rtl"><form className="card authCard" action={action}><div className="brand"><span className="logo">م</span> مصرف التعليم</div><h1>كلمة مرور جديدة</h1><p className="muted">استخدمي كلمة مرور قوية لا تقل عن 10 أحرف.</p><label className="field">كلمة المرور الجديدة<input name="password" type="password" autoComplete="new-password" minLength={10} required/></label><label className="field">تأكيد كلمة المرور<input name="confirm" type="password" autoComplete="new-password" minLength={10} required/></label>{state.error&&<p className="error">{state.error}</p>}<Button/></form></main>}
