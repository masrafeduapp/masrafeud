'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformOwner } from '@/lib/owner'

const validStatuses=new Set(['trialing','active','past_due','canceled','expired','suspended'])

export async function setTenantStatus(formData:FormData){
  const tenantId=String(formData.get('tenant_id')||'')
  const status=String(formData.get('status')||'')
  if(!tenantId || !validStatuses.has(status)) throw new Error('INVALID_REQUEST')

  const {user,admin}=await requirePlatformOwner()
  const {error}=await admin.from('subscriptions').update({status,updated_at:new Date().toISOString()}).eq('tenant_id',tenantId)
  if(error) throw new Error('SUBSCRIPTION_UPDATE_FAILED')
  await admin.from('audit_logs').insert({tenant_id:tenantId,actor_user_id:user.id,action:'platform.subscription_status_changed',entity_type:'subscription',entity_id:tenantId,metadata:{status}})
  revalidatePath('/owner')
}

export async function setTenantPlan(formData:FormData){
  const tenantId=String(formData.get('tenant_id')||'')
  const planCode=String(formData.get('plan_code')||'')
  if(!tenantId || !planCode) throw new Error('INVALID_REQUEST')

  const {user,admin}=await requirePlatformOwner()
  const {data:plan}=await admin.from('plans').select('code').eq('code',planCode).eq('is_active',true).maybeSingle()
  if(!plan) throw new Error('PLAN_NOT_FOUND')
  const {error}=await admin.from('subscriptions').update({plan_code:planCode,updated_at:new Date().toISOString()}).eq('tenant_id',tenantId)
  if(error) throw new Error('PLAN_UPDATE_FAILED')
  await admin.from('audit_logs').insert({tenant_id:tenantId,actor_user_id:user.id,action:'platform.plan_changed',entity_type:'subscription',entity_id:tenantId,metadata:{plan_code:planCode}})
  revalidatePath('/owner')
}
