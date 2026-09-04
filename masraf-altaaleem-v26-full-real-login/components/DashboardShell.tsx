'use client'
import Link from 'next/link'
import { ReactNode, useState } from 'react'
import { logoutTeacher } from '@/app/auth/actions'

const groups:{label:string;items:[string,string][]}[]=[
 {label:'صفحة المعلم',items:[['/dashboard','الرئيسية'],['/advanced','لوحة التحكم المتقدمة'],['/students','الفصول والطلاب'],['/operations','العمليات'],['/points','النقاط'],['/rewards','الجوائز والتحفيز'],['/achievements','الإنجازات والشارات'],['/data','البيانات والملفات'],['/followup','المتابعة'],['/messages','التواصل'],['/backup','نسخة احتياطية'],['/evaluation-settings','إعدادات التقييم والإشراف'],['/evaluations','التقييم والإشراف المدرسي'],['/honor','لوحة الشرف'],['/student-settings','إعدادات لوحة الطالب']]},
 {label:'الإدارة',items:[['/classes','الفصول'],['/teachers','المعلمين'],['/reports','التقارير']]},
 {label:'الاشتراك',items:[['/subscription','الاشتراك والفوترة']]}
]
export default function DashboardShell({children,active,tenant='مصرف التعليم'}:{children:ReactNode;active:string;tenant?:string}){
 const [open,setOpen]=useState(false)
 return <div className="bankApp">
  <aside className={`bankSide ${open?'open':''}`}>
   <button className="mobileClose" type="button" onClick={()=>setOpen(false)} aria-label="إغلاق القائمة">✕</button>
   <div className="bankBrand"><span className="bankMark">م</span><div><b>مصرف التعليم</b><small>EDUCATION BANK</small></div></div>
   {groups.map(group=><div key={group.label}><p className="sideLabel">{group.label}</p><nav className="bankMenu">{group.items.map(([href,label])=><Link key={href} className={active===href?'active':''} href={href} onClick={()=>setOpen(false)}><i/> {label}</Link>)}</nav></div>)}
   <div className="sideSupport"><b>الدعم</b><span>مركز المساعدة وسجل العمليات الأمنية للحساب.</span></div>
   <form action={logoutTeacher} className="sideLogoutForm"><button className="sideLogout" type="submit">↪ تسجيل الخروج</button></form>
  </aside>
  {open&&<button className="bankOverlay" aria-label="إغلاق القائمة" onClick={()=>setOpen(false)}/>} 
  <main className="bankMain"><header className="bankTop"><button className="mobileMenu" type="button" onClick={()=>setOpen(true)} aria-label="فتح القائمة">☰</button><div><b>لوحة المشترك</b><small>{tenant}</small></div><div className="avatar">م</div></header>{children}</main>
 </div>
}
