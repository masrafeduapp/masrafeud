import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { maskPhone, normalizeSaudiPhone, sendTwilio, type Channel } from '@/lib/messaging'

export async function POST(req:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
 let p:any;try{p=await req.json()}catch{return NextResponse.json({error:'INVALID_JSON'},{status:400})}
 const classId=String(p.classId||''),channel=String(p.channel||'') as Channel,body=String(p.body||'').trim(); if(!classId||!['sms','whatsapp'].includes(channel)||body.length<1||body.length>1200)return NextResponse.json({error:'INVALID_INPUT'},{status:400})
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle(); if(!m)return NextResponse.json({error:'NO_TENANT'},{status:403})
 const {data:klass}=await supabase.from('classes').select('id').eq('id',classId).eq('tenant_id',m.tenant_id).maybeSingle(); if(!klass)return NextResponse.json({error:'CLASS_NOT_FOUND'},{status:404})
 const {data:students}=await supabase.from('students').select('id,guardian_phone,guardian_consent').eq('tenant_id',m.tenant_id).eq('class_id',classId).eq('guardian_consent',true).not('guardian_phone','is',null).limit(60)
 if(!students?.length)return NextResponse.json({error:'NO_ELIGIBLE_RECIPIENTS'},{status:400})
 const admin=createAdminClient(); let sent=0,failed=0
 for(const s of students){
  let phone:string; try{phone=normalizeSaudiPhone(String(s.guardian_phone))}catch{failed++;continue}
  const {data:msg}=await supabase.from('outbound_messages').insert({tenant_id:m.tenant_id,student_id:s.id,actor_user_id:user.id,channel,recipient_phone_masked:maskPhone(phone),body,status:'queued'}).select('id').single(); if(!msg){failed++;continue}
  try{const r=await sendTwilio(channel,phone,body);await admin.from('outbound_messages').update({status:'sent',provider_message_id:r.id,sent_at:new Date().toISOString(),error_code:null}).eq('id',msg.id);sent++}catch(e:any){await admin.from('outbound_messages').update({status:'failed',error_code:String(e?.message||'SEND_FAILED').slice(0,100)}).eq('id',msg.id);failed++}
 }
 await admin.from('audit_logs').insert({tenant_id:m.tenant_id,actor_user_id:user.id,action:'message.bulk_sent',entity_type:'class',entity_id:classId,metadata:{channel,sent,failed}})
 return NextResponse.json({ok:true,sent,failed,total:students.length})
}
