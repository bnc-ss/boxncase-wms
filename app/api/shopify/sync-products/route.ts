import { NextResponse } from 'next/server'
import { auth } from '@/src/lib/auth'
import { prisma } from '@/src/lib/db'
import { Prisma } from '@/app/generated/prisma/client'

// Convert weight to lbs based on unit
function convertToLbs(weight: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'kg':
    case 'kilograms':
      return weight * 2.20462
    case 'g':
    case 'grams':
      return weight * 0.00220462
    case 'oz':
    case 'ounces':
      return weight * 0.0625
    case 'lb':
    case 'lbs':
    case 'pounds':
    default:
      return weight
  }
}

// Fetch one page of products from Shopify
async function fetchProductsPage(pageInfo?: string): Promise<{
  products: Array<{
    id: number
    title: string
    body_html: string | null
    images: Array<{ src: string }>
    variants: Array<{
      id: number
      title: string
      sku: string
      barcode: string | null
      weight: number
      weight_unit: string
    }>
  }>
  nextPageInfo: string | null
}> {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

  if (!storeDomain || !accessToken) {
    throw new Error('Missing Shopify configuration')
  }

  const baseUrl = `https://${storeDomain}/admin/api/2024-10`
  let url = `${baseUrl}/products.json?limit=50`

  if (pageInfo) {
    url = `${baseUrl}/products.json?limit=50&page_info=${pageInfo}`
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
  })

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Parse Link header for pagination
  const linkHeader = response.headers.get('Link')
  let nextPageInfo: string | null = null

  if (linkHeader) {
    const nextMatch = linkHeader.match(/<[^>]+page_info=([^>&]+)[^>]*>;\s*rel="next"/)
    if (nextMatch) {
      nextPageInfo = nextMatch[1]
    }
  }

  return { products: data.products, nextPageInfo }
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can sync
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Get pageInfo from request body for pagination
    let pageInfo: string | undefined
    try {
      const body = await request.json()
      pageInfo = body.pageInfo
    } catch {
      // No body or invalid JSON - start from beginning
    }

    console.log(`[Sync] Syncing products page${pageInfo ? ` (pageInfo: ${pageInfo.slice(0, 20)}...)` : ' 1'}...`)

    // Fetch one page of products
    const { products: shopifyProducts, nextPageInfo } = await fetchProductsPage(pageInfo)

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    // Process each product and its variants
    for (const product of shopifyProducts) {
      const productImage = product.images[0]?.src || null

      for (const variant of product.variants) {
        // Skip variants without SKU
        if (!variant.sku || variant.sku.trim() === '') {
          skipped++
          continue
        }

        const sku = variant.sku.trim()
        const shopifyProductId = product.id.toString()
        const shopifyVariantId = variant.id.toString()

        // Build product name: "Product Title" or "Product Title - Variant Title"
        const name =
          variant.title === 'Default Title'
            ? product.title
            : `${product.title} - ${variant.title}`

        // Convert weight to lbs
        const weightInLbs = convertToLbs(variant.weight, variant.weight_unit)

        try {
          // Try to find existing product by shopifyVariantId, shopifyProductId, or SKU
          const existingProduct = await prisma.product.findFirst({
            where: {
              OR: [
                { shopifyVariantId },
                { shopifyProductId, shopifyVariantId: null },
                { sku, shopifyProductId: null, shopifyVariantId: null },
              ],
            },
          })

          if (existingProduct) {
            // Update existing product (don't overwrite currentStock)
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                sku,
                name,
                description: product.body_html || null,
                barcode: variant.barcode || null,
                weight: new Prisma.Decimal(weightInLbs),
                imageUrl: productImage,
                shopifyProductId,
                shopifyVariantId,
              },
            })
            updated++
          } else {
            // Create new product
            await prisma.product.create({
              data: {
                sku,
                name,
                description: product.body_html || null,
                barcode: variant.barcode || null,
                weight: new Prisma.Decimal(weightInLbs),
                length: new Prisma.Decimal(0),
                width: new Prisma.Decimal(0),
                height: new Prisma.Decimal(0),
                imageUrl: productImage,
                shopifyProductId,
                shopifyVariantId,
                currentStock: 0,
                lowStockThreshold: 10,
              },
            })
            created++
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Sync] Error processing SKU ${sku}:`, message)
          errors.push(`SKU ${sku}: ${message}`)
        }
      }
    }

    console.log(`[Sync] Page complete: ${created} created, ${updated} updated, ${skipped} skipped`)

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      hasMore: !!nextPageInfo,
      nextPageInfo,
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
