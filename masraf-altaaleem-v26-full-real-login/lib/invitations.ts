import { createAdminClient } from '@/lib/supabase/admin'

export async function acceptPendingInviteForUser(user:{id:string,email?:string|null}){
  if(!user.email) return false
  const admin=createAdminClient()
  const email=user.email.trim().toLowerCase()
  const {data:invite}=await admin.from('teacher_invites').select('id,tenant_id,role,full_name,status,expires_at').eq('email',email).eq('status','pending').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(!invite) return false
  const {error:mError}=await admin.from('memberships').upsert({tenant_id:invite.tenant_id,user_id:user.id,role:invite.role},{onConflict:'tenant_id,user_id'})
  if(mError) throw mError
  await admin.from('member_profiles').upsert({user_id:user.id,full_name:invite.full_name,updated_at:new Date().toISOString()},{onConflict:'user_id'})
  await admin.from('teacher_invites').update({status:'accepted',accepted_by:user.id,accepted_at:new Date().toISOString()}).eq('id',invite.id).eq('status','pending')
  await admin.from('audit_logs').insert({tenant_id:invite.tenant_id,actor_user_id:user.id,action:'teacher.invite_accepted',entity_type:'membership',entity_id:user.id,metadata:{invite_id:invite.id}})
  return true
}
