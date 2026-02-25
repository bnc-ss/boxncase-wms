import { prisma } from '@/src/lib/db'
import { ShipmentsPageClient } from '@/src/components/shipments/ShipmentsPageClient'

interface PageProps {
  searchParams: Promise<{
    range?: string
    from?: string
    to?: string
    search?: string
  }>
}

export default async function ShipmentsPage({ searchParams }: PageProps) {
  const params = await searchParams

  // Calculate date range
  const now = new Date()
  let dateFrom: Date | undefined
  let dateTo: Date | undefined

  switch (params.range) {
    case 'today':
      dateFrom = new Date(now)
      dateFrom.setHours(0, 0, 0, 0)
      dateTo = new Date(now)
      dateTo.setHours(23, 59, 59, 999)
      break
    case '7days':
      dateFrom = new Date(now)
      dateFrom.setDate(dateFrom.getDate() - 7)
      dateFrom.setHours(0, 0, 0, 0)
      dateTo = new Date(now)
      dateTo.setHours(23, 59, 59, 999)
      break
    case '30days':
      dateFrom = new Date(now)
      dateFrom.setDate(dateFrom.getDate() - 30)
      dateFrom.setHours(0, 0, 0, 0)
      dateTo = new Date(now)
      dateTo.setHours(23, 59, 59, 999)
      break
    case 'custom':
      if (params.from) {
        dateFrom = new Date(params.from)
        dateFrom.setHours(0, 0, 0, 0)
      }
      if (params.to) {
        dateTo = new Date(params.to)
        dateTo.setHours(23, 59, 59, 999)
      }
      break
    default:
      // Default to last 30 days
      dateFrom = new Date(now)
      dateFrom.setDate(dateFrom.getDate() - 30)
      dateFrom.setHours(0, 0, 0, 0)
      dateTo = new Date(now)
      dateTo.setHours(23, 59, 59, 999)
  }

  // Build where clause
  const where: {
    createdAt?: { gte?: Date; lte?: Date }
    OR?: Array<{
      trackingNumber?: { contains: string; mode: 'insensitive' }
      order?: { orderNumber?: { contains: string; mode: 'insensitive' } }
    }>
  } = {}

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = dateFrom
    if (dateTo) where.createdAt.lte = dateTo
  }

  if (params.search) {
    where.OR = [
      { trackingNumber: { contains: params.search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
    ]
  }

  // Fetch shipments with related data
  const [shipments, totalCost] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
          },
        },
        shippedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.shipment.aggregate({
      where,
      _sum: {
        shipmentCost: true,
      },
    }),
  ])

  // Format data for client
  const shipmentsData = shipments.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    orderId: s.order.id,
    orderNumber: s.order.orderNumber,
    customerName: s.order.customerName,
    carrier: s.carrier,
    service: s.service,
    trackingNumber: s.trackingNumber,
    shipmentCost: s.shipmentCost.toString(),
    shippedBy: s.shippedBy?.name || 'Unknown',
    labelUrl: s.labelUrl,
  }))

  const totalShippingCost = totalCost._sum.shipmentCost?.toString() || '0'

  return (
    <ShipmentsPageClient
      shipments={shipmentsData}
      totalShippingCost={totalShippingCost}
      currentRange={params.range || '30days'}
      currentFrom={params.from}
      currentTo={params.to}
      currentSearch={params.search}
    />
  )
}
