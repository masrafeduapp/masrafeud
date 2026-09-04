'use server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { setStudentSession, verifyStudentPassword } from '@/lib/student-auth'

export async function studentLogin(formData:FormData){
  const username=String(formData.get('username')||'').trim().toLowerCase()
  const password=String(formData.get('password')||'')
  if(!/^[a-z0-9._-]{4,40}$/i.test(username) || password.length<8) redirect('/student/login?error=1')
  const admin=createAdminClient()
  const {data:account}=await admin.from('student_portal_accounts').select('id,password_hash,active,failed_login_attempts,locked_until').eq('username',username).maybeSingle()
  if(!account?.active) redirect('/student/login?error=1')
  const now=Date.now()
  if(account.locked_until && new Date(account.locked_until).getTime()>now) redirect('/student/login?locked=1')
  const ok=verifyStudentPassword(password,account.password_hash)
  if(!ok){
    const failures=Math.min(1000,Number(account.failed_login_attempts||0)+1)
    const locked=failures>=5?new Date(now+10*60*1000).toISOString():null
    await admin.from('student_portal_accounts').update({failed_login_attempts:failures,locked_until:locked,updated_at:new Date().toISOString()}).eq('id',account.id)
    redirect(locked?'/student/login?locked=1':'/student/login?error=1')
  }
  await admin.from('student_portal_accounts').update({last_login_at:new Date().toISOString(),failed_login_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq('id',account.id)
  await setStudentSession(account.id)
  redirect('/student')
}
