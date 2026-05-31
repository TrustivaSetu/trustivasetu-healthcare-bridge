import { getRequestSession } from '@/lib/api-auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await getRequestSession()
  if (session) redirect('/dashboard')
  redirect('/lms/login')
}
