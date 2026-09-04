import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clearDataCenterProfile, deleteDataCenterFiles, saveDataCenterProfile, uploadDataCenterFiles } from './actions'

const FILE_LABELS:Record<string,string>={school_logo:'شعار المدرسة',teacher_signature:'توقيع المعلمة',ministry_logo:'شعار الوزارة'}
const RANKS=['معلمة','معلمة/خبير','معلمة متقدمة','معلمة ممارس','وكيلة','مديرة']
const SUBJECTS=['رياضيات ابتدائي','رياضيات متوسط','رياضيات ثانوي','علوم','لغة عربية','لغة إنجليزية','دراسات إسلامية','دراسات اجتماعية','أخرى']

export default async function DataPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login')
 const {data:m}=await supabase.from('memberships').select('tenant_id,role,tenants(name)').eq('user_id',user.id).maybeSingle();if(!m)redirect('/dashboard')
 const [{data:profile},{data:files}]=await Promise.all([
   supabase.from('data_center_profiles').select('*').eq('tenant_id',m.tenant_id).maybeSingle(),
   supabase.from('data_center_files').select('kind,storage_path,original_name,mime_type,size_bytes,created_at').eq('tenant_id',m.tenant_id)
 ])
 const canManage=['tenant_owner','admin'].includes(m.role)
 const fileMap=new Map((files||[]).map((f:any)=>[f.kind,f]))
 const signed:Record<string,string>={}
 if(files?.length){
   try{
     const admin=createAdminClient()
     await Promise.all(files.map(async(f:any)=>{const {data}=await admin.storage.from('data-center').createSignedUrl(f.storage_path,300);if(data?.signedUrl)signed[f.kind]=data.signedUrl}))
   }catch{}
 }
 const extra=(profile?.additional_subjects||[]) as string[]
 return <DashboardShell active="/data" tenant={(m.tenants as any)?.name||'مساحتي'}>
  <div className="dataCenterPage">
   <div className="dataCenterHero"><div><span>مركز بيانات المشترك</span><h1>البيانات والملفات التخزينية</h1><p>بيانات الهوية التعليمية والمرفقات المستخدمة في التقارير والشهادات داخل مساحة المشترك فقط.</p></div><div className="dataHeroIcon">▣</div></div>
   {!canManage&&<div className="notice">يمكنك مشاهدة البيانات، أما التعديل ورفع الملفات فهو متاح لمالك الحساب أو المدير.</div>}
   <div className="dataCenterGrid">
    <section className="dataPanel profilePanel">
     <div className="dataPanelHead"><div><h2>بيانات وملفات تخزينية</h2><p>هذه البيانات تُستخدم في ملفات PDF والتقارير والشهادات.</p></div><span>بيانات أساسية</span></div>
     <form action={saveDataCenterProfile} className="dataForm">
      <label className="dataField full"><b>اسم المعلمة</b><input name="teacher_name" defaultValue={profile?.teacher_name||''} placeholder="اسم المعلمة" disabled={!canManage}/></label>
      <label className="dataField full"><b>اسم المديرة</b><input name="manager_name" defaultValue={profile?.manager_name||''} placeholder="اسم المديرة" disabled={!canManage}/></label>
      <label className="dataField full"><b>اسم المدرسة</b><input name="school_name" defaultValue={profile?.school_name||''} placeholder="اسم المدرسة" disabled={!canManage}/></label>
      <label className="dataField"><b>الرتبة</b><select name="teacher_rank" defaultValue={profile?.teacher_rank||''} disabled={!canManage}><option value="">اختاري الرتبة</option>{RANKS.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="dataField"><b>اسم المادة</b><select name="primary_subject" defaultValue={profile?.primary_subject||''} disabled={!canManage}><option value="">اختاري المادة</option>{SUBJECTS.map(x=><option key={x}>{x}</option>)}</select></label>
      {Array.from({length:6},(_,i)=><label className="dataField" key={i}><b>إضافة مادة أخرى {i+1}</b><select name={`additional_subject_${i+1}`} defaultValue={extra[i]||''} disabled={!canManage}><option value="">بدون</option>{SUBJECTS.map(x=><option key={x}>{x}</option>)}</select></label>)}
      <label className="dataField"><b>العام الميلادي</b><input type="number" min="2000" max="2200" name="gregorian_year" defaultValue={profile?.gregorian_year||''} placeholder="2026" disabled={!canManage}/></label>
      <label className="dataField"><b>العام الهجري</b><input name="hijri_year" defaultValue={profile?.hijri_year||''} placeholder="1448هـ" disabled={!canManage}/></label>
      {canManage&&<div className="dataActions full"><button className="dataPrimary">حفظ البيانات</button><button type="submit" formAction={clearDataCenterProfile} className="dataLight">تفريغ البيانات</button></div>}
     </form>
     <div className="dataNote">تم ترتيب القسم ليكون واضحًا ومهيأً للربط مع التقارير والشهادات دون خلط بيانات المشتركين.</div>
    </section>

    <section className="dataPanel uploadPanel">
     <div className="dataPanelHead"><div><h2>رفع البيانات</h2><p>مرفقات محفوظة للاستخدام في التقارير وملفات PDF.</p></div><span>ملفات خاصة</span></div>
     <form action={uploadDataCenterFiles} className="uploadForm">
      {(['school_logo','teacher_signature','ministry_logo'] as const).map(kind=>{const f:any=fileMap.get(kind);return <div className="uploadBlock" key={kind}><b>{FILE_LABELS[kind]}</b><label className="filePicker"><input type="file" name={kind} accept="image/png,image/jpeg,image/webp,application/pdf" disabled={!canManage}/><span>اختيار ملف</span><em>{f?.original_name||'لم يتم تحديد أي ملف'}</em></label><div className="savedFile">{f?<><span>تم حفظ الملف</span>{signed[kind]&&<a href={signed[kind]} target="_blank" rel="noreferrer">عرض الملف</a>}</>:<span>لم يتم حفظ ملف بعد</span>}</div></div>})}
      {canManage&&<div className="dataActions"><button className="dataPrimary">حفظ الملفات</button><button type="submit" formAction={deleteDataCenterFiles} className="dataLight dangerOutline">حذف الملفات</button></div>}
     </form>
     <p className="uploadSecurity">الملفات خاصة وغير عامة، والحد الأقصى 8MB للملف. الصيغ المسموحة: PNG وJPG وWebP وPDF.</p>
    </section>
   </div>
  </div>
 </DashboardShell>
}
