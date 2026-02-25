import { prisma } from '@/src/lib/db'
import { OrdersPageClient } from '@/src/components/orders/OrdersPageClient'
import { OrderStatus } from '@/app/generated/prisma/client'

const ORDERS_PER_PAGE = 50

interface PageProps {
  searchParams: Promise<{
    status?: string
    search?: string
    page?: string
  }>
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const statusFilter = params.status as OrderStatus | 'all' | undefined
  const searchQuery = params.search || ''
  const currentPage = Math.max(1, parseInt(params.page || '1', 10))

  // Build where clause
  const where: {
    status?: OrderStatus
    OR?: Array<{
      orderNumber?: { contains: string; mode: 'insensitive' }
      customerName?: { contains: string; mode: 'insensitive' }
    }>
  } = {}

  if (statusFilter && statusFilter !== 'all') {
    where.status = statusFilter as OrderStatus
  }

  if (searchQuery) {
    where.OR = [
      { orderNumber: { contains: searchQuery, mode: 'insensitive' } },
      { customerName: { contains: searchQuery, mode: 'insensitive' } },
    ]
  }

  // Get total count for pagination
  const totalOrders = await prisma.order.count({ where })
  const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE)

  // Fetch orders with pagination
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (currentPage - 1) * ORDERS_PER_PAGE,
    take: ORDERS_PER_PAGE,
    include: {
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              currentStock: true,
            },
          },
        },
      },
    },
  })

  // Get status counts for tabs
  const statusCounts = await prisma.order.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const counts = {
    all: totalOrders,
    PENDING: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    CANCELLED: 0,
    ON_HOLD: 0,
  }

  // When there's a search or status filter, get total unfiltered count for 'all'
  if (searchQuery || (statusFilter && statusFilter !== 'all')) {
    const allCount = await prisma.order.count({
      where: searchQuery
        ? {
            OR: [
              { orderNumber: { contains: searchQuery, mode: 'insensitive' } },
              { customerName: { contains: searchQuery, mode: 'insensitive' } },
            ],
          }
        : undefined,
    })
    counts.all = allCount
  }

  statusCounts.forEach((s) => {
    counts[s.status] = s._count.status
  })

  // Format orders for client
  const formattedOrders = orders.map((order) => {
    // Check stock status for each item
    let stockStatus: 'ready' | 'issue' = 'ready'

    for (const item of order.orderItems) {
      if (!item.product) {
        // Product not found in system
        stockStatus = 'issue'
        break
      }
      if (item.product.currentStock < item.quantity) {
        // Not enough stock
        stockStatus = 'issue'
        break
      }
    }

    return {
      id: order.id,
      shopifyOrderId: order.shopifyOrderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      totalPrice: order.totalPrice.toString(),
      currency: order.currency,
      itemCount: order.orderItems.length,
      stockStatus,
      createdAt: order.createdAt.toISOString(),
    }
  })

  return (
    <OrdersPageClient
      orders={formattedOrders}
      statusCounts={counts}
      currentStatus={statusFilter || 'all'}
      currentSearch={searchQuery}
      currentPage={currentPage}
      totalPages={totalPages}
      totalOrders={totalOrders}
    />
  )
}
