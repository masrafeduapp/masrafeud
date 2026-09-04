'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function ctx(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('UNAUTHENTICATED')
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle();if(!m)throw new Error('NO_TENANT')
 return {supabase,user,tenantId:m.tenant_id}
}
export async function createBadge(formData:FormData){
 const {supabase,user,tenantId}=await ctx();const name=String(formData.get('name')||'').trim();const description=String(formData.get('description')||'').trim();const icon=String(formData.get('icon')||'🏅').trim().slice(0,20);const bonus=Number(formData.get('points_bonus')||0)
 if(name.length<2||name.length>100||!Number.isInteger(bonus)||bonus<0||bonus>10000)redirect('/achievements?flash=failed')
 const {error}=await supabase.from('achievement_badges').insert({tenant_id:tenantId,name,description:description||null,icon:icon||'🏅',points_bonus:bonus,created_by:user.id})
 if(error)redirect('/achievements?flash=failed'); revalidatePath('/achievements');redirect('/achievements?flash=badge-saved')
}
export async function awardBadge(formData:FormData){
 const {supabase}=await ctx();const student=String(formData.get('student_id')||'');const badge=String(formData.get('badge_id')||'');const note=String(formData.get('note')||'').trim()
 if(!student||!badge)redirect('/achievements?flash=failed')
 const {error}=await supabase.rpc('award_student_badge',{p_student:student,p_badge:badge,p_note:note||null})
 if(error)redirect('/achievements?flash=failed');revalidatePath('/achievements');revalidatePath('/student');redirect('/achievements?flash=badge-awarded')
}
