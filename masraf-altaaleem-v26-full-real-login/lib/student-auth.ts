import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME='masraf_student_session'
const SESSION_SECONDS=60*60*12

function secret(){
  const value=process.env.STUDENT_SESSION_SECRET
  if(!value || value.length<32) throw new Error('STUDENT_SESSION_SECRET must be at least 32 characters')
  return value
}
function b64url(input:Buffer|string){return Buffer.from(input).toString('base64url')}
function sign(payload:string){return crypto.createHmac('sha256',secret()).update(payload).digest('base64url')}
export function hashStudentPassword(password:string){
  const salt=crypto.randomBytes(16)
  const derived=crypto.scryptSync(password,salt,64)
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}
export function verifyStudentPassword(password:string,stored:string){
  const [kind,salt64,hash64]=stored.split('$')
  if(kind!=='scrypt'||!salt64||!hash64)return false
  const expected=Buffer.from(hash64,'base64url')
  const actual=crypto.scryptSync(password,Buffer.from(salt64,'base64url'),expected.length)
  return expected.length===actual.length && crypto.timingSafeEqual(expected,actual)
}
export async function setStudentSession(accountId:string){
  const exp=Math.floor(Date.now()/1000)+SESSION_SECONDS
  const payload=b64url(JSON.stringify({aid:accountId,exp}))
  const token=`${payload}.${sign(payload)}`
  const jar=await cookies()
  jar.set(COOKIE_NAME,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:SESSION_SECONDS})
}
export async function clearStudentSession(){const jar=await cookies();jar.delete(COOKIE_NAME)}
export async function getStudentSessionAccountId(){
  const jar=await cookies(); const token=jar.get(COOKIE_NAME)?.value
  if(!token)return null
  const [payload,sig]=token.split('.')
  if(!payload||!sig)return null
  const expected=sign(payload)
  if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); if(!data.aid||Number(data.exp)<Math.floor(Date.now()/1000))return null; return String(data.aid)}catch{return null}
}
