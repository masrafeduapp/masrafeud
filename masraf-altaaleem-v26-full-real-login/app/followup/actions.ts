'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function context(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('UNAUTHORIZED')
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle(); if(!m) throw new Error('NO_TENANT')
 return {supabase,user,tenantId:m.tenant_id}
}
export async function recordAttendance(formData:FormData){
 const {supabase,user,tenantId}=await context(); const studentId=String(formData.get('student_id')||''); const status=String(formData.get('status')||''); const date=String(formData.get('attendance_date')||'')
 const {data:s}=await supabase.from('students').select('id,class_id').eq('id',studentId).eq('tenant_id',tenantId).maybeSingle(); if(!s?.class_id) return
 await supabase.from('attendance_records').upsert({tenant_id:tenantId,student_id:s.id,class_id:s.class_id,attendance_date:date,status,recorded_by:user.id,updated_at:new Date().toISOString()},{onConflict:'student_id,attendance_date'})
 revalidatePath('/followup');redirect('/followup?flash=attendance-saved')
}
export async function createTask(formData:FormData){
 const {supabase,user,tenantId}=await context(); const classId=String(formData.get('class_id')||''); const title=String(formData.get('title')||'').trim(); const due=String(formData.get('due_date')||'')||null
 const starts=String(formData.get('starts_on')||'')||null; const rawType=String(formData.get('task_type')||'واجب'); const other=String(formData.get('other_type')||'').trim(); const taskType=rawType==='أخرى'&&other?other:rawType
 const grade=Math.max(0,Math.min(9999,Number(formData.get('grade')||0)||0)); const isPublished=String(formData.get('is_published')||'')==='on'
 if(title.length<2||!classId) return
 const {error}=await supabase.from('tasks').insert({tenant_id:tenantId,class_id:classId,title,due_date:due,starts_on:starts,task_type:taskType,grade,is_published:isPublished,created_by:user.id}); if(error)redirect('/followup?flash=failed'); revalidatePath('/followup');redirect('/followup?flash=task-published')
}
export async function setTaskStatus(formData:FormData){
 const {supabase,user,tenantId}=await context(); const taskId=String(formData.get('task_id')||''); const studentId=String(formData.get('student_id')||''); const status=String(formData.get('status')||'')
 const {error}=await supabase.from('task_submissions').upsert({tenant_id:tenantId,task_id:taskId,student_id:studentId,status,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'task_id,student_id'}); if(error)redirect('/followup?flash=failed'); revalidatePath('/followup');redirect('/followup?flash=followup-saved')
}
export async function saveFollowupNote(formData:FormData){
 const {supabase,user,tenantId}=await context(); const studentId=String(formData.get('student_id')||''); const note=String(formData.get('note')||'').trim().slice(0,500); if(!studentId)return
 const {data:s}=await supabase.from('students').select('id').eq('id',studentId).eq('tenant_id',tenantId).maybeSingle(); if(!s)return
 const {error}=await supabase.from('student_followup_notes').upsert({tenant_id:tenantId,student_id:studentId,note,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'student_id'});if(error)redirect('/followup?flash=failed');revalidatePath('/followup');redirect('/followup?flash=followup-saved')
}
export async function clearStudentFollowup(formData:FormData){
 const {supabase,tenantId}=await context();const studentId=String(formData.get('student_id')||'');if(!studentId)return
 const {error}=await supabase.from('task_submissions').delete().eq('tenant_id',tenantId).eq('student_id',studentId);if(error)redirect('/followup?flash=failed');revalidatePath('/followup');redirect('/followup?flash=data-cleared')
}
