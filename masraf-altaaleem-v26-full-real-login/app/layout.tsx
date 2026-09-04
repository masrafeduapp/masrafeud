import './globals.css'
import { Suspense } from 'react'
import { ActionFeedback } from '@/components/ActionFeedback'

export const metadata = {
  title: 'مصرف التعليم',
  description: 'منصة تعليمية تجارية آمنة باشتراك شهري',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><Suspense fallback={null}><ActionFeedback/></Suspense>{children}</body>
    </html>
  )
}
