import { NextRequest, NextResponse } from 'next/server'
import { registerWebhooks, listWebhooks, deleteWebhook } from '@/src/lib/shopify'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { baseUrl } = body

    if (!baseUrl || typeof baseUrl !== 'string') {
      return NextResponse.json(
        { error: 'baseUrl is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(baseUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    console.log(`[Register Webhooks] Registering webhooks for: ${baseUrl}`)

    const result = await registerWebhooks(baseUrl)

    return NextResponse.json({
      success: true,
      webhookEndpoint: `${baseUrl}/api/webhooks/shopify/orders`,
      created: result.created,
      existing: result.existing,
      errors: result.errors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Register Webhooks] Error:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const webhooks = await listWebhooks()

    return NextResponse.json({
      success: true,
      count: webhooks.length,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        topic: w.topic,
        address: w.address,
        apiVersion: w.api_version,
        createdAt: w.created_at,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[List Webhooks] Error:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')
    const deleteAll = searchParams.get('all') === 'true'

    if (deleteAll) {
      // Delete all webhooks
      const webhooks = await listWebhooks()
      const deleted: number[] = []

      for (const webhook of webhooks) {
        await deleteWebhook(webhook.id)
        deleted.push(webhook.id)
      }

      return NextResponse.json({
        success: true,
        deleted,
        message: `Deleted ${deleted.length} webhooks`,
      })
    }

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required. Use ?id=<webhook-id> or ?all=true to delete all' },
        { status: 400 }
      )
    }

    const id = parseInt(webhookId, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid webhook ID' },
        { status: 400 }
      )
    }

    await deleteWebhook(id)

    return NextResponse.json({
      success: true,
      deleted: id,
      message: `Deleted webhook ${id}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Delete Webhook] Error:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
