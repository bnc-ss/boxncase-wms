import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/src/lib/auth'
import { prisma } from '@/src/lib/db'
import * as ups from '@/src/lib/carriers/ups'
import * as fedex from '@/src/lib/carriers/fedex'

interface TestRequest {
  carrier: 'UPS' | 'FedEx'
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: TestRequest = await request.json()

    if (!body.carrier) {
      return NextResponse.json({ error: 'Carrier is required' }, { status: 400 })
    }

    // Sample test shipment for rate lookup
    const testShipTo = {
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      countryCode: 'US',
    }

    const testPackages = [
      {
        weight: 2,
        length: 10,
        width: 8,
        height: 4,
      },
    ]

    if (body.carrier === 'UPS') {
      if (!ups.isConfigured()) {
        return NextResponse.json(
          { error: 'UPS is not configured' },
          { status: 400 }
        )
      }

      const result = await ups.getRates({
        shipTo: testShipTo,
        packages: testPackages,
      })

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        carrier: 'UPS',
        rateCount: result.rates.length,
        rates: result.rates.map((r) => ({
          service: r.serviceName,
          price: r.totalCharge,
        })),
      })
    }

    if (body.carrier === 'FedEx') {
      if (!fedex.isConfigured()) {
        return NextResponse.json(
          { error: 'FedEx is not configured' },
          { status: 400 }
        )
      }

      const result = await fedex.getRates({
        shipTo: testShipTo,
        packages: testPackages,
      })

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        carrier: 'FedEx',
        rateCount: result.rates.length,
        rates: result.rates.map((r) => ({
          service: r.serviceName,
          price: r.totalCharge,
        })),
      })
    }

    return NextResponse.json({ error: 'Invalid carrier' }, { status: 400 })
  } catch (error) {
    console.error('[Carrier Test] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
