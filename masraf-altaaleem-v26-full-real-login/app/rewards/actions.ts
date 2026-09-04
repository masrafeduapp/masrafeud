'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function createReward(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,role').eq('user_id',user.id).maybeSingle();if(!m||!['tenant_owner','admin'].includes(m.role))redirect('/rewards?flash=failed')
 const name=String(formData.get('name')||'').trim();const points_cost=Number.parseInt(String(formData.get('points_cost')||'0'),10);const reward_points=Math.max(0,Number.parseInt(String(formData.get('reward_points')||'0'),10)||0);const reward_balance=Math.max(0,Number(String(formData.get('reward_balance')||'0'))||0);if(name.length<2||!Number.isFinite(points_cost)||points_cost<0)redirect('/rewards?flash=failed')
 const {error}=await supabase.from('rewards').insert({tenant_id:m.tenant_id,name,points_cost,reward_points,reward_balance,created_by:user.id});if(error)redirect('/rewards?flash=failed')
 revalidatePath('/rewards');redirect('/rewards?flash=reward-saved')
}
export async function redeemReward(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const student=String(formData.get('student_id')||'');const reward=String(formData.get('reward_id')||'');if(!student||!reward)redirect('/rewards?flash=failed')
 const {error}=await supabase.rpc('redeem_reward',{p_student:student,p_reward:reward});if(error)redirect('/rewards?flash=failed')
 revalidatePath('/rewards');revalidatePath('/points');revalidatePath('/honor');redirect('/rewards?flash=reward-redeemed')
}
