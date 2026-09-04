'use client'
import { FormEvent, useMemo, useState } from 'react'

export default function FollowupReadyMessages({classes}:{classes:{id:string,name:string}[]}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[classId,setClassId]=useState(''),[channel,setChannel]=useState('whatsapp')
 const selected=useMemo(()=>classes.find(c=>c.id===classId)?.name||'الفصل المحدد',[classes,classId])
 const message=`السلام عليكم، نود إشعاركم بوجود تحديث جديد في متابعة الطالب/ة ضمن ${selected}. نرجو الاطلاع على المهام والمتابعة، وشكرًا لتعاونكم.`
 async function submit(e:FormEvent){e.preventDefault();if(!classId)return;setBusy(true);setNotice('')
  try{const r=await fetch('/api/messages/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({classId,channel,body:message})});const d=await r.json();if(r.ok)setNotice(`تم الإرسال إلى ${d.sent} ولي أمر${d.failed?`، وتعذر ${d.failed}`:''}.`);else setNotice(({NO_ELIGIBLE_RECIPIENTS:'لا يوجد أولياء أمور لديهم رقم وموافقة اتصال في هذا الفصل.',PROVIDER_NOT_CONFIGURED:'مزود الرسائل غير مربوط بعد.',SENDER_NOT_CONFIGURED:'معرّف المرسل غير مهيأ.'} as any)[d.error]||'تعذر إرسال الرسائل.')}catch{setNotice('تعذر الاتصال بخدمة الإرسال.')}finally{setBusy(false)}
 }
 return <form className="followReadyCard" onSubmit={submit}>
  <div className="followCardTitle"><span>✉</span><div><h2>رسائل أولياء الأمور الجاهزة</h2><p>رسالة متابعة جاهزة تُرسل فقط لمن لديهم موافقة تواصل مسجلة.</p></div></div>
  <label className="field"><span>الصف / الفصل</span><select value={classId} onChange={e=>setClassId(e.target.value)} required><option value="">كل الفصول</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <label className="field"><span>قناة الإرسال</span><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="whatsapp">واتساب</option><option value="sms">رسالة نصية SMS</option></select></label>
  <button className="followGreenBtn" disabled={busy||!classId}>{busy?'جارٍ الإرسال…':'إرسال جميع الرسائل دفعة واحدة'}</button>
  <div className="followMessagePreview">{message}</div>{notice&&<div className="notice" role="status">{notice}</div>}
 </form>
}
