'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Tone='success'|'warning'|'error'|'info'
type Feedback={tone:Tone;title:string;message:string}

const presets:Record<string,Feedback>={
  saved:{tone:'success',title:'تم الحفظ بنجاح',message:'تم حفظ التغييرات وتحديث البيانات.'},
  'deposit-success':{tone:'success',title:'تم الإيداع بنجاح',message:'تمت إضافة الرصيد وتسجيل العملية في كشف الحساب.'},
  'withdraw-success':{tone:'success',title:'تم السحب بنجاح',message:'تم خصم الرصيد وتسجيل العملية في كشف الحساب.'},
  'transfer-success':{tone:'success',title:'تم التحويل بنجاح',message:'تم تنفيذ التحويل وتحديث الأرصدة بنجاح.'},
  'message-sent':{tone:'success',title:'تم إرسال الرسالة',message:'تم تسجيل الرسالة وإرسالها عبر القناة المحددة.'},
  'task-published':{tone:'success',title:'تم نشر المهمة',message:'تم حفظ المهمة وإتاحتها للفصل المحدد.'},
  'points-saved':{tone:'success',title:'تم تحديث النقاط',message:'تم حفظ النقاط الجديدة في سجل الطالب.'},
  'reward-saved':{tone:'success',title:'تم حفظ الجائزة',message:'تمت إضافة الجائزة إلى قسم التحفيز.'},
  'reward-redeemed':{tone:'success',title:'تم الاستبدال بنجاح',message:'تم تسجيل الجائزة وخصم النقاط المطلوبة.'},
  'evaluation-saved':{tone:'success',title:'تم حفظ التقييم',message:'تم تسجيل التقييم والملاحظة بنجاح.'},
  'student-added':{tone:'success',title:'تمت إضافة الطالب/ة',message:'تم إنشاء سجل الطالب/ة داخل الفصل.'},
  'class-added':{tone:'success',title:'تمت إضافة الفصل',message:'تم إنشاء الفصل بنجاح.'},
  'account-saved':{tone:'success',title:'تم حفظ حساب الطالب',message:'تم تحديث بيانات الدخول وإعدادات الحساب.'},
  'badge-saved':{tone:'success',title:'تم حفظ الشارة',message:'تمت إضافة الشارة إلى الإنجازات.'},
  'badge-awarded':{tone:'success',title:'تم منح الشارة',message:'ظهرت الشارة في إنجازات الطالب/ة.'},
  'files-saved':{tone:'success',title:'تم حفظ الملفات',message:'تم رفع الملفات وحفظها في مساحة المشترك الخاصة.'},
  'files-deleted':{tone:'success',title:'تم حذف الملفات',message:'تم حذف الملفات المحفوظة بنجاح.'},
  'data-cleared':{tone:'warning',title:'تم تفريغ البيانات',message:'تم مسح الحقول المحفوظة مع بقاء الحساب فعالًا.'},
  'followup-saved':{tone:'success',title:'تم حفظ المتابعة',message:'تم تحديث متابعة الطالب/ة والملاحظة.'},
  'attendance-saved':{tone:'success',title:'تم تسجيل الحضور',message:'تم حفظ حالة الحضور في سجل الطالب/ة.'},
  'settings-saved':{tone:'success',title:'تم حفظ الإعدادات',message:'تم تطبيق الإعدادات الجديدة.'},
  'invite-sent':{tone:'success',title:'تم إرسال الدعوة',message:'تم إنشاء دعوة المعلم/ة بنجاح.'},
  'invite-revoked':{tone:'warning',title:'تم إلغاء الدعوة',message:'تم إلغاء الدعوة المعلقة.'},
  cancelled:{tone:'warning',title:'تم الإلغاء',message:'لم يتم تنفيذ أي تغيير.'},
  login:{tone:'success',title:'تم تسجيل الدخول',message:'تم التحقق من الحساب والصلاحية وفتح المساحة الآمنة.'},
  logout:{tone:'info',title:'تم تسجيل الخروج',message:'تم إنهاء الجلسة بأمان.'},
  'password-updated':{tone:'success',title:'تم تحديث كلمة المرور',message:'تم حفظ كلمة المرور الجديدة. يمكنك تسجيل الدخول الآن.'},
  failed:{tone:'error',title:'تعذر تنفيذ العملية',message:'لم يتم حفظ التغيير. تحققي من البيانات وحاولي مرة أخرى.'},
  'insufficient-balance':{tone:'error',title:'الرصيد غير كافٍ',message:'تعذر تنفيذ السحب لأن الرصيد الحالي لا يكفي.'},
}

export function ActionFeedback(){
  const params=useSearchParams(); const router=useRouter(); const pathname=usePathname()
  const key=params.get('flash')||''
  const initial=useMemo(()=>presets[key]||null,[key])
  const [feedback,setFeedback]=useState<Feedback|null>(initial)

  useEffect(()=>{ setFeedback(initial) },[initial])
  useEffect(()=>{
    const handler=(event:Event)=>{
      const detail=(event as CustomEvent<Feedback>).detail
      if(detail?.title)setFeedback(detail)
    }
    window.addEventListener('masraf-feedback',handler)
    return()=>window.removeEventListener('masraf-feedback',handler)
  },[])
  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      const button=(event.target as HTMLElement|null)?.closest('button') as HTMLButtonElement|null
      if(!button)return
      const type=(button.getAttribute('type')||'submit').toLowerCase()
      if((type==='button'||type==='reset') && button.textContent?.trim().includes('إلغاء')) setFeedback(presets.cancelled)
    }
    document.addEventListener('click',onClick)
    return()=>document.removeEventListener('click',onClick)
  },[])
  useEffect(()=>{
    if(!feedback)return
    const t=window.setTimeout(()=>setFeedback(null),4600)
    return()=>window.clearTimeout(t)
  },[feedback])

  function close(){
    setFeedback(null)
    if(key){const next=new URLSearchParams(params.toString());next.delete('flash');const qs=next.toString();router.replace(qs?`${pathname}?${qs}`:pathname,{scroll:false})}
  }
  if(!feedback)return null
  const icon=feedback.tone==='success'?'✓':feedback.tone==='error'?'×':feedback.tone==='warning'?'!':'↪'
  return <div className="feedbackLayer" role="status" aria-live="polite">
    <div className={`feedbackCard ${feedback.tone}`}>
      <div className="feedbackGlow"/>
      <button type="button" className="feedbackClose" onClick={close} aria-label="إغلاق">×</button>
      <div className="feedbackIcon">{icon}</div>
      <div className="feedbackCopy"><small>مصرف التعليم</small><h3>{feedback.title}</h3><p>{feedback.message}</p></div>
      <div className="feedbackProgress"/>
    </div>
  </div>
}

export function showFeedback(tone:Tone,title:string,message:string){
  window.dispatchEvent(new CustomEvent('masraf-feedback',{detail:{tone,title,message}}))
}
