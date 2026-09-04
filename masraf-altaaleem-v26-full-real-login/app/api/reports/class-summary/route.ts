import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvCell(v:string|number){ const s=String(v).replaceAll('"','""'); return `"${s}"` }
export async function GET(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return new NextResponse('Unauthorized',{status:401})
 const {data:m}=await supabase.from('memberships').select('tenant_id').eq('user_id',user.id).maybeSingle(); if(!m)return new NextResponse('Forbidden',{status:403})
 const [{data:classes},{data:students},{data:attendance},{data:tasks},{data:subs}]=await Promise.all([supabase.from('classes').select('id,name').eq('tenant_id',m.tenant_id),supabase.from('students').select('id,class_id').eq('tenant_id',m.tenant_id),supabase.from('attendance_records').select('class_id,status').eq('tenant_id',m.tenant_id),supabase.from('tasks').select('id,class_id').eq('tenant_id',m.tenant_id),supabase.from('task_submissions').select('task_id,student_id,status').eq('tenant_id',m.tenant_id)])
 const lines=[["الفصل","الطلاب","الغياب","التأخر","المهام المسلمة","غير المسلمة"]]
 for(const c of classes||[]){ const sids=new Set((students||[]).filter((s:any)=>s.class_id===c.id).map((s:any)=>s.id)); const tids=new Set((tasks||[]).filter((t:any)=>t.class_id===c.id).map((t:any)=>t.id)); const a=(attendance||[]).filter((x:any)=>x.class_id===c.id); const ss=(subs||[]).filter((x:any)=>tids.has(x.task_id)&&sids.has(x.student_id)); lines.push([c.name,sids.size,a.filter((x:any)=>x.status==='absent').length,a.filter((x:any)=>x.status==='late').length,ss.filter((x:any)=>x.status==='submitted').length,ss.filter((x:any)=>x.status==='missing').length] as any) }
 const csv='\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n'); return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="class-summary.csv"','Cache-Control':'no-store'}})
}
