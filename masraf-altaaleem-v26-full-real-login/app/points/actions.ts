'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function addPoints(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/auth/login')
 const student=String(formData.get('student_id')||''); const delta=Number.parseInt(String(formData.get('delta')||'0'),10); const reason=String(formData.get('reason')||'').trim()
 if(!student||!Number.isFinite(delta)||delta===0||reason.length<2)redirect('/points?flash=failed')
 const {error}=await supabase.rpc('adjust_student_points',{p_student:student,p_delta:delta,p_reason:reason});if(error)redirect('/points?flash=failed')
 revalidatePath('/points');revalidatePath('/honor');revalidatePath('/advanced');redirect('/points?flash=points-saved')
}
