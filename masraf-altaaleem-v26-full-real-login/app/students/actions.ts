'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function addStudent(formData: FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle(); if(!m) redirect('/students?flash=failed')
 const full_name=String(formData.get('full_name')||'').trim(); if(full_name.length<2) redirect('/students?flash=failed')
 const guardian_name=String(formData.get('guardian_name')||'').trim()||null
 const guardian_phone=String(formData.get('guardian_phone')||'').trim()||null
 const class_id=String(formData.get('class_id')||'').trim()||null
 const consent=formData.get('guardian_consent')==='on'
 const {error}=await supabase.from('students').insert({tenant_id:m.tenant_id,full_name,guardian_name,guardian_phone,class_id,guardian_consent:consent,guardian_consent_at:consent?new Date().toISOString():null})
 if(error) redirect('/students?flash=failed')
 revalidatePath('/students'); revalidatePath('/dashboard'); revalidatePath('/messages'); redirect('/students?flash=student-added')
}

import { createAdminClient } from '@/lib/supabase/admin'
import { hashStudentPassword } from '@/lib/student-auth'

export async function saveStudentPortalAccount(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/auth/login')
 const studentId=String(formData.get('student_id')||'')
 const username=String(formData.get('username')||'').trim().toLowerCase()
 const password=String(formData.get('password')||'')
 const chances=Math.max(0,Math.min(10000,Number.parseInt(String(formData.get('roulette_chances')||'0'),10)||0))
 if(!studentId || !/^[a-z0-9._-]{4,40}$/i.test(username) || password.length<8)redirect('/students?flash=failed')
 const {data:student}=await supabase.from('students').select('id,tenant_id').eq('id',studentId).maybeSingle()
 if(!student)redirect('/students?flash=failed')
 const admin=createAdminClient()
 const {data:existing}=await admin.from('student_portal_accounts').select('id').eq('student_id',studentId).maybeSingle()
 const payload={tenant_id:student.tenant_id,student_id:studentId,username,password_hash:hashStudentPassword(password),active:true,updated_at:new Date().toISOString()}
 if(existing) await admin.from('student_portal_accounts').update(payload).eq('id',existing.id)
 else await admin.from('student_portal_accounts').insert(payload)
 await admin.from('student_metrics').upsert({student_id:studentId,tenant_id:student.tenant_id,roulette_chances:chances,updated_at:new Date().toISOString()},{onConflict:'student_id'})
 revalidatePath('/students'); revalidatePath('/student'); redirect('/students?flash=account-saved')
}
