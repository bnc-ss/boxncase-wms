import { redirect } from 'next/navigation'
import { auth } from '@/src/lib/auth'
import { DashboardLayout } from '@/src/components/DashboardLayout'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <DashboardLayout
      userName={session.user.name || 'User'}
      userRole={session.user.role}
    >
      {children}
    </DashboardLayout>
  )
}
