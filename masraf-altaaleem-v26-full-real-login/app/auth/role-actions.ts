'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type LoginState = { error: string }

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || '').trim().toLowerCase()
}

export async function roleLogin(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(formData.get('email'))
  const password = String(formData.get('password') || '')
  const rawKind = String(formData.get('kind') || '')
  const kind: 'teacher'|'admin'|'subscriber' = rawKind === 'admin' ? 'admin' : rawKind === 'subscriber' ? 'subscriber' : 'teacher'

  if (!email || !email.includes('@') || password.length < 10) {
    return { error: 'تحققي من البريد الإلكتروني وكلمة المرور.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { error: 'بيانات الدخول غير صحيحة.' }

  const { data: memberships, error: roleError } = await supabase
    .from('memberships')
    .select('role,tenant_id')
    .eq('user_id', data.user.id)

  if (roleError || !memberships?.length) {
    await supabase.auth.signOut()
    return { error: 'لا توجد مساحة أو صلاحية مرتبطة بهذا الحساب.' }
  }

  const roles = memberships.map((m: any) => String(m.role))
  const isAdmin = roles.some(role => role === 'tenant_owner' || role === 'admin')
  const isTeacher = roles.some(role => role === 'teacher' || role === 'tenant_owner' || role === 'admin')

  if (kind === 'admin' && !isAdmin) {
    await supabase.auth.signOut()
    return { error: 'هذا الحساب غير مخوّل لدخول بوابة الإدارة.' }
  }
  if (kind === 'teacher' && !isTeacher) {
    await supabase.auth.signOut()
    return { error: 'هذا الحساب غير مخوّل لدخول بوابة المعلمة.' }
  }

  if (kind === 'subscriber') redirect(isAdmin ? '/admin?flash=login' : '/dashboard?flash=login')
  redirect(kind === 'admin' ? '/admin?flash=login' : '/dashboard?flash=login')
}

export async function requestPasswordReset(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(formData.get('email'))
  if (!email || !email.includes('@')) return { error: 'أدخلي البريد الإلكتروني الصحيح.' }

  const h = await headers()
  const origin = process.env.NEXT_PUBLIC_APP_URL || h.get('origin') || ''
  if (!origin) return { error: 'تعذر تحديد رابط الموقع. أضيفي NEXT_PUBLIC_APP_URL في إعدادات الخادم.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin.replace(/\/$/, '')}/auth/confirm?next=/auth/update-password`,
  })
  if (error) return { error: 'تعذر إرسال رابط الاستعادة الآن. حاولي مرة أخرى.' }
  redirect('/auth/forgot?sent=1')
}

export async function updatePassword(_: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')
  if (password.length < 10) return { error: 'كلمة المرور الجديدة يجب ألا تقل عن 10 أحرف.' }
  if (password !== confirm) return { error: 'كلمتا المرور غير متطابقتين.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'رابط الاستعادة غير صالح أو انتهت صلاحيته.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'تعذر تحديث كلمة المرور. حاولي مرة أخرى.' }
  await supabase.auth.signOut()
  redirect('/?flash=password-updated')
}
