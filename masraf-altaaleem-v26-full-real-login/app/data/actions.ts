'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FILE_KINDS = ['school_logo','teacher_signature','ministry_logo'] as const
type FileKind = (typeof FILE_KINDS)[number]
const ALLOWED_MIME = new Set(['image/png','image/jpeg','image/webp','application/pdf'])
const MAX_FILE_BYTES = 8 * 1024 * 1024

async function getAdminMembership(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) return null
  const {data:membership}=await supabase.from('memberships').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  if(!membership || !['tenant_owner','admin'].includes(membership.role)) return null
  return {supabase,user,membership}
}

function clean(value:FormDataEntryValue|null,max=160){
  return String(value||'').trim().slice(0,max)
}

export async function saveDataCenterProfile(formData:FormData){
  const ctx=await getAdminMembership(); if(!ctx)return
  const yearRaw=Number.parseInt(clean(formData.get('gregorian_year'),4),10)
  const gregorian_year=Number.isFinite(yearRaw)&&yearRaw>=2000&&yearRaw<=2200?yearRaw:null
  const additional_subjects=Array.from({length:6},(_,i)=>clean(formData.get(`additional_subject_${i+1}`),100)).filter(Boolean)
  const {error}=await ctx.supabase.from('data_center_profiles').upsert({
    tenant_id:ctx.membership.tenant_id,
    teacher_name:clean(formData.get('teacher_name')),
    manager_name:clean(formData.get('manager_name')),
    school_name:clean(formData.get('school_name')),
    teacher_rank:clean(formData.get('teacher_rank'),80),
    primary_subject:clean(formData.get('primary_subject'),100),
    additional_subjects,
    gregorian_year,
    hijri_year:clean(formData.get('hijri_year'),20),
    updated_by:ctx.user.id,
    updated_at:new Date().toISOString()
  },{onConflict:'tenant_id'})
  if(error)redirect('/data?flash=failed')
  revalidatePath('/data');redirect('/data?flash=saved')
}

export async function clearDataCenterProfile(){
  const ctx=await getAdminMembership(); if(!ctx)return
  const {error}=await ctx.supabase.from('data_center_profiles').upsert({
    tenant_id:ctx.membership.tenant_id,
    teacher_name:'',manager_name:'',school_name:'',teacher_rank:'',primary_subject:'',additional_subjects:[],gregorian_year:null,hijri_year:'',updated_by:ctx.user.id,updated_at:new Date().toISOString()
  },{onConflict:'tenant_id'})
  if(error)redirect('/data?flash=failed')
  revalidatePath('/data');redirect('/data?flash=data-cleared')
}

function extensionFor(file:File){
  const byMime:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'}
  return byMime[file.type]||'bin'
}

export async function uploadDataCenterFiles(formData:FormData){
  const ctx=await getAdminMembership(); if(!ctx)return
  const admin=createAdminClient()
  let saved=0
  for(const kind of FILE_KINDS){
    const entry=formData.get(kind)
    if(!(entry instanceof File)||entry.size===0)continue
    if(entry.size>MAX_FILE_BYTES||!ALLOWED_MIME.has(entry.type))continue
    const path=`${ctx.membership.tenant_id}/${kind}/${Date.now()}-${randomUUID()}.${extensionFor(entry)}`
    const bytes=new Uint8Array(await entry.arrayBuffer())
    const {error:uploadError}=await admin.storage.from('data-center').upload(path,bytes,{contentType:entry.type,upsert:false})
    if(uploadError)continue
    const {data:old}=await admin.from('data_center_files').select('storage_path').eq('tenant_id',ctx.membership.tenant_id).eq('kind',kind).maybeSingle()
    const {error:dbError}=await admin.from('data_center_files').upsert({
      tenant_id:ctx.membership.tenant_id,kind,storage_path:path,original_name:entry.name.slice(0,220),mime_type:entry.type,size_bytes:entry.size,uploaded_by:ctx.user.id
    },{onConflict:'tenant_id,kind'})
    if(dbError){await admin.storage.from('data-center').remove([path]);continue}
    if(old?.storage_path&&old.storage_path!==path)await admin.storage.from('data-center').remove([old.storage_path])
    saved++
  }
  revalidatePath('/data');redirect(`/data?flash=${saved?'files-saved':'failed'}`)
}

export async function deleteDataCenterFiles(){
  const ctx=await getAdminMembership(); if(!ctx)return
  const admin=createAdminClient()
  const {data:rows}=await admin.from('data_center_files').select('storage_path').eq('tenant_id',ctx.membership.tenant_id)
  const paths=(rows||[]).map((x:{storage_path:string})=>x.storage_path)
  if(paths.length)await admin.storage.from('data-center').remove(paths)
  const {error}=await admin.from('data_center_files').delete().eq('tenant_id',ctx.membership.tenant_id)
  if(error)redirect('/data?flash=failed')
  revalidatePath('/data');redirect('/data?flash=files-deleted')
}
