'use client'
import { FormEvent, useState } from 'react'

type Student={id:string;full_name:string;guardian_name:string|null;guardian_phone:string|null;guardian_consent:boolean}
export default function MessageComposer({students}:{students:Student[]}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice('')
  const f=new FormData(e.currentTarget); const payload={studentId:f.get('studentId'),channel:f.get('channel'),body:f.get('body')}
  try{const r=await fetch('/api/messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();
   if(r.ok)setNotice('تم إرسال الرسالة وتسجيلها بنجاح.')
   else setNotice(({CONSENT_REQUIRED:'لا توجد موافقة اتصال مسجلة لولي الأمر.',PHONE_REQUIRED:'رقم ولي الأمر غير موجود.',INVALID_PHONE:'رقم الجوال غير صحيح.',PROVIDER_NOT_CONFIGURED:'مزود الرسائل غير مربوط بعد.',SENDER_NOT_CONFIGURED:'معرّف المرسل غير مهيأ.'} as Record<string,string>)[d.error]||'تعذر الإرسال. راجعي حالة مزود الرسائل.')
  }catch{setNotice('تعذر الاتصال بخدمة الإرسال.')} finally{setBusy(false)}
 }
 return <form className="card composer" onSubmit={submit}>
  <h2>رسالة جديدة</h2><p className="muted">لن يسمح النظام بالإرسال إلا لولي أمر تابع لطلاب مساحتك ولديه موافقة اتصال.</p>
  <label className="field"><span>الطالب / ولي الأمر</span><select name="studentId" required defaultValue=""><option value="" disabled>اختاري الطالب</option>{students.map(s=><option key={s.id} value={s.id} disabled={!s.guardian_phone||!s.guardian_consent}>{s.full_name} — {s.guardian_name||'ولي الأمر'}{!s.guardian_consent?' (لا توجد موافقة)':''}</option>)}</select></label>
  <label className="field"><span>طريقة الإرسال</span><select name="channel" defaultValue="whatsapp"><option value="whatsapp">واتساب</option><option value="sms">رسالة نصية SMS</option></select></label>
  <label className="field"><span>نص الرسالة</span><textarea name="body" required maxLength={1200} rows={6} placeholder="اكتبي الرسالة لولي الأمر…" /></label>
  <button className="btn btn-primary" disabled={busy||students.length===0}>{busy?'جارٍ الإرسال…':'إرسال الرسالة'}</button>
  {notice&&<div className="notice" role="status">{notice}</div>}
 </form>
}
