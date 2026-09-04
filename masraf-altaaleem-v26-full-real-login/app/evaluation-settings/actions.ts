'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function saveSettings(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,role').eq('user_id',user.id).maybeSingle();if(!m||!['tenant_owner','admin'].includes(m.role))redirect('/evaluation-settings?flash=failed')
 const row={tenant_id:m.tenant_id,auto_deduction_enabled:formData.get('auto_deduction_enabled')==='on',absence_points_deduction:Math.max(0,Math.min(1000,Number(formData.get('absence_points_deduction')||0))),late_points_deduction:Math.max(0,Math.min(1000,Number(formData.get('late_points_deduction')||0))),honor_board_count:Math.max(1,Math.min(20,Number(formData.get('honor_board_count')||5))),updated_by:user.id,updated_at:new Date().toISOString()}
 const {error}=await supabase.from('teacher_bank_settings').upsert(row,{onConflict:'tenant_id'});if(error)redirect('/evaluation-settings?flash=failed')
 revalidatePath('/evaluation-settings');revalidatePath('/honor');redirect('/evaluation-settings?flash=settings-saved')
}
