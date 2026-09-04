'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function addClass(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,role').eq('user_id',user.id).maybeSingle();if(!m||!['tenant_owner','admin'].includes(m.role))redirect('/classes?flash=failed')
 const name=String(formData.get('name')||'').trim();if(!name)redirect('/classes?flash=failed')
 const {error}=await supabase.from('classes').insert({tenant_id:m.tenant_id,name});if(error)redirect('/classes?flash=failed')
 revalidatePath('/classes');revalidatePath('/students');revalidatePath('/dashboard');redirect('/classes?flash=class-added')
}
