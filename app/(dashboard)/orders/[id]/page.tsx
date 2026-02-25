import { prisma } from '@/src/lib/db'
import { notFound } from 'next/navigation'
import { OrderFulfillment } from '@/src/components/orders/OrderFulfillment'
import { auth } from '@/src/lib/auth'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              currentStock: true,
              weight: true,
            },
          },
        },
      },
      shipments: {
        include: {
          shippedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!order) {
    notFound()
  }

  // Calculate total weight for shipping
  let totalWeight = 0
  for (const item of order.orderItems) {
    if (item.product?.weight) {
      totalWeight += Number(item.product.weight) * item.quantity
    }
  }

  // Format data for client component
  const orderData = {
    id: order.id,
    shopifyOrderId: order.shopifyOrderId,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    totalPrice: order.totalPrice.toString(),
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    shippingAddress: {
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      zip: order.shippingZip,
      country: order.shippingCountry,
    },
    items: order.orderItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      price: item.price.toString(),
      currentStock: item.product?.currentStock ?? 0,
      hasProduct: !!item.product,
    })),
    shipments: order.shipments.map((s) => ({
      id: s.id,
      carrier: s.carrier,
      service: s.service,
      trackingNumber: s.trackingNumber,
      labelUrl: s.labelUrl,
      shipmentCost: s.shipmentCost.toString(),
      createdAt: s.createdAt.toISOString(),
      shippedBy: s.shippedBy?.name || 'Unknown',
    })),
    totalWeight,
  }

  // Warehouse address from environment (for shipping labels)
  const warehouseAddress = {
    name: process.env.WAREHOUSE_NAME || 'BoxNCase Warehouse',
    address1: process.env.WAREHOUSE_ADDRESS1 || '123 Warehouse Dr',
    address2: process.env.WAREHOUSE_ADDRESS2 || '',
    city: process.env.WAREHOUSE_CITY || 'Los Angeles',
    state: process.env.WAREHOUSE_STATE || 'CA',
    zip: process.env.WAREHOUSE_ZIP || '90001',
    country: process.env.WAREHOUSE_COUNTRY || 'US',
    phone: process.env.WAREHOUSE_PHONE || '',
  }

  return (
    <OrderFulfillment
      order={orderData}
      warehouseAddress={warehouseAddress}
      userId={session?.user?.id || ''}
    />
  )
}
