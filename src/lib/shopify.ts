const SHOPIFY_API_VERSION = '2024-10'

function getConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

  if (!storeDomain || !accessToken) {
    throw new Error('Missing Shopify configuration: SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN')
  }

  return {
    baseUrl: `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}`,
    accessToken,
  }
}

// Rate limiting: Shopify allows 2 requests/second for REST API
async function rateLimit() {
  await new Promise((resolve) => setTimeout(resolve, 500))
}

// Parse Link header for pagination
function parseLinkHeader(linkHeader: string | null): { next?: string; previous?: string } {
  if (!linkHeader) return {}

  const links: { next?: string; previous?: string } = {}
  const parts = linkHeader.split(',')

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match) {
      const [, url, rel] = match
      if (rel === 'next') links.next = url
      if (rel === 'previous') links.previous = url
    }
  }

  return links
}

// Extract page_info from URL
function getPageInfo(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('page_info')
  } catch {
    return null
  }
}

class ShopifyAPIError extends Error {
  status: number
  errors?: unknown

  constructor(message: string, status: number, errors?: unknown) {
    super(message)
    this.name = 'ShopifyAPIError'
    this.status = status
    this.errors = errors
  }
}

async function shopifyFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; links: { next?: string; previous?: string } }> {
  const { baseUrl, accessToken } = getConfig()

  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...options.headers,
    },
  })

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      errorBody = await response.text()
    }

    console.error(`[Shopify] API Error ${response.status}:`, errorBody)
    throw new ShopifyAPIError(
      `Shopify API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    )
  }

  const data = await response.json()
  const linkHeader = response.headers.get('Link')
  const links = parseLinkHeader(linkHeader)

  return { data, links }
}

// Types

export interface ShopifyProduct {
  id: number
  title: string
  body_html: string | null
  vendor: string
  product_type: string
  created_at: string
  updated_at: string
  status: string
  variants: ShopifyVariant[]
  images: ShopifyImage[]
}

export interface ShopifyVariant {
  id: number
  product_id: number
  title: string
  price: string
  sku: string
  barcode: string | null
  weight: number
  weight_unit: string
  inventory_quantity: number
}

export interface ShopifyImage {
  id: number
  product_id: number
  src: string
  alt: string | null
}

export interface ShopifyOrder {
  id: number
  name: string // order number like #1001
  email: string
  created_at: string
  updated_at: string
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
  line_items: ShopifyLineItem[]
  fulfillments: ShopifyFulfillment[]
}

export interface ShopifyLineItem {
  id: number
  product_id: number | null
  variant_id: number | null
  title: string
  sku: string
  quantity: number
  price: string
  fulfillable_quantity: number
  fulfillment_status: string | null
}

export interface ShopifyFulfillment {
  id: number
  order_id: number
  status: string
  tracking_number: string | null
  tracking_url: string | null
  tracking_company: string | null
}

// API Functions

/**
 * Fetch all products with pagination
 * @param sinceId - Only return products after this ID (for incremental sync)
 */
export async function fetchProducts(sinceId?: string): Promise<ShopifyProduct[]> {
  console.log('[Shopify] Fetching products...')
  const allProducts: ShopifyProduct[] = []
  let endpoint = '/products.json?limit=250'

  if (sinceId) {
    endpoint += `&since_id=${sinceId}`
  }

  let pageCount = 0

  while (endpoint) {
    pageCount++
    console.log(`[Shopify] Fetching products page ${pageCount}...`)

    const { data, links } = await shopifyFetch<{ products: ShopifyProduct[] }>(endpoint)
    allProducts.push(...data.products)

    if (links.next) {
      const pageInfo = getPageInfo(links.next)
      if (pageInfo) {
        endpoint = `/products.json?limit=250&page_info=${pageInfo}`
        await rateLimit()
      } else {
        endpoint = ''
      }
    } else {
      endpoint = ''
    }
  }

  console.log(`[Shopify] Fetched ${allProducts.length} products in ${pageCount} pages`)
  return allProducts
}

/**
 * Fetch orders with pagination
 * @param status - Filter by status: open, closed, cancelled, any
 * @param sinceId - Only return orders after this ID
 */
export async function fetchOrders(
  status: 'open' | 'closed' | 'cancelled' | 'any' = 'any',
  sinceId?: string
): Promise<ShopifyOrder[]> {
  console.log(`[Shopify] Fetching orders (status: ${status})...`)
  const allOrders: ShopifyOrder[] = []
  let endpoint = `/orders.json?limit=250&status=${status}`

  if (sinceId) {
    endpoint += `&since_id=${sinceId}`
  }

  let pageCount = 0

  while (endpoint) {
    pageCount++
    console.log(`[Shopify] Fetching orders page ${pageCount}...`)

    const { data, links } = await shopifyFetch<{ orders: ShopifyOrder[] }>(endpoint)
    allOrders.push(...data.orders)

    if (links.next) {
      const pageInfo = getPageInfo(links.next)
      if (pageInfo) {
        endpoint = `/orders.json?limit=250&status=${status}&page_info=${pageInfo}`
        await rateLimit()
      } else {
        endpoint = ''
      }
    } else {
      endpoint = ''
    }
  }

  console.log(`[Shopify] Fetched ${allOrders.length} orders in ${pageCount} pages`)
  return allOrders
}

/**
 * Fetch a single order with all details
 * @param orderId - Shopify order ID
 */
export async function fetchOrder(orderId: string | number): Promise<ShopifyOrder> {
  console.log(`[Shopify] Fetching order ${orderId}...`)

  const { data } = await shopifyFetch<{ order: ShopifyOrder }>(`/orders/${orderId}.json`)

  console.log(`[Shopify] Fetched order ${data.order.name}`)
  return data.order
}

/**
 * Create a fulfillment for an order (marks it as shipped in Shopify)
 * @param orderId - Shopify order ID
 * @param trackingNumber - Tracking number
 * @param carrier - Carrier name (e.g., "UPS", "FedEx")
 * @param trackingUrl - Tracking URL (optional)
 */
export async function createFulfillment(
  orderId: string | number,
  trackingNumber: string,
  carrier: string,
  trackingUrl?: string
): Promise<ShopifyFulfillment> {
  console.log(`[Shopify] Creating fulfillment for order ${orderId}...`)

  // First, get the order to find fulfillment order IDs (required for newer API)
  const { data: fulfillmentOrdersData } = await shopifyFetch<{
    fulfillment_orders: Array<{
      id: number
      status: string
      line_items: Array<{
        id: number
        fulfillable_quantity: number
      }>
    }>
  }>(`/orders/${orderId}/fulfillment_orders.json`)

  const openFulfillmentOrders = fulfillmentOrdersData.fulfillment_orders.filter(
    (fo) => fo.status === 'open' || fo.status === 'in_progress'
  )

  if (openFulfillmentOrders.length === 0) {
    throw new ShopifyAPIError('No open fulfillment orders found', 400)
  }

  // Build line items by fulfillment order
  const lineItemsByFulfillmentOrder = openFulfillmentOrders.map((fo) => ({
    fulfillment_order_id: fo.id,
    fulfillment_order_line_items: fo.line_items
      .filter((li) => li.fulfillable_quantity > 0)
      .map((li) => ({
        id: li.id,
        quantity: li.fulfillable_quantity,
      })),
  }))

  const fulfillmentPayload = {
    fulfillment: {
      line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
      tracking_info: {
        number: trackingNumber,
        company: carrier,
        url: trackingUrl,
      },
      notify_customer: true,
    },
  }

  await rateLimit()

  const { data } = await shopifyFetch<{ fulfillment: ShopifyFulfillment }>(
    '/fulfillments.json',
    {
      method: 'POST',
      body: JSON.stringify(fulfillmentPayload),
    }
  )

  console.log(`[Shopify] Created fulfillment ${data.fulfillment.id} for order ${orderId}`)
  return data.fulfillment
}

/**
 * Test the Shopify connection
 */
export async function testConnection(): Promise<{ success: boolean; shopName?: string; error?: string }> {
  try {
    const { data } = await shopifyFetch<{ shop: { name: string; email: string } }>('/shop.json')
    console.log(`[Shopify] Connected to shop: ${data.shop.name}`)
    return { success: true, shopName: data.shop.name }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Shopify] Connection test failed:', message)
    return { success: false, error: message }
  }
}

// Webhook Management

export interface ShopifyWebhook {
  id: number
  address: string
  topic: string
  created_at: string
  updated_at: string
  format: string
  api_version: string
}

/**
 * List all registered webhooks
 */
export async function listWebhooks(): Promise<ShopifyWebhook[]> {
  const { data } = await shopifyFetch<{ webhooks: ShopifyWebhook[] }>('/webhooks.json')
  return data.webhooks
}

/**
 * Create a new webhook
 * @param topic - Webhook topic (e.g., 'orders/create')
 * @param address - URL to receive the webhook
 */
export async function createWebhook(topic: string, address: string): Promise<ShopifyWebhook> {
  const { data } = await shopifyFetch<{ webhook: ShopifyWebhook }>('/webhooks.json', {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: 'json',
      },
    }),
  })
  console.log(`[Shopify] Created webhook for ${topic} -> ${address}`)
  return data.webhook
}

/**
 * Delete a webhook
 * @param webhookId - Webhook ID to delete
 */
export async function deleteWebhook(webhookId: number): Promise<void> {
  await shopifyFetch(`/webhooks/${webhookId}.json`, {
    method: 'DELETE',
  })
  console.log(`[Shopify] Deleted webhook ${webhookId}`)
}

/**
 * Register all required webhooks for the WMS
 * @param baseUrl - Base URL of your application (e.g., 'https://your-domain.com')
 */
export async function registerWebhooks(baseUrl: string): Promise<{
  created: string[]
  existing: string[]
  errors: string[]
}> {
  const webhookTopics = [
    'orders/create',
    'orders/updated',
    'orders/cancelled',
  ]

  const ordersEndpoint = `${baseUrl}/api/webhooks/shopify/orders`

  // Get existing webhooks
  const existingWebhooks = await listWebhooks()
  const existingTopics = new Set(existingWebhooks.map((w) => w.topic))

  const created: string[] = []
  const existing: string[] = []
  const errors: string[] = []

  for (const topic of webhookTopics) {
    if (existingTopics.has(topic)) {
      existing.push(topic)
      continue
    }

    try {
      await createWebhook(topic, ordersEndpoint)
      created.push(topic)
      await rateLimit()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${topic}: ${message}`)
    }
  }

  return { created, existing, errors }
}
