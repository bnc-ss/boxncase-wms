import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/db'

interface RouteParams {
  params: Promise<{
    shipmentId: string
  }>
}

/**
 * GET /api/shipping/label/[shipmentId]
 *
 * Returns the shipping label image for a shipment.
 * Sets proper content-type headers for browser display/printing.
 *
 * Query params:
 *   - download=true: Forces download instead of inline display
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { shipmentId } = await params
    const { searchParams } = new URL(request.url)
    const forceDownload = searchParams.get('download') === 'true'

    // Look up the shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        trackingNumber: true,
        labelData: true,
        labelFormat: true,
        carrier: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    })

    if (!shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      )
    }

    if (!shipment.labelData) {
      return NextResponse.json(
        { error: 'No label data available for this shipment' },
        { status: 404 }
      )
    }

    // Decode base64 label data
    const labelBuffer = Buffer.from(shipment.labelData, 'base64')

    // Determine content type based on label format
    const format = (shipment.labelFormat || 'PNG').toUpperCase()
    let contentType: string
    let fileExtension: string

    switch (format) {
      case 'PNG':
        contentType = 'image/png'
        fileExtension = 'png'
        break
      case 'GIF':
        contentType = 'image/gif'
        fileExtension = 'gif'
        break
      case 'ZPL':
        // ZPL is a text-based format for thermal printers
        contentType = 'application/octet-stream'
        fileExtension = 'zpl'
        break
      case 'PDF':
        contentType = 'application/pdf'
        fileExtension = 'pdf'
        break
      case 'JPG':
      case 'JPEG':
        contentType = 'image/jpeg'
        fileExtension = 'jpg'
        break
      default:
        contentType = 'application/octet-stream'
        fileExtension = 'bin'
    }

    // Build filename for download
    const filename = `label-${shipment.carrier}-${shipment.trackingNumber || shipment.id}.${fileExtension}`

    // Set content disposition based on whether user wants download
    const disposition = forceDownload
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`

    // Return the label with proper headers
    return new NextResponse(labelBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': labelBuffer.length.toString(),
        // Cache for 1 hour (labels don't change)
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Label API] Error:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * HEAD /api/shipping/label/[shipmentId]
 *
 * Check if a label exists without downloading it.
 */
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  try {
    const { shipmentId } = await params

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        labelData: true,
        labelFormat: true,
      },
    })

    if (!shipment || !shipment.labelData) {
      return new NextResponse(null, { status: 404 })
    }

    const format = (shipment.labelFormat || 'PNG').toUpperCase()
    const contentType =
      format === 'PNG'
        ? 'image/png'
        : format === 'GIF'
          ? 'image/gif'
          : format === 'PDF'
            ? 'application/pdf'
            : 'application/octet-stream'

    const labelBuffer = Buffer.from(shipment.labelData, 'base64')

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': labelBuffer.length.toString(),
      },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
