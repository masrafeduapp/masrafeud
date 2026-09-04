'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function addOperation(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/auth/login')
 const student=String(formData.get('student_id')||''); const type=String(formData.get('operation_type')||'credit'); const amount=Number(formData.get('amount')||0); const reason=String(formData.get('reason')||'').trim()
 if(!student||!['credit','debit'].includes(type)||!Number.isFinite(amount)||amount<=0||reason.length<2)redirect('/operations?flash=failed')
 const {error}=await supabase.rpc('adjust_student_balance',{p_student:student,p_type:type,p_amount:amount,p_reason:reason})
 if(error) redirect(`/operations?flash=${error.message.toLowerCase().includes('insufficient')?'insufficient-balance':'failed'}`)
 revalidatePath('/operations');revalidatePath('/advanced');revalidatePath('/honor')
 redirect(`/operations?flash=${type==='credit'?'deposit-success':'withdraw-success'}`)
}
