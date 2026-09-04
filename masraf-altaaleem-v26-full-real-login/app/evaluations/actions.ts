'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function addEvaluation(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle();if(!m)redirect('/evaluations?flash=failed')
 const student_id=String(formData.get('student_id')||'');const category=String(formData.get('category')||'').trim();const score=Number(formData.get('score')||0);const note=String(formData.get('note')||'').trim();if(!student_id||category.length<2||!Number.isFinite(score)||score<0||score>100)redirect('/evaluations?flash=failed')
 const {error}=await supabase.from('student_evaluations').insert({tenant_id:m.tenant_id,student_id,category,score,note:note||null,evaluated_by:user.id});if(error)redirect('/evaluations?flash=failed')
 revalidatePath('/evaluations');revalidatePath('/advanced');redirect('/evaluations?flash=evaluation-saved')
}
