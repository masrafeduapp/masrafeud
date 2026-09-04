'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function sendPortalMessage(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle();if(!m)redirect('/messages?flash=failed')
 const studentId=String(formData.get('student_id')||'');const title=String(formData.get('title')||'').trim();const body=String(formData.get('body')||'').trim();const type=String(formData.get('message_type')||'info')
 if(!studentId||title.length<2||title.length>120||body.length<2||body.length>1200||!['info','success','warning','task'].includes(type))redirect('/messages?flash=failed')
 const {error}=await supabase.from('student_portal_messages').insert({tenant_id:m.tenant_id,student_id:studentId,title,body,message_type:type,created_by:user.id})
 if(error)redirect('/messages?flash=failed');revalidatePath('/messages');revalidatePath('/student');redirect('/messages?flash=message-sent')
}
