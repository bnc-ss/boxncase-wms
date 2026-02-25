import { NextRequest, NextResponse } from 'next/server'

export interface ShippingRate {
  id: string
  carrier: 'UPS' | 'FedEx' | 'USPS'
  service: string
  serviceCode: string
  price: number
  currency: string
  estimatedDays: number
  estimatedDelivery: string
}

export interface RateRequest {
  orderId: string
  weight: number // in lbs
  dimensions?: {
    length: number
    width: number
    height: number
  }
  fromZip: string
  toZip: string
  toCountry: string
}

// Mock rate data - will be replaced with real UPS/FedEx API calls
function generateMockRates(request: RateRequest): ShippingRate[] {
  const today = new Date()

  // Base prices vary by weight
  const weightMultiplier = Math.max(1, request.weight / 2)

  // Add some randomness to simulate real API variation
  const randomFactor = () => 0.9 + Math.random() * 0.2

  const rates: ShippingRate[] = [
    // UPS Rates
    {
      id: 'ups-ground',
      carrier: 'UPS',
      service: 'UPS Ground',
      serviceCode: '03',
      price: Math.round(8.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 5,
      estimatedDelivery: formatDate(addDays(today, 5)),
    },
    {
      id: 'ups-3day',
      carrier: 'UPS',
      service: 'UPS 3 Day Select',
      serviceCode: '12',
      price: Math.round(15.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 3,
      estimatedDelivery: formatDate(addDays(today, 3)),
    },
    {
      id: 'ups-2day',
      carrier: 'UPS',
      service: 'UPS 2nd Day Air',
      serviceCode: '02',
      price: Math.round(24.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 2,
      estimatedDelivery: formatDate(addDays(today, 2)),
    },
    {
      id: 'ups-overnight',
      carrier: 'UPS',
      service: 'UPS Next Day Air',
      serviceCode: '01',
      price: Math.round(49.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 1,
      estimatedDelivery: formatDate(addDays(today, 1)),
    },

    // FedEx Rates
    {
      id: 'fedex-ground',
      carrier: 'FedEx',
      service: 'FedEx Ground',
      serviceCode: 'FEDEX_GROUND',
      price: Math.round(9.49 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 5,
      estimatedDelivery: formatDate(addDays(today, 5)),
    },
    {
      id: 'fedex-express',
      carrier: 'FedEx',
      service: 'FedEx Express Saver',
      serviceCode: 'FEDEX_EXPRESS_SAVER',
      price: Math.round(18.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 3,
      estimatedDelivery: formatDate(addDays(today, 3)),
    },
    {
      id: 'fedex-2day',
      carrier: 'FedEx',
      service: 'FedEx 2Day',
      serviceCode: 'FEDEX_2_DAY',
      price: Math.round(22.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 2,
      estimatedDelivery: formatDate(addDays(today, 2)),
    },
    {
      id: 'fedex-overnight',
      carrier: 'FedEx',
      service: 'FedEx Priority Overnight',
      serviceCode: 'PRIORITY_OVERNIGHT',
      price: Math.round(54.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 1,
      estimatedDelivery: formatDate(addDays(today, 1)),
    },

    // USPS Rates (typically cheaper for lighter packages)
    {
      id: 'usps-ground',
      carrier: 'USPS',
      service: 'USPS Ground Advantage',
      serviceCode: 'GROUND_ADVANTAGE',
      price: Math.round(6.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 6,
      estimatedDelivery: formatDate(addDays(today, 6)),
    },
    {
      id: 'usps-priority',
      carrier: 'USPS',
      service: 'USPS Priority Mail',
      serviceCode: 'PRIORITY',
      price: Math.round(12.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 3,
      estimatedDelivery: formatDate(addDays(today, 3)),
    },
    {
      id: 'usps-express',
      carrier: 'USPS',
      service: 'USPS Priority Mail Express',
      serviceCode: 'PRIORITY_MAIL_EXPRESS',
      price: Math.round(32.99 * weightMultiplier * randomFactor() * 100) / 100,
      currency: 'USD',
      estimatedDays: 2,
      estimatedDelivery: formatDate(addDays(today, 2)),
    },
  ]

  // Sort by price (cheapest first)
  return rates.sort((a, b) => a.price - b.price)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  // Skip weekends for business day delivery
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1)
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

    // Validate required fields
    if (!body.orderId || !body.toZip || !body.toCountry) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, toZip, toCountry' },
        { status: 400 }
      )
    }

    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 500))

    const rates = generateMockRates(body)

    return NextResponse.json({
      success: true,
      rates,
      cheapestRate: rates[0],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Shipping Rates] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
