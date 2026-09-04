'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { clearStudentSession, getStudentSessionAccountId } from '@/lib/student-auth'

async function context(){
 const aid=await getStudentSessionAccountId(); if(!aid)return null
 const admin=createAdminClient()
 const {data:a}=await admin.from('student_portal_accounts').select('id,tenant_id,student_id,active').eq('id',aid).maybeSingle()
 return a?.active?{admin,a}:null
}
export async function studentLogout(){await clearStudentSession();redirect('/student/login?flash=logout')}

export async function spinStudentRoulette(){
 const ctx=await context(); if(!ctx)redirect('/student/login')
 const {admin,a}=ctx
 const {error}=await admin.rpc('spin_student_roulette',{p_actor_account:a.id})
 if(error){
  const msg=error.message.toLowerCase()
  redirect(msg.includes('no chances')||msg.includes('no rewards')?'/student?spin=none':'/student?spin=failed')
 }
 revalidatePath('/student');redirect('/student?spin=success')
}

export async function transferEducationalBalance(formData:FormData){
 const ctx=await context(); if(!ctx)redirect('/student/login')
 const {admin,a}=ctx
 const username=String(formData.get('recipient_username')||'').trim().toLowerCase()
 const amount=Number(String(formData.get('amount')||'0'))
 const reason=String(formData.get('reason')||'').trim()
 if(!/^[a-z0-9._-]{4,40}$/i.test(username)||!Number.isFinite(amount)||amount<=0||reason.length<2)redirect('/student?transfer=invalid')
 const {data:recipient}=await admin.from('student_portal_accounts').select('student_id,tenant_id,active').eq('username',username).maybeSingle()
 if(!recipient?.active || recipient.tenant_id!==a.tenant_id || recipient.student_id===a.student_id)redirect('/student?transfer=invalid')
 const {error}=await admin.rpc('transfer_student_educational_balance',{p_actor_account:a.id,p_from_student:a.student_id,p_to_student:recipient.student_id,p_amount:amount,p_reason:reason})
 if(error)redirect(error.message.toLowerCase().includes('insufficient')?'/student?transfer=insufficient':'/student?transfer=failed')
 revalidatePath('/student');redirect('/student?transfer=success')
}

export async function markStudentMessageRead(formData:FormData){
 const ctx=await context(); if(!ctx)redirect('/student/login')
 const {admin,a}=ctx;const id=String(formData.get('message_id')||'')
 if(id) await admin.from('student_portal_messages').update({read_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',a.tenant_id).eq('student_id',a.student_id).is('read_at',null)
 revalidatePath('/student')
}
