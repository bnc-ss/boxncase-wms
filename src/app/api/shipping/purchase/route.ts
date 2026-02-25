import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/db'
import { Prisma, TransactionType } from '@/app/generated/prisma/client'
import * as ups from '@/src/lib/carriers/ups'
import * as fedex from '@/src/lib/carriers/fedex'
import { createFulfillment } from '@/src/lib/shopify'
import { auth } from '@/src/lib/auth'

interface PurchaseRequest {
  orderId: string
  carrier: 'UPS' | 'FedEx'
  serviceCode: string
  serviceName?: string
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body: PurchaseRequest = await request.json()

    if (!body.orderId || !body.carrier || !body.serviceCode) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, carrier, serviceCode' },
        { status: 400 }
      )
    }

    // Look up the order with items and products
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'SHIPPED') {
      return NextResponse.json({ error: 'Order already shipped' }, { status: 400 })
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot ship a cancelled order' }, { status: 400 })
    }

    // Check stock availability
    const stockIssues: string[] = []
    for (const item of order.orderItems) {
      if (!item.product) {
        stockIssues.push(`${item.name}: Product not in system`)
        continue
      }
      if (item.product.currentStock < item.quantity) {
        stockIssues.push(`${item.name}: Need ${item.quantity}, only ${item.product.currentStock} in stock`)
      }
    }

    if (stockIssues.length > 0) {
      return NextResponse.json(
        { error: 'Stock issues', details: stockIssues },
        { status: 400 }
      )
    }

    // Calculate package info
    let totalWeight = 0
    let maxLength = 0
    let maxWidth = 0
    let maxHeight = 0

    for (const item of order.orderItems) {
      if (item.product) {
        totalWeight += Number(item.product.weight) * item.quantity
        const length = Number(item.product.length)
        const width = Number(item.product.width)
        const height = Number(item.product.height)
        if (length > maxLength) maxLength = length
        if (width > maxWidth) maxWidth = width
        if (height > maxHeight) maxHeight = height
      }
    }

    totalWeight = Math.max(0.5, totalWeight)
    const boxDimensions = {
      length: maxLength > 0 ? maxLength : 12,
      width: maxWidth > 0 ? maxWidth : 10,
      height: maxHeight > 0 ? maxHeight : 6,
    }

    // Build ship-to address
    const shipTo = {
      name: order.customerName,
      addressLine1: order.shippingAddress1,
      addressLine2: order.shippingAddress2 || undefined,
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingZip,
      countryCode: order.shippingCountry,
    }

    const packages = [
      {
        weight: totalWeight,
        length: boxDimensions.length,
        width: boxDimensions.width,
        height: boxDimensions.height,
      },
    ]

    console.log(`[Purchase] Creating ${body.carrier} shipment for order ${order.orderNumber}`)

    // Call the appropriate carrier's createShipment
    let shipmentResult: {
      trackingNumber: string
      labelBase64: string
      labelFormat: string
      cost: number
      currency: string
    }

    if (body.carrier === 'UPS') {
      if (!ups.isConfigured()) {
        // Return mock data for development
        shipmentResult = generateMockShipment('UPS', body.serviceCode)
      } else {
        const result = await ups.createShipment({
          serviceCode: body.serviceCode,
          shipTo,
          packages,
          labelFormat: 'PNG',
        })

        if (result.error || !result.shipment) {
          return NextResponse.json(
            { error: result.error || 'Failed to create UPS shipment' },
            { status: 500 }
          )
        }
        shipmentResult = result.shipment
      }
    } else if (body.carrier === 'FedEx') {
      if (!fedex.isConfigured()) {
        // Return mock data for development
        shipmentResult = generateMockShipment('FedEx', body.serviceCode)
      } else {
        const result = await fedex.createShipment({
          serviceCode: body.serviceCode,
          shipTo,
          packages,
          labelFormat: 'PNG',
        })

        if (result.error || !result.shipment) {
          return NextResponse.json(
            { error: result.error || 'Failed to create FedEx shipment' },
            { status: 500 }
          )
        }
        shipmentResult = result.shipment
      }
    } else {
      return NextResponse.json({ error: 'Invalid carrier' }, { status: 400 })
    }

    console.log(`[Purchase] Shipment created: ${shipmentResult.trackingNumber}`)

    // Use a transaction to ensure atomic operation
    const dbResult = await prisma.$transaction(async (tx) => {
      // 1. Create the shipment record
      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: body.carrier,
          service: body.serviceName || body.serviceCode,
          trackingNumber: shipmentResult.trackingNumber,
          labelUrl: `/api/shipping/label/${order.id}`, // Will be updated after we have the ID
          labelData: shipmentResult.labelBase64,
          labelFormat: shipmentResult.labelFormat,
          shipmentCost: new Prisma.Decimal(shipmentResult.cost),
          shippedByUserId: userId,
        },
      })

      // Update label URL with actual shipment ID
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { labelUrl: `/api/shipping/label/${shipment.id}` },
      })

      // 2. Decrement inventory and create transactions
      for (const item of order.orderItems) {
        if (!item.product) continue

        await tx.product.update({
          where: { id: item.product.id },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        })

        await tx.inventoryTransaction.create({
          data: {
            productId: item.product.id,
            quantity: -item.quantity,
            type: TransactionType.SHIPPED,
            notes: `Shipped for order ${order.orderNumber} via ${body.carrier}`,
            userId,
          },
        })
      }

      // 3. Update order status to SHIPPED
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'SHIPPED' },
      })

      return shipment
    })

    console.log(`[Purchase] Order ${order.orderNumber} marked as shipped`)

    // 4. Try to create fulfillment in Shopify (don't fail if this fails)
    let shopifyFulfillment = null
    try {
      if (order.shopifyOrderId) {
        shopifyFulfillment = await createFulfillment(
          order.shopifyOrderId,
          shipmentResult.trackingNumber,
          body.carrier,
          getTrackingUrl(body.carrier, shipmentResult.trackingNumber)
        )
        console.log(`[Purchase] Shopify fulfillment created: ${shopifyFulfillment.id}`)
      }
    } catch (error) {
      console.error('[Purchase] Failed to create Shopify fulfillment:', error)
      // Don't fail the whole operation if Shopify sync fails
    }

    return NextResponse.json({
      success: true,
      shipment: {
        id: dbResult.id,
        trackingNumber: shipmentResult.trackingNumber,
        labelUrl: `/api/shipping/label/${dbResult.id}`,
        carrier: body.carrier,
        service: body.serviceName || body.serviceCode,
        cost: shipmentResult.cost,
        currency: shipmentResult.currency,
      },
      shopifyFulfillment: shopifyFulfillment
        ? { id: shopifyFulfillment.id }
        : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Purchase] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Generate mock shipment data for development
function generateMockShipment(
  carrier: string,
  serviceCode: string
): {
  trackingNumber: string
  labelBase64: string
  labelFormat: string
  cost: number
  currency: string
} {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()

  let trackingNumber: string
  if (carrier === 'UPS') {
    trackingNumber = `1Z${random}${timestamp}`.substring(0, 18)
  } else {
    trackingNumber = `${Math.floor(Math.random() * 9000000000000000) + 1000000000000000}`
  }

  // Base64 of a simple 1x1 PNG for mock purposes
  const mockLabelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  return {
    trackingNumber,
    labelBase64: mockLabelBase64,
    labelFormat: 'PNG',
    cost: Math.round((Math.random() * 20 + 10) * 100) / 100,
    currency: 'USD',
  }
}

// Get tracking URL for a carrier
function getTrackingUrl(carrier: string, trackingNumber: string): string {
  if (carrier === 'UPS') {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`
  }
  if (carrier === 'FedEx') {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
  }
  return ''
}
