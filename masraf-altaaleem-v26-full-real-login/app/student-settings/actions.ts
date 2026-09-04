'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function saveStudentPortalSettings(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,role').eq('user_id',user.id).maybeSingle();if(!m||!['tenant_owner','admin'].includes(m.role))redirect('/student-settings?flash=failed')
 const row={tenant_id:m.tenant_id,school_label:String(formData.get('school_label')||'').trim()||null,subject_label:String(formData.get('subject_label')||'التعليم').trim()||'التعليم',show_balance:formData.get('show_balance')==='on',show_points:formData.get('show_points')==='on',show_honor_board:formData.get('show_honor_board')==='on',show_rewards:formData.get('show_rewards')==='on',show_evaluations:formData.get('show_evaluations')==='on',show_messages:formData.get('show_messages')==='on',show_achievements:formData.get('show_achievements')==='on',updated_by:user.id,updated_at:new Date().toISOString()}
 const {error}=await supabase.from('student_portal_settings').upsert(row,{onConflict:'tenant_id'})
 if(error)redirect('/student-settings?flash=failed');revalidatePath('/student-settings');revalidatePath('/student');redirect('/student-settings?flash=settings-saved')
}
