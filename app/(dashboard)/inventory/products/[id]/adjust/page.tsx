import { notFound, redirect } from 'next/navigation'
import { auth } from '@/src/lib/auth'
import { prisma } from '@/src/lib/db'
import { AdjustStockForm } from '@/src/components/AdjustStockForm'

interface AdjustStockPageProps {
  params: Promise<{ id: string }>
}

export default async function AdjustStockPage({ params }: AdjustStockPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
    },
  })

  if (!product) {
    notFound()
  }

  return (
    <AdjustStockForm
      product={product}
      userId={session.user.id}
    />
  )
}
