import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requirePlatformOwner(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/auth/login')
  const ownerEmail=process.env.OWNER_EMAIL?.trim().toLowerCase()
  if(!ownerEmail || user.email?.toLowerCase()!==ownerEmail) redirect('/dashboard')
  return {user,admin:createAdminClient()}
}
