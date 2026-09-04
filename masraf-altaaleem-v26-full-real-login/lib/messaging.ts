export type Channel = 'sms' | 'whatsapp'

export function normalizeSaudiPhone(input: string) {
  const digits = input.replace(/\D/g, '')
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`
  throw new Error('INVALID_PHONE')
}

export function maskPhone(phone: string) {
  return phone.length > 7 ? `${phone.slice(0,4)}••••${phone.slice(-3)}` : '••••••'
}

export async function sendTwilio(channel: Channel, to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('PROVIDER_NOT_CONFIGURED')

  const from = channel === 'whatsapp'
    ? process.env.TWILIO_WHATSAPP_FROM
    : process.env.TWILIO_SMS_FROM
  if (!from) throw new Error('SENDER_NOT_CONFIGURED')

  const params = new URLSearchParams({
    To: channel === 'whatsapp' ? `whatsapp:${to}` : to,
    From: channel === 'whatsapp' && !from.startsWith('whatsapp:') ? `whatsapp:${from}` : from,
    Body: body,
  })
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {'Authorization': `Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded'},
    body: params,
    cache: 'no-store',
  })
  const data = await r.json()
  if (!r.ok) throw new Error(`PROVIDER_${data.code || r.status}`)
  return { id: String(data.sid || '') }
}
