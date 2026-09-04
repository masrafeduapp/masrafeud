import Link from 'next/link'
import StudentLoginForm from '@/components/StudentLoginForm'
export default async function StudentLogin({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const q=await searchParams
 return <main className="studentLoginPage" dir="rtl"><Link href="/" className="loginBack">رجوع إلى البوابة</Link><StudentLoginForm error={Boolean(q.error)} locked={Boolean(q.locked)}/></main>
}
