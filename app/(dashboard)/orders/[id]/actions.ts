'use server'

import { prisma } from '@/src/lib/db'
import { revalidatePath } from 'next/cache'
import { OrderStatus, TransactionType } from '@/app/generated/prisma/client'
import { Prisma } from '@/app/generated/prisma/client'

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')

  return { success: true }
}

export interface FulfillOrderInput {
  orderId: string
  carrier: string
  service: string
  trackingNumber: string
  labelUrl?: string
  labelData?: string // Base64 encoded label image
  labelFormat?: string // e.g., 'PNG', 'GIF', 'ZPL'
  shipmentCost: number
  userId: string
}

export async function fulfillOrder(input: FulfillOrderInput) {
  const { orderId, carrier, service, trackingNumber, labelUrl, labelData, labelFormat, shipmentCost, userId } = input

  // Get the order with items
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!order) {
    return { success: false, error: 'Order not found' }
  }

  if (order.status === 'SHIPPED') {
    return { success: false, error: 'Order already shipped' }
  }

  if (order.status === 'CANCELLED') {
    return { success: false, error: 'Cannot ship a cancelled order' }
  }

  // Check stock availability for all items
  const stockIssues: string[] = []
  for (const item of order.orderItems) {
    if (!item.product) {
      stockIssues.push(`${item.name} (${item.sku}): Product not in system`)
      continue
    }
    if (item.product.currentStock < item.quantity) {
      stockIssues.push(
        `${item.name} (${item.sku}): Need ${item.quantity}, only ${item.product.currentStock} in stock`
      )
    }
  }

  if (stockIssues.length > 0) {
    return { success: false, error: 'Stock issues: ' + stockIssues.join('; ') }
  }

  // Use a transaction to ensure atomic operation
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the shipment
    const shipment = await tx.shipment.create({
      data: {
        orderId,
        carrier,
        service,
        trackingNumber,
        labelUrl,
        labelData,
        labelFormat,
        shipmentCost: new Prisma.Decimal(shipmentCost),
        shippedByUserId: userId,
      },
    })

    // 2. Decrement inventory for each item
    for (const item of order.orderItems) {
      if (!item.product) continue

      // Decrement stock
      await tx.product.update({
        where: { id: item.product.id },
        data: {
          currentStock: {
            decrement: item.quantity,
          },
        },
      })

      // Create inventory transaction record
      await tx.inventoryTransaction.create({
        data: {
          productId: item.product.id,
          quantity: -item.quantity,
          type: TransactionType.SHIPPED,
          notes: `Shipped for order ${order.orderNumber}`,
          userId,
        },
      })
    }

    // 3. Update order status to SHIPPED
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    })

    return shipment
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  revalidatePath('/inventory')

  return {
    success: true,
    shipment: {
      id: result.id,
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl,
    },
  }
}

export async function putOrderOnHold(orderId: string, reason?: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'ON_HOLD' },
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')

  return { success: true }
}

export async function cancelOrder(orderId: string, reason?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (!order) {
    return { success: false, error: 'Order not found' }
  }

  if (order.status === 'SHIPPED') {
    return { success: false, error: 'Cannot cancel a shipped order' }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' },
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')

  return { success: true }
}

export async function resumeOrder(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'PENDING' },
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')

  return { success: true }
}
