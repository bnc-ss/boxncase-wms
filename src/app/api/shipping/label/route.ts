import { NextRequest, NextResponse } from 'next/server'

export interface LabelRequest {
  orderId: string
  carrier: string
  serviceCode: string
  shipFrom: {
    name: string
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    country: string
    phone?: string
  }
  shipTo: {
    name: string
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    country: string
    phone?: string
  }
  weight: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
}

export interface LabelResponse {
  success: true
  trackingNumber: string
  labelUrl: string
  carrier: string
  service: string
  shipmentCost: number
}

// Generate a mock tracking number based on carrier
function generateTrackingNumber(carrier: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()

  switch (carrier) {
    case 'UPS':
      return `1Z${random}${timestamp}`.substring(0, 18)
    case 'FedEx':
      return `${Math.floor(Math.random() * 9000000000000000) + 1000000000000000}`
    case 'USPS':
      return `9400${Math.floor(Math.random() * 10000000000000000000)
        .toString()
        .substring(0, 18)}`
    default:
      return `TRK${timestamp}${random}`
  }
}

// Mock label generation - will be replaced with real carrier APIs
export async function POST(request: NextRequest) {
  try {
    const body: LabelRequest = await request.json()

    // Validate required fields
    if (!body.orderId || !body.carrier || !body.serviceCode) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, carrier, serviceCode' },
        { status: 400 }
      )
    }

    if (!body.shipTo || !body.shipFrom) {
      return NextResponse.json(
        { error: 'Missing required fields: shipTo, shipFrom' },
        { status: 400 }
      )
    }

    // Simulate API latency for label generation
    await new Promise((resolve) => setTimeout(resolve, 800))

    const trackingNumber = generateTrackingNumber(body.carrier)

    // In production, this would be a real label URL from the carrier
    // For mock purposes, we'll use a placeholder PDF URL
    const labelUrl = `https://example.com/labels/${body.carrier.toLowerCase()}/${trackingNumber}.pdf`

    // Mock shipment cost (in production this comes from the carrier)
    const baseCosts: Record<string, number> = {
      UPS: 12.99,
      FedEx: 13.49,
      USPS: 8.99,
    }
    const shipmentCost = baseCosts[body.carrier] || 10.99

    // Determine service name from code
    const serviceNames: Record<string, string> = {
      '01': 'UPS Next Day Air',
      '02': 'UPS 2nd Day Air',
      '03': 'UPS Ground',
      '12': 'UPS 3 Day Select',
      FEDEX_GROUND: 'FedEx Ground',
      FEDEX_EXPRESS_SAVER: 'FedEx Express Saver',
      FEDEX_2_DAY: 'FedEx 2Day',
      PRIORITY_OVERNIGHT: 'FedEx Priority Overnight',
      GROUND_ADVANTAGE: 'USPS Ground Advantage',
      PRIORITY: 'USPS Priority Mail',
      PRIORITY_MAIL_EXPRESS: 'USPS Priority Mail Express',
    }

    const response: LabelResponse = {
      success: true,
      trackingNumber,
      labelUrl,
      carrier: body.carrier,
      service: serviceNames[body.serviceCode] || body.serviceCode,
      shipmentCost,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Shipping Label] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
