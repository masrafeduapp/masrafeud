import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PricingPlans from '@/components/PricingPlans'

export default async function Subscription({searchParams}:{searchParams:Promise<{blocked?:string}>}){
 const {blocked}=await searchParams
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
 let current:null|{status:string;plan_code:string;current_period_end:string|null}=null
 if(user){const {data:rows}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).limit(1);const m=rows?.[0];if(m){const {data:s}=await supabase.from('subscriptions').select('status,plan_code,current_period_end').eq('tenant_id',m.tenant_id).maybeSingle();current=s}}
 return <main className="subscriptionPage" dir="rtl"><header className="subscriptionTop"><Link className="bankBrand" href="/"><span>م</span><div><b>مصرف التعليم</b><small>EDUCATION BANK</small></div></Link>{user?<Link className="outlineLink" href="/dashboard">لوحة التحكم</Link>:<Link className="outlineLink" href="/">بوابة الدخول</Link>}</header><section className="subscriptionHero"><span>خطط مرنة حسب احتياجك</span><h1>اختاري اشتراك مصرف التعليم المناسب</h1><p>من فصل واحد إلى عدة فصول، شهريًا أو للترم أو سنويًا.</p></section><section className="subscriptionBody">
 {blocked&&<div className="notice"><b>الحساب غير متاح حاليًا.</b> حالة الاشتراك: {blocked}</div>}
 {current&&<div className="currentPlan"><b>اشتراكك الحالي</b><span>الباقة: {current.plan_code} · الحالة: {current.status}</span></div>}
 <PricingPlans/>
 <p className="paymentTruth">اختيار الباقة يعمل الآن، أما التحصيل المالي الحقيقي فسيبقى متوقفًا حتى ربط بوابة دفع معتمدة وتمارا بحساب تاجر فعلي.</p>
 </section></main>
}
