import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/db'
import * as ups from '@/src/lib/carriers/ups'
import * as fedex from '@/src/lib/carriers/fedex'

export interface ShippingRate {
  id: string
  carrier: 'UPS' | 'FedEx'
  service: string
  serviceCode: string
  price: number
  currency: string
  estimatedDays: number
  estimatedDelivery: string
}

interface RateRequest {
  orderId: string
}

// Default box dimensions if we can't determine from products
const DEFAULT_BOX = {
  length: 12,
  width: 10,
  height: 6,
}

// Minimum weight for shipping
const MIN_WEIGHT = 0.5

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    // Skip weekends
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++
    }
  }
  return result
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: RateRequest = await request.json()

    if (!body.orderId) {
      return NextResponse.json(
        { error: 'Missing required field: orderId' },
        { status: 400 }
      )
    }

    // Look up the order with items and products
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                weight: true,
                length: true,
                width: true,
                height: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate total weight and find largest dimensions
    let totalWeight = 0
    let maxLength = 0
    let maxWidth = 0
    let maxHeight = 0

    for (const item of order.orderItems) {
      if (item.product) {
        const itemWeight = Number(item.product.weight) * item.quantity
        totalWeight += itemWeight

        // Track largest dimensions (we'd use largest box or calculate bin packing)
        const length = Number(item.product.length)
        const width = Number(item.product.width)
        const height = Number(item.product.height)

        if (length > maxLength) maxLength = length
        if (width > maxWidth) maxWidth = width
        if (height > maxHeight) maxHeight = height
      }
    }

    // Use defaults if we couldn't determine from products
    totalWeight = Math.max(MIN_WEIGHT, totalWeight)
    const boxDimensions = {
      length: maxLength > 0 ? maxLength : DEFAULT_BOX.length,
      width: maxWidth > 0 ? maxWidth : DEFAULT_BOX.width,
      height: maxHeight > 0 ? maxHeight : DEFAULT_BOX.height,
    }

    // Build ship-to address
    const shipTo = {
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingZip,
      countryCode: order.shippingCountry,
    }

    // Package info for both carriers
    const packages = [
      {
        weight: totalWeight,
        length: boxDimensions.length,
        width: boxDimensions.width,
        height: boxDimensions.height,
      },
    ]

    console.log(`[Rates] Getting rates for order ${order.orderNumber}`)
    console.log(`[Rates] Weight: ${totalWeight} lbs, Box: ${boxDimensions.length}x${boxDimensions.width}x${boxDimensions.height}`)

    // Call UPS and FedEx simultaneously
    const [upsResult, fedexResult] = await Promise.allSettled([
      ups.isConfigured() ? ups.getRates({ shipTo, packages }) : Promise.resolve({ rates: [], error: 'UPS not configured' }),
      fedex.isConfigured() ? fedex.getRates({ shipTo, packages }) : Promise.resolve({ rates: [], error: 'FedEx not configured' }),
    ])

    const allRates: ShippingRate[] = []
    const errors: string[] = []
    const today = new Date()

    // Process UPS results
    if (upsResult.status === 'fulfilled') {
      if (upsResult.value.error) {
        errors.push(`UPS: ${upsResult.value.error}`)
      }
      for (const rate of upsResult.value.rates) {
        const estimatedDays = rate.businessDaysInTransit || estimateTransitDays(rate.serviceCode, 'UPS')
        allRates.push({
          id: `ups-${rate.serviceCode}`,
          carrier: 'UPS',
          service: rate.serviceName,
          serviceCode: rate.serviceCode,
          price: rate.totalCharge,
          currency: rate.currency,
          estimatedDays,
          estimatedDelivery: rate.estimatedDeliveryDate || formatDate(addBusinessDays(today, estimatedDays)),
        })
      }
    } else {
      errors.push(`UPS: ${upsResult.reason}`)
    }

    // Process FedEx results
    if (fedexResult.status === 'fulfilled') {
      if (fedexResult.value.error) {
        errors.push(`FedEx: ${fedexResult.value.error}`)
      }
      for (const rate of fedexResult.value.rates) {
        const estimatedDays = rate.transitDays || estimateTransitDays(rate.serviceCode, 'FedEx')
        allRates.push({
          id: `fedex-${rate.serviceCode}`,
          carrier: 'FedEx',
          service: rate.serviceName,
          serviceCode: rate.serviceCode,
          price: rate.totalCharge,
          currency: rate.currency,
          estimatedDays,
          estimatedDelivery: rate.deliveryDate || formatDate(addBusinessDays(today, estimatedDays)),
        })
      }
    } else {
      errors.push(`FedEx: ${fedexResult.reason}`)
    }

    // If no rates at all, return error
    if (allRates.length === 0) {
      // If carriers aren't configured, return mock data for development
      if (!ups.isConfigured() && !fedex.isConfigured()) {
        console.log('[Rates] No carriers configured, returning mock rates')
        const mockRates = generateMockRates(totalWeight, today)
        return NextResponse.json({
          success: true,
          rates: mockRates,
          cheapestRate: mockRates[0],
          mock: true,
          errors: ['No carriers configured - using mock data'],
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Unable to get shipping rates',
          details: errors,
        },
        { status: 500 }
      )
    }

    // Sort by price ascending
    allRates.sort((a, b) => a.price - b.price)

    console.log(`[Rates] Got ${allRates.length} rates (UPS: ${allRates.filter(r => r.carrier === 'UPS').length}, FedEx: ${allRates.filter(r => r.carrier === 'FedEx').length})`)

    return NextResponse.json({
      success: true,
      rates: allRates,
      cheapestRate: allRates[0],
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Shipping Rates] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Estimate transit days based on service code
function estimateTransitDays(serviceCode: string, carrier: string): number {
  if (carrier === 'UPS') {
    const upsEstimates: Record<string, number> = {
      '01': 1, // Next Day Air
      '02': 2, // 2nd Day Air
      '03': 5, // Ground
      '12': 3, // 3 Day Select
      '13': 1, // Next Day Air Saver
      '14': 1, // Next Day Air Early
      '59': 2, // 2nd Day Air A.M.
    }
    return upsEstimates[serviceCode] || 5
  }

  if (carrier === 'FedEx') {
    const fedexEstimates: Record<string, number> = {
      FEDEX_GROUND: 5,
      FEDEX_HOME_DELIVERY: 5,
      GROUND_HOME_DELIVERY: 5,
      FEDEX_EXPRESS_SAVER: 3,
      FEDEX_2_DAY: 2,
      FEDEX_2_DAY_AM: 2,
      STANDARD_OVERNIGHT: 1,
      PRIORITY_OVERNIGHT: 1,
      FIRST_OVERNIGHT: 1,
    }
    return fedexEstimates[serviceCode] || 5
  }

  return 5
}

// Generate mock rates for development when no carriers are configured
function generateMockRates(weight: number, today: Date): ShippingRate[] {
  const weightMultiplier = Math.max(1, weight / 2)

  const rates: ShippingRate[] = [
    {
      id: 'ups-03',
      carrier: 'UPS',
      service: 'UPS Ground',
      serviceCode: '03',
      price: Math.round(8.99 * weightMultiplier * 100) / 100,
      currency: 'USD',
      estimatedDays: 5,
      estimatedDelivery: formatDate(addBusinessDays(today, 5)),
    },
    {
      id: 'ups-02',
      carrier: 'UPS',
      service: 'UPS 2nd Day Air',
      serviceCode: '02',
      price: Math.round(24.99 * weightMultiplier * 100) / 100,
      currency: 'USD',
      estimatedDays: 2,
      estimatedDelivery: formatDate(addBusinessDays(today, 2)),
    },
    {
      id: 'fedex-FEDEX_GROUND',
      carrier: 'FedEx',
      service: 'FedEx Ground',
      serviceCode: 'FEDEX_GROUND',
      price: Math.round(9.49 * weightMultiplier * 100) / 100,
      currency: 'USD',
      estimatedDays: 5,
      estimatedDelivery: formatDate(addBusinessDays(today, 5)),
    },
    {
      id: 'fedex-FEDEX_2_DAY',
      carrier: 'FedEx',
      service: 'FedEx 2Day',
      serviceCode: 'FEDEX_2_DAY',
      price: Math.round(22.99 * weightMultiplier * 100) / 100,
      currency: 'USD',
      estimatedDays: 2,
      estimatedDelivery: formatDate(addBusinessDays(today, 2)),
    },
  ]

  return rates.sort((a, b) => a.price - b.price)
}
