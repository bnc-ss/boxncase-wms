import { auth } from '@/src/lib/auth'
import { redirect } from 'next/navigation'
import { ReceiveStockForm } from '@/src/components/ReceiveStockForm'
import { getRecentReceives } from '../actions'

export default async function ReceiveStockPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const recentReceives = await getRecentReceives()

  return (
    <ReceiveStockForm
      userId={session.user.id}
      initialRecentReceives={recentReceives}
    />
  )
}
