'use client'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function Login(){
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');const form=new FormData(e.currentTarget);const supabase=createClient();const {error}=await supabase.auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))});if(error){setError('تعذر تسجيل الدخول. تحققي من البريد وكلمة المرور.');setLoading(false);return}location.href='/dashboard'}
  return <main className="authWrap"><form className="card authCard" onSubmit={submit}><div className="brand"><span className="logo">م</span> مصرف التعليم</div><h1>تسجيل الدخول</h1><p className="muted">الدخول إلى مساحة الاشتراك الخاصة بك.</p><label className="field">البريد الإلكتروني<input name="email" type="email" autoComplete="email" required/></label><label className="field">كلمة المرور<input name="password" type="password" autoComplete="current-password" minLength={10} required/></label>{error&&<p className="error">{error}</p>}<button className="btn btn-primary" style={{width:'100%'}} disabled={loading}>{loading?'جارٍ التحقق…':'دخول آمن'}</button><p className="muted">ليس لديك حساب؟ <Link href="/auth/register">إنشاء اشتراك</Link></p></form></main>
}
