'use client'
import Link from 'next/link'
import { useState } from 'react'

type Cycle='monthly'|'term'|'yearly'
const pricing={
 monthly:{label:'شهري',subtitle:'توفير شهري مع مرونة في التجديد أو الإيقاف',one:[39,49],three:[79,99],multi:[129,159],period:'شهريًا'},
 term:{label:'ترم',subtitle:'توفير أكبر من الشهري عند دفع الترم كاملًا',one:[169,195],three:[339,395],multi:[549,645],period:'للترم الدراسي كاملًا'},
 yearly:{label:'سنوي',subtitle:'أعلى نسبة توفير وأفضل قيمة للاستخدام طوال السنة',one:[329,468],three: [649,948],multi:[1049,1548],period:'للسنة كاملة'}
} as const
const plans=[
 {key:'one',icon:'📘',title:'فصل واحد',desc:'للمعلمة التي تدير فصلًا واحدًا.',features:['إدارة فصل واحد بالكامل','الطلاب وحساباتهم','النقاط والمكافآت','المتابعة والمهام والغياب','التواصل مع أولياء الأمور','التقارير ومركز البيانات'],featured:false},
 {key:'three',icon:'📚',title:'3 فصول',desc:'لإدارة عدة فصول من حساب واحد.',features:['حتى 3 فصول','كل أدوات باقة الفصل الواحد','تقارير مجمعة للفصول','رسائل جماعية حسب الفصل','متابعة أسرع','أرشفة ونسخ احتياطية'],featured:true},
 {key:'multi',icon:'🏫',title:'أكثر من 3 فصول',desc:'للاستخدام الأوسع والمدارس.',features:['أكثر من 3 فصول','عدد أكبر من الطلاب','صلاحيات متعددة','تقارير موسعة','لوحة متابعة شاملة','أولوية في الدعم'],featured:false}
] as const
export default function PricingPlans(){
 const [cycle,setCycle]=useState<Cycle>('monthly'); const p=pricing[cycle]
 return <div className="realPricing">
  <div className="billingSwitch realBilling">{(['monthly','term','yearly'] as Cycle[]).map(c=><button key={c} onClick={()=>setCycle(c)} className={cycle===c?'active':''}>{pricing[c].label}{c==='term'&&<small>توفير متوسط</small>}{c==='yearly'&&<small>أعلى توفير</small>}</button>)}</div>
  <div className="cycleHeader"><strong>الاشتراك {p.label}</strong><span>{p.subtitle}</span></div>
  <div className="priceCards">{plans.map(plan=>{
   const tuple=p[plan.key]; const price=tuple[0],old=tuple[1]; const save=Math.round((1-price/old)*100)
   return <article key={plan.key} className={`priceCard ${plan.featured?'featured':''}`}>{plan.featured&&<span className="mostPopular">الأكثر اختيارًا</span>}<div className="planIcon">{plan.icon}</div><h3 className="planTitle">{plan.title}</h3><p className="planSub">{plan.desc}</p><div className="priceZone"><div className="priceLine"><b className="priceValue">{price}</b><span className="currency">ر.س</span><span className="oldPrice">{old} ر.س</span></div><div className="period">{p.period}</div><span className="saving">توفير {save}٪</span></div><ul className="planDetails">{plan.features.map(f=><li key={f}>{f}</li>)}</ul><Link className="subscribeBtn" href={`/auth/register?plan=teacher&classes=${plan.key}&cycle=${cycle}`}>اختيار الباقة</Link></article>
  })}</div>
  <div className="tamaraBox"><div className="tamaraBrand"><div className="tamaraLogo">تمارا</div><div className="tamaraCopy"><b>خيار تمارا جاهز للربط</b><span>سيظهر الدفع والتقسيط الحقيقي بعد تفعيل حساب التاجر وربط API تمارا. لا يوجد تحصيل وهمي داخل الموقع.</span></div></div><div className="tamaraBadge">التقسيط حسب أهلية تمارا</div></div>
 </div>
}
