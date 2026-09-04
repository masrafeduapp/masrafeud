import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStudentSessionAccountId } from '@/lib/student-auth'

function csvCell(v:unknown){const s=String(v??'');return `"${s.replaceAll('"','""')}"`}
export async function GET(){
 const aid=await getStudentSessionAccountId();if(!aid)return NextResponse.json({error:'unauthorized'},{status:401})
 const admin=createAdminClient();const {data:a}=await admin.from('student_portal_accounts').select('tenant_id,student_id,active').eq('id',aid).maybeSingle();if(!a?.active)return NextResponse.json({error:'unauthorized'},{status:401})
 const [{data:student},{data:metric},{data:ops},{data:points},{data:attendance},{data:evals}]=await Promise.all([
  admin.from('students').select('full_name,classes(name)').eq('tenant_id',a.tenant_id).eq('id',a.student_id).maybeSingle(),
  admin.from('student_metrics').select('balance,points').eq('tenant_id',a.tenant_id).eq('student_id',a.student_id).maybeSingle(),
  admin.from('student_operations').select('created_at,operation_type,amount,reason').eq('tenant_id',a.tenant_id).eq('student_id',a.student_id).order('created_at',{ascending:false}),
  admin.from('point_transactions').select('created_at,delta,reason').eq('tenant_id',a.tenant_id).eq('student_id',a.student_id).order('created_at',{ascending:false}),
  admin.from('attendance_records').select('attendance_date,status,note').eq('tenant_id',a.tenant_id).eq('student_id',a.student_id).order('attendance_date',{ascending:false}),
  admin.from('student_evaluations').select('evaluation_date,category,score,note').eq('tenant_id',a.tenant_id).eq('student_id',a.student_id).order('evaluation_date',{ascending:false})
 ])
 if(!student)return NextResponse.json({error:'not found'},{status:404})
 const rows:string[][]=[]
 rows.push(['تقرير الطالب','القيمة'],['الاسم',student.full_name],['الفصل',(student.classes as any)?.name||''],['الرصيد التعليمي',String(metric?.balance||0)],['النقاط',String(metric?.points||0)],[])
 rows.push(['العمليات','التاريخ','النوع','المبلغ','السبب']);for(const x of ops||[])rows.push(['عملية',x.created_at,x.operation_type,String(x.amount),x.reason]);rows.push([])
 rows.push(['النقاط','التاريخ','التغيير','السبب']);for(const x of points||[])rows.push(['نقاط',x.created_at,String(x.delta),x.reason]);rows.push([])
 rows.push(['الحضور','التاريخ','الحالة','الملاحظة']);for(const x of attendance||[])rows.push(['حضور',x.attendance_date,x.status,x.note||'']);rows.push([])
 rows.push(['التقييمات','التاريخ','المجال','الدرجة','الملاحظة']);for(const x of evals||[])rows.push(['تقييم',x.evaluation_date,x.category,String(x.score),x.note||''])
 const body='\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')
 return new NextResponse(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="student-report.csv"','Cache-Control':'no-store'}})
}
