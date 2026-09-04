'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function adminContext(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('UNAUTHORIZED')
 const {data:m}=await supabase.from('memberships').select('id,tenant_id,role').eq('user_id',user.id).maybeSingle(); if(!m||!['tenant_owner','admin'].includes(m.role)) throw new Error('FORBIDDEN')
 return {supabase,user,m}
}
export async function inviteTeacher(formData:FormData){
 const {user,m}=await adminContext(); const admin=createAdminClient()
 const email=String(formData.get('email')||'').trim().toLowerCase(); const fullName=String(formData.get('full_name')||'').trim(); const role=String(formData.get('role')||'teacher')
 if(!/^\S+@\S+\.\S+$/.test(email)||fullName.length<2||!['teacher','admin'].includes(role)) return
 const {data:existing}=await admin.from('memberships').select('id,user_id').eq('tenant_id',m.tenant_id)
 if(existing?.length){ for(const x of existing){ const {data:u}=await admin.auth.admin.getUserById(x.user_id); if(u.user?.email?.toLowerCase()===email) return } }
 const {data:invite,error}=await admin.from('teacher_invites').insert({tenant_id:m.tenant_id,email,full_name:fullName,role,invited_by:user.id}).select('id').single(); if(error) throw error
 const redirectTo=`${process.env.NEXT_PUBLIC_APP_URL||''}/auth/confirm?next=/dashboard`
 const {error:authError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:redirectTo.startsWith('http')?redirectTo:undefined,data:{display_name:fullName,invited_member:true}})
 if(authError){ await admin.from('teacher_invites').update({status:'revoked'}).eq('id',invite.id); throw authError }
 await admin.from('audit_logs').insert({tenant_id:m.tenant_id,actor_user_id:user.id,action:'teacher.invited',entity_type:'teacher_invite',entity_id:invite.id,metadata:{email,role}})
 revalidatePath('/teachers')
}
export async function setTeacherClasses(formData:FormData){
 const {user,m}=await adminContext(); const admin=createAdminClient(); const membershipId=String(formData.get('membership_id')||''); const classIds=formData.getAll('class_id').map(String)
 const {data:target}=await admin.from('memberships').select('id,tenant_id,role').eq('id',membershipId).eq('tenant_id',m.tenant_id).maybeSingle(); if(!target||target.role==='tenant_owner') return
 const {data:valid}=await admin.from('classes').select('id').eq('tenant_id',m.tenant_id).in('id',classIds.length?classIds:['00000000-0000-0000-0000-000000000000'])
 const validIds=new Set((valid||[]).map(x=>x.id)); await admin.from('teacher_class_assignments').delete().eq('tenant_id',m.tenant_id).eq('membership_id',membershipId)
 const rows=classIds.filter(id=>validIds.has(id)).map(class_id=>({tenant_id:m.tenant_id,membership_id:membershipId,class_id})); if(rows.length) await admin.from('teacher_class_assignments').insert(rows)
 await admin.from('audit_logs').insert({tenant_id:m.tenant_id,actor_user_id:user.id,action:'teacher.classes_changed',entity_type:'membership',entity_id:membershipId,metadata:{class_ids:[...validIds]}})
 revalidatePath('/teachers')
}
export async function revokeInvite(formData:FormData){ const {user,m}=await adminContext(); const admin=createAdminClient(); const id=String(formData.get('invite_id')||''); await admin.from('teacher_invites').update({status:'revoked'}).eq('id',id).eq('tenant_id',m.tenant_id).eq('status','pending'); await admin.from('audit_logs').insert({tenant_id:m.tenant_id,actor_user_id:user.id,action:'teacher.invite_revoked',entity_type:'teacher_invite',entity_id:id}); revalidatePath('/teachers') }
