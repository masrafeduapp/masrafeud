import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { maskPhone, normalizeSaudiPhone, sendTwilio, type Channel } from '@/lib/messaging'

const allowedChannels = new Set(['sms','whatsapp'])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({error:'UNAUTHORIZED'}, {status:401})

  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({error:'INVALID_JSON'}, {status:400}) }
  const studentId = String(payload.studentId || '')
  const channel = String(payload.channel || '') as Channel
  const body = String(payload.body || '').trim()
  if (!studentId || !allowedChannels.has(channel) || body.length < 1 || body.length > 1200)
    return NextResponse.json({error:'INVALID_INPUT'}, {status:400})

  const { data: membership } = await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle()
  if (!membership) return NextResponse.json({error:'NO_TENANT'}, {status:403})

  const { data: student } = await supabase.from('students')
    .select('id,tenant_id,guardian_phone,guardian_consent,full_name')
    .eq('id',studentId).eq('tenant_id',membership.tenant_id).maybeSingle()
  if (!student) return NextResponse.json({error:'STUDENT_NOT_FOUND'}, {status:404})
  if (!student.guardian_consent) return NextResponse.json({error:'CONSENT_REQUIRED'}, {status:403})
  if (!student.guardian_phone) return NextResponse.json({error:'PHONE_REQUIRED'}, {status:400})

  let phone: string
  try { phone = normalizeSaudiPhone(student.guardian_phone) }
  catch { return NextResponse.json({error:'INVALID_PHONE'}, {status:400}) }

  const { data: message, error: insertError } = await supabase.from('outbound_messages').insert({
    tenant_id: membership.tenant_id, student_id: student.id, actor_user_id: user.id,
    channel, recipient_phone_masked: maskPhone(phone), body, status:'queued'
  }).select('id').single()
  if (insertError || !message) return NextResponse.json({error:'LOG_CREATE_FAILED'}, {status:500})

  try {
    const admin = createAdminClient()
    const result = await sendTwilio(channel, phone, body)
    await admin.from('outbound_messages').update({status:'sent',provider_message_id:result.id,sent_at:new Date().toISOString(),error_code:null}).eq('id',message.id)
    await admin.from('audit_logs').insert({tenant_id:membership.tenant_id,actor_user_id:user.id,action:'message.sent',entity_type:'student',entity_id:student.id,metadata:{channel,message_id:message.id}})
    return NextResponse.json({ok:true,messageId:message.id})
  } catch (e:any) {
    const code = String(e?.message || 'SEND_FAILED').slice(0,100)
    try { const admin=createAdminClient(); await admin.from('outbound_messages').update({status:'failed',error_code:code}).eq('id',message.id) } catch {}
    return NextResponse.json({error:code,messageId:message.id}, {status:502})
  }
}
