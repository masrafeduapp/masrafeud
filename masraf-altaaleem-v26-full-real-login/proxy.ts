import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes=['/dashboard','/admin','/advanced','/students','/classes','/teachers','/operations','/points','/rewards','/achievements','/data','/followup','/messages','/backup','/evaluation-settings','/evaluations','/honor','/student-settings','/reports','/owner']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const {data:{user}}=await supabase.auth.getUser()
  const path=request.nextUrl.pathname
  const needsAuth=protectedPrefixes.some(prefix=>path===prefix || path.startsWith(prefix+'/'))

  if(needsAuth && !user){
    const target=request.nextUrl.clone()
    target.pathname='/'
    target.search=''
    target.searchParams.set('login','required')
    return NextResponse.redirect(target)
  }

  if(user && path.startsWith('/admin')){
    const {data:memberships}=await supabase.from('memberships').select('role').eq('user_id',user.id)
    const admin=memberships?.some((m:any)=>m.role==='tenant_owner'||m.role==='admin')
    if(!admin){const target=request.nextUrl.clone();target.pathname='/dashboard';target.search='';target.searchParams.set('flash','failed');return NextResponse.redirect(target)}
  }

  if(user && needsAuth){
    const {data:memberships}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).limit(1)
    const membership=memberships?.[0]
    if(membership?.tenant_id){
      const {data:subscription}=await supabase.from('subscriptions').select('status').eq('tenant_id',membership.tenant_id).maybeSingle()
      if(subscription && ['suspended','expired','canceled'].includes(subscription.status) && path!=='/subscription'){
        const target=request.nextUrl.clone()
        target.pathname='/subscription'
        target.search=''
        target.searchParams.set('blocked',subscription.status)
        return NextResponse.redirect(target)
      }
    }
  }
  response.headers.set('X-Content-Type-Options','nosniff')
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()')
  response.headers.set('X-Frame-Options','DENY')
  response.headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
  return response
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']}
