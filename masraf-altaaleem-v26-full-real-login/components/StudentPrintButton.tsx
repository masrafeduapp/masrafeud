'use client'
export default function StudentPrintButton(){return <button type="button" className="studentQuickButton" onClick={()=>window.print()}><span>📄</span><b>تقرير الطالب/ة</b><small>طباعة أو حفظ PDF</small></button>}
