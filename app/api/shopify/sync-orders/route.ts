import { NextResponse } from 'next/server'
import { auth } from '@/src/lib/auth'
import { prisma } from '@/src/lib/db'
import { fetchOrders } from '@/src/lib/shopify'
import { Prisma, OrderStatus } from '@/app/generated/prisma/client'

// Extend timeout for syncing many orders
export const maxDuration = 60

// Map Shopify fulfillment status to our OrderStatus
function mapFulfillmentStatus(fulfillmentStatus: string | null): OrderStatus {
  switch (fulfillmentStatus) {
    case null:
    case 'unfulfilled':
      return 'PENDING'
    case 'partial':
    case 'partially_fulfilled':
      return 'PROCESSING'
    case 'fulfilled':
      return 'SHIPPED'
    default:
      return 'PENDING'
  }
}

// Check if order is cancelled based on financial status or cancelled_at
function isOrderCancelled(order: { financial_status: string; cancelled_at?: string | null }): boolean {
  return order.financial_status === 'voided' || !!order.cancelled_at
}

export async function POST() {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Sync] Starting Shopify order sync...')

    // Fetch unfulfilled and partially fulfilled orders
    // We use 'open' status which includes unfulfilled orders
    const shopifyOrders = await fetchOrders('open')

    let created = 0
    let updated = 0
    let lineItemsCreated = 0
    let lineItemsUpdated = 0
    const errors: string[] = []

    // Build a map of SKU -> Product ID for linking
    const products = await prisma.product.findMany({
      select: { id: true, sku: true },
    })
    const skuToProductId = new Map(products.map((p) => [p.sku.toLowerCase(), p.id]))

    for (const shopifyOrder of shopifyOrders) {
      const shopifyOrderId = shopifyOrder.id.toString()

      try {
        // Determine order status
        let status: OrderStatus
        if (isOrderCancelled(shopifyOrder)) {
          status = 'CANCELLED'
        } else {
          status = mapFulfillmentStatus(shopifyOrder.fulfillment_status)
        }

        // Build customer name
        const customerName = shopifyOrder.customer
          ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`.trim()
          : shopifyOrder.shipping_address
            ? `${shopifyOrder.shipping_address.first_name} ${shopifyOrder.shipping_address.last_name}`.trim()
            : 'Unknown'

        // Check if order exists
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyOrderId },
        })

        const orderData = {
          shopifyOrderId,
          orderNumber: shopifyOrder.name,
          customerName,
          customerEmail: shopifyOrder.email || shopifyOrder.customer?.email || '',
          shippingAddress1: shopifyOrder.shipping_address?.address1 || '',
          shippingAddress2: shopifyOrder.shipping_address?.address2 || null,
          shippingCity: shopifyOrder.shipping_address?.city || '',
          shippingState: shopifyOrder.shipping_address?.province_code || shopifyOrder.shipping_address?.province || '',
          shippingZip: shopifyOrder.shipping_address?.zip || '',
          shippingCountry: shopifyOrder.shipping_address?.country_code || shopifyOrder.shipping_address?.country || 'US',
          status,
          totalPrice: new Prisma.Decimal(shopifyOrder.total_price),
          currency: shopifyOrder.currency,
          shopifyCreatedAt: new Date(shopifyOrder.created_at),
        }

        let orderId: string

        if (existingOrder) {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: orderData,
          })
          orderId = existingOrder.id
          updated++
        } else {
          const newOrder = await prisma.order.create({
            data: orderData,
          })
          orderId = newOrder.id
          created++
        }

        // Process line items
        for (const lineItem of shopifyOrder.line_items) {
          const shopifyLineItemId = lineItem.id.toString()

          // Try to find matching product by SKU
          const productId = lineItem.sku
            ? skuToProductId.get(lineItem.sku.toLowerCase()) || null
            : null

          const lineItemData = {
            orderId,
            productId,
            shopifyLineItemId,
            sku: lineItem.sku || '',
            name: lineItem.title,
            quantity: lineItem.quantity,
            price: new Prisma.Decimal(lineItem.price),
          }

          // Check if line item exists
          const existingLineItem = await prisma.orderItem.findFirst({
            where: { shopifyLineItemId },
          })

          if (existingLineItem) {
            await prisma.orderItem.update({
              where: { id: existingLineItem.id },
              data: lineItemData,
            })
            lineItemsUpdated++
          } else {
            await prisma.orderItem.create({
              data: lineItemData,
            })
            lineItemsCreated++
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Sync] Error processing order ${shopifyOrder.name}:`, message)
        errors.push(`Order ${shopifyOrder.name}: ${message}`)
      }
    }

    const totalOrders = created + updated
    const totalLineItems = lineItemsCreated + lineItemsUpdated

    console.log(`[Sync] Complete: ${created} orders created, ${updated} updated`)
    console.log(`[Sync] Line items: ${lineItemsCreated} created, ${lineItemsUpdated} updated`)

    return NextResponse.json({
      success: true,
      orders: {
        created,
        updated,
        total: totalOrders,
      },
      lineItems: {
        created: lineItemsCreated,
        updated: lineItemsUpdated,
        total: totalLineItems,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Sync] Failed:', message)

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
