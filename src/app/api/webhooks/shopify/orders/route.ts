import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/src/lib/db'
import { Prisma, OrderStatus } from '@/app/generated/prisma/client'

// Verify Shopify webhook signature
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  const digest = hmac.digest('base64')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

// Map Shopify fulfillment status to our OrderStatus
function mapFulfillmentStatus(fulfillmentStatus: string | null, cancelled: boolean): OrderStatus {
  if (cancelled) {
    return 'CANCELLED'
  }

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

// Shopify order webhook payload types
interface ShopifyWebhookOrder {
  id: number
  name: string
  email: string
  created_at: string
  updated_at: string
  cancelled_at: string | null
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  currency: string
  customer: {
    id: number
    email: string
    first_name: string
    last_name: string
  } | null
  shipping_address: {
    first_name: string
    last_name: string
    address1: string
    address2: string | null
    city: string
    province: string
    province_code: string
    country: string
    country_code: string
    zip: string
    phone: string | null
  } | null
  line_items: Array<{
    id: number
    product_id: number | null
    variant_id: number | null
    title: string
    sku: string
    quantity: number
    price: string
  }>
}

// Process order webhook (create or update)
async function processOrderWebhook(order: ShopifyWebhookOrder, topic: string) {
  const shopifyOrderId = order.id.toString()
  const isCancelled = !!order.cancelled_at || order.financial_status === 'voided'

  // Determine order status
  const status = mapFulfillmentStatus(order.fulfillment_status, isCancelled)

  // Build customer name
  const customerName = order.customer
    ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
    : order.shipping_address
      ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}`.trim()
      : 'Unknown'

  const orderData = {
    shopifyOrderId,
    orderNumber: order.name,
    customerName,
    customerEmail: order.email || order.customer?.email || '',
    shippingAddress1: order.shipping_address?.address1 || '',
    shippingAddress2: order.shipping_address?.address2 || null,
    shippingCity: order.shipping_address?.city || '',
    shippingState: order.shipping_address?.province_code || order.shipping_address?.province || '',
    shippingZip: order.shipping_address?.zip || '',
    shippingCountry: order.shipping_address?.country_code || order.shipping_address?.country || 'US',
    status,
    totalPrice: new Prisma.Decimal(order.total_price),
    currency: order.currency,
    shopifyCreatedAt: new Date(order.created_at),
  }

  // Build a map of SKU -> Product ID for linking
  const skus = order.line_items.map((li) => li.sku).filter(Boolean)
  const products = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true },
  })
  const skuToProductId = new Map(products.map((p) => [p.sku.toLowerCase(), p.id]))

  // Check if order exists
  const existingOrder = await prisma.order.findUnique({
    where: { shopifyOrderId },
  })

  if (existingOrder) {
    // Update existing order
    await prisma.order.update({
      where: { id: existingOrder.id },
      data: orderData,
    })

    // Update line items
    for (const lineItem of order.line_items) {
      const shopifyLineItemId = lineItem.id.toString()
      const productId = lineItem.sku
        ? skuToProductId.get(lineItem.sku.toLowerCase()) || null
        : null

      const lineItemData = {
        orderId: existingOrder.id,
        productId,
        shopifyLineItemId,
        sku: lineItem.sku || '',
        name: lineItem.title,
        quantity: lineItem.quantity,
        price: new Prisma.Decimal(lineItem.price),
      }

      await prisma.orderItem.upsert({
        where: {
          id: (await prisma.orderItem.findFirst({ where: { shopifyLineItemId } }))?.id || '',
        },
        update: lineItemData,
        create: lineItemData,
      })
    }

    console.log(`[Webhook] Updated order ${order.name} (${topic})`)
  } else {
    // Create new order with line items
    const newOrder = await prisma.order.create({
      data: orderData,
    })

    // Create line items
    for (const lineItem of order.line_items) {
      const productId = lineItem.sku
        ? skuToProductId.get(lineItem.sku.toLowerCase()) || null
        : null

      await prisma.orderItem.create({
        data: {
          orderId: newOrder.id,
          productId,
          shopifyLineItemId: lineItem.id.toString(),
          sku: lineItem.sku || '',
          name: lineItem.title,
          quantity: lineItem.quantity,
          price: new Prisma.Decimal(lineItem.price),
        },
      })
    }

    console.log(`[Webhook] Created order ${order.name} (${topic})`)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Get the raw body for signature verification
    const body = await request.text()

    // Verify webhook signature
    const signature = request.headers.get('x-shopify-hmac-sha256')
    const topic = request.headers.get('x-shopify-topic')
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET

    if (!signature || !secret) {
      console.error('[Webhook] Missing signature or secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!verifyWebhookSignature(body, signature, secret)) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the order data
    const order: ShopifyWebhookOrder = JSON.parse(body)

    console.log(`[Webhook] Received ${topic} for order ${order.name}`)

    // Process based on topic
    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
      case 'orders/cancelled':
        await processOrderWebhook(order, topic || 'unknown')
        break
      default:
        console.log(`[Webhook] Unhandled topic: ${topic}`)
    }

    const duration = Date.now() - startTime
    console.log(`[Webhook] Processed in ${duration}ms`)

    // Return 200 quickly (Shopify times out after 5 seconds)
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Webhook] Error:', message)

    // Still return 200 to prevent Shopify retries for parsing errors
    // Log the error for investigation
    return NextResponse.json({ received: true, error: message })
  }
}

// Shopify sends GET requests to verify the endpoint exists
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' })
}
