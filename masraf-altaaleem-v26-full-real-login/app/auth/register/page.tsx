'use client'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const plans:Record<string,string>={teacher:'معلمة',school:'مدرسة',enterprise:'مؤسسة'}
const classLabels:Record<string,string>={one:'فصل واحد',three:'3 فصول',multi:'أكثر من 3 فصول'}
const cycleLabels:Record<string,string>={monthly:'شهري',term:'ترم',yearly:'سنوي'}
export default function Register(){
 const params=useSearchParams(); const requested=plans[params.get('plan')||'']?String(params.get('plan')):'teacher'
 const classTier=classLabels[params.get('classes')||'']?String(params.get('classes')):''
 const billingCycle=cycleLabels[params.get('cycle')||'']?String(params.get('cycle')):''
 const [msg,setMsg]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setMsg('');setError('');setLoading(true);const f=new FormData(e.currentTarget);const password=String(f.get('password'));if(password.length<10){setError('كلمة المرور يجب ألا تقل عن 10 أحرف.');setLoading(false);return}const supabase=createClient();const {error}=await supabase.auth.signUp({email:String(f.get('email')).trim().toLowerCase(),password,options:{data:{full_name:String(f.get('name')),organization_name:String(f.get('organization')),requested_plan:requested,requested_class_tier:classTier||null,requested_billing_cycle:billingCycle||null}}});if(error){setError('تعذر إنشاء الحساب. قد يكون البريد مستخدمًا أو البيانات غير صحيحة.');setLoading(false);return}setMsg('تم إنشاء الحساب ومساحته المستقلة. إذا كان تأكيد البريد مفعّلًا، افتحي رسالة التأكيد ثم عودي لتسجيل الدخول.');setLoading(false)}
 return <main className="authWrap"><form className="card authCard" onSubmit={submit}><div className="brand"><span className="logo">م</span> مصرف التعليم</div><span className="badge">الباقة المطلوبة: {plans[requested]}{classTier?` · ${classLabels[classTier]}`:''}{billingCycle?` · ${cycleLabels[billingCycle]}`:''}</span><h1>إنشاء حساب</h1><label className="field">الاسم الكامل<input name="name" required maxLength={120}/></label><label className="field">اسم المدرسة / الجهة<input name="organization" required maxLength={160}/></label><label className="field">البريد الإلكتروني<input name="email" type="email" autoComplete="email" required/></label><label className="field">كلمة المرور<input name="password" type="password" autoComplete="new-password" minLength={10} required/></label>{error&&<p className="error">{error}</p>}{msg&&<div className="notice">{msg}</div>}<button className="btn btn-primary" style={{width:'100%'}} disabled={loading}>{loading?'جارٍ إنشاء المساحة…':'إنشاء الحساب'}</button><p className="muted">لديك حساب؟ <Link href="/">العودة إلى بوابة الدخول</Link></p></form></main>
}
