/**
 * FedEx API Service
 *
 * Uses OAuth 2.0 client_credentials flow for authentication.
 * Production API: https://apis.fedex.com
 *
 * Required environment variables:
 *   - FEDEX_API_KEY (client_id)
 *   - FEDEX_SECRET_KEY (client_secret)
 *   - FEDEX_ACCOUNT_NUMBER
 */

const FEDEX_BASE_URL = 'https://apis.fedex.com'
const FEDEX_OAUTH_URL = `${FEDEX_BASE_URL}/oauth/token`

// In-memory token cache
let cachedToken: {
  accessToken: string
  expiresAt: number // Unix timestamp in ms
} | null = null

interface FedExConfig {
  apiKey: string
  secretKey: string
  accountNumber: string
}

function getConfig(): FedExConfig | null {
  const apiKey = process.env.FEDEX_API_KEY
  const secretKey = process.env.FEDEX_SECRET_KEY
  const accountNumber = process.env.FEDEX_ACCOUNT_NUMBER

  if (!apiKey || !secretKey || !accountNumber) {
    console.warn(
      '[FedEx] Missing credentials. Set FEDEX_API_KEY, FEDEX_SECRET_KEY, and FEDEX_ACCOUNT_NUMBER in environment.'
    )
    return null
  }

  return { apiKey, secretKey, accountNumber }
}

/**
 * Check if FedEx integration is configured
 */
export function isConfigured(): boolean {
  return getConfig() !== null
}

/**
 * Fetch a new OAuth access token from FedEx
 */
async function fetchAccessToken(config: FedExConfig): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.apiKey,
    client_secret: config.secretKey,
  })

  const response = await fetch(FEDEX_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[FedEx] OAuth token request failed:', response.status, errorText)
    throw new Error(`FedEx OAuth failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Cache the token with expiry (subtract 60 seconds buffer)
  const expiresIn = data.expires_in || 3600 // Default 1 hour
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  }

  console.log(`[FedEx] OAuth token obtained, expires in ${expiresIn} seconds`)
  return data.access_token
}

/**
 * Get a valid access token, refreshing if expired
 */
async function getAccessToken(): Promise<string> {
  const config = getConfig()
  if (!config) {
    throw new Error('FedEx is not configured')
  }

  // Check if cached token is still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken
  }

  // Fetch new token
  return fetchAccessToken(config)
}

/**
 * Make an authenticated API request to FedEx
 */
async function fedexRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken()

  const url = endpoint.startsWith('http') ? endpoint : `${FEDEX_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-locale': 'en_US',
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
    console.error(`[FedEx] API Error ${response.status}:`, errorBody)
    throw new FedExError(
      `FedEx API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    )
  }

  return response.json()
}

export class FedExError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'FedExError'
    this.status = status
    this.details = details
  }
}

// ============================================================================
// Rate API Types
// ============================================================================

export interface FedExAddress {
  streetLines?: string[]
  city: string
  stateOrProvinceCode: string
  postalCode: string
  countryCode: string
  residential?: boolean
}

export interface FedExWeight {
  units: 'LB' | 'KG'
  value: number
}

export interface FedExDimensions {
  length: number
  width: number
  height: number
  units: 'IN' | 'CM'
}

export interface FedExRateRequest {
  accountNumber: {
    value: string
  }
  requestedShipment: {
    shipper: {
      address: FedExAddress
    }
    recipient: {
      address: FedExAddress
    }
    pickupType: 'DROPOFF_AT_FEDEX_LOCATION' | 'CONTACT_FEDEX_TO_SCHEDULE' | 'USE_SCHEDULED_PICKUP'
    serviceType?: string // Leave blank to get all available services
    packagingType: 'YOUR_PACKAGING' | 'FEDEX_ENVELOPE' | 'FEDEX_BOX' | 'FEDEX_PAK'
    rateRequestType: ('ACCOUNT' | 'LIST')[]
    requestedPackageLineItems: Array<{
      weight: FedExWeight
      dimensions?: FedExDimensions
    }>
  }
}

export interface FedExRateReply {
  transactionId: string
  output: {
    rateReplyDetails: Array<{
      serviceType: string
      serviceName: string
      packagingType: string
      ratedShipmentDetails: Array<{
        rateType: string
        ratedWeightMethod: string
        totalNetCharge: number
        currency: string
        totalNetChargeWithDutiesAndTaxes?: number
      }>
      commit?: {
        dateDetail?: {
          dayOfWeek?: string
          dayCxsFormat?: string
        }
        transitDays?: {
          minimumTransitTime?: string
          description?: string
        }
      }
    }>
  }
}

// FedEx Service Types
export const FEDEX_SERVICES: Record<string, string> = {
  FEDEX_GROUND: 'FedEx Ground',
  FEDEX_HOME_DELIVERY: 'FedEx Home Delivery',
  FEDEX_EXPRESS_SAVER: 'FedEx Express Saver',
  FEDEX_2_DAY: 'FedEx 2Day',
  FEDEX_2_DAY_AM: 'FedEx 2Day A.M.',
  STANDARD_OVERNIGHT: 'FedEx Standard Overnight',
  PRIORITY_OVERNIGHT: 'FedEx Priority Overnight',
  FIRST_OVERNIGHT: 'FedEx First Overnight',
  FEDEX_FREIGHT_ECONOMY: 'FedEx Freight Economy',
  FEDEX_FREIGHT_PRIORITY: 'FedEx Freight Priority',
  GROUND_HOME_DELIVERY: 'FedEx Ground Home Delivery',
  SMART_POST: 'FedEx SmartPost',
}

// ============================================================================
// Rate API
// ============================================================================

export interface RateResult {
  serviceCode: string
  serviceName: string
  totalCharge: number
  currency: string
  transitDays?: number
  deliveryDate?: string
}

export interface GetRatesResponse {
  rates: RateResult[]
  error?: string
}

/**
 * Get shipping rates from FedEx
 *
 * @param params.shipTo - Customer's shipping address
 * @param params.packages - Array of packages with weight and optional dimensions
 * @returns Object with rates array (sorted by price) and optional error message
 */
export async function getRates(params: {
  shipTo: {
    city: string
    state: string
    postalCode: string
    countryCode: string
    residential?: boolean
  }
  packages: Array<{
    weight: number // in lbs
    length?: number // in inches
    width?: number // in inches
    height?: number // in inches
  }>
}): Promise<GetRatesResponse> {
  const config = getConfig()
  if (!config) {
    return { rates: [], error: 'FedEx is not configured' }
  }

  // Get warehouse address from environment
  const warehouseCity = process.env.WAREHOUSE_CITY || ''
  const warehouseState = process.env.WAREHOUSE_STATE || ''
  const warehouseZip = process.env.WAREHOUSE_ZIP || ''
  const warehouseCountry = process.env.WAREHOUSE_COUNTRY || 'US'

  if (!warehouseCity || !warehouseState || !warehouseZip) {
    return { rates: [], error: 'Warehouse address not configured in environment' }
  }

  try {
    const requestedPackageLineItems = params.packages.map((pkg) => {
      const item: FedExRateRequest['requestedShipment']['requestedPackageLineItems'][0] = {
        weight: {
          units: 'LB',
          value: Math.max(0.1, pkg.weight),
        },
      }

      if (pkg.length && pkg.width && pkg.height) {
        item.dimensions = {
          length: Math.max(1, Math.round(pkg.length)),
          width: Math.max(1, Math.round(pkg.width)),
          height: Math.max(1, Math.round(pkg.height)),
          units: 'IN',
        }
      }

      return item
    })

    const requestBody: FedExRateRequest = {
      accountNumber: {
        value: config.accountNumber,
      },
      requestedShipment: {
        shipper: {
          address: {
            city: warehouseCity,
            stateOrProvinceCode: warehouseState,
            postalCode: warehouseZip,
            countryCode: warehouseCountry,
          },
        },
        recipient: {
          address: {
            city: params.shipTo.city,
            stateOrProvinceCode: params.shipTo.state,
            postalCode: params.shipTo.postalCode,
            countryCode: params.shipTo.countryCode,
            residential: params.shipTo.residential,
          },
        },
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        // serviceType omitted to get all available service options
        packagingType: 'YOUR_PACKAGING',
        rateRequestType: ['ACCOUNT', 'LIST'],
        requestedPackageLineItems,
      },
    }

    console.log('[FedEx] Requesting rates...')

    const response = await fedexRequest<FedExRateReply>('/rate/v1/rates/quotes', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const results: RateResult[] = []

    for (const rateDetail of response.output.rateReplyDetails) {
      // Get the account rate (discounted) or fall back to list rate
      const ratedDetail =
        rateDetail.ratedShipmentDetails.find((d) => d.rateType === 'ACCOUNT') ||
        rateDetail.ratedShipmentDetails[0]

      if (!ratedDetail) continue

      const serviceCode = rateDetail.serviceType
      const serviceName = FEDEX_SERVICES[serviceCode] || rateDetail.serviceName || serviceCode

      let transitDays: number | undefined
      let deliveryDate: string | undefined

      if (rateDetail.commit?.transitDays?.minimumTransitTime) {
        // Parse transit time like "TWO_DAYS" or "ONE_DAY"
        const transitMap: Record<string, number> = {
          ONE_DAY: 1,
          TWO_DAYS: 2,
          THREE_DAYS: 3,
          FOUR_DAYS: 4,
          FIVE_DAYS: 5,
          SIX_DAYS: 6,
          SEVEN_DAYS: 7,
        }
        transitDays = transitMap[rateDetail.commit.transitDays.minimumTransitTime]
      }

      if (rateDetail.commit?.dateDetail?.dayCxsFormat) {
        deliveryDate = rateDetail.commit.dateDetail.dayCxsFormat
      }

      results.push({
        serviceCode,
        serviceName,
        totalCharge: ratedDetail.totalNetCharge,
        currency: ratedDetail.currency,
        transitDays,
        deliveryDate,
      })
    }

    console.log(`[FedEx] Got ${results.length} rates`)
    return { rates: results.sort((a, b) => a.totalCharge - b.totalCharge) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown FedEx error'
    console.error('[FedEx] Failed to get rates:', message)
    return { rates: [], error: `FedEx error: ${message}` }
  }
}

// ============================================================================
// Shipping Label API Types
// ============================================================================

export interface FedExShipmentRequest {
  accountNumber: {
    value: string
  }
  labelResponseOptions: 'URL_ONLY' | 'LABEL'
  requestedShipment: {
    shipper: {
      contact: {
        personName: string
        phoneNumber?: string
        companyName?: string
      }
      address: FedExAddress & { streetLines: string[] }
    }
    recipients: Array<{
      contact: {
        personName: string
        phoneNumber?: string
      }
      address: FedExAddress & { streetLines: string[] }
    }>
    pickupType: 'DROPOFF_AT_FEDEX_LOCATION' | 'CONTACT_FEDEX_TO_SCHEDULE' | 'USE_SCHEDULED_PICKUP'
    serviceType: string
    packagingType: 'YOUR_PACKAGING' | 'FEDEX_ENVELOPE' | 'FEDEX_BOX' | 'FEDEX_PAK'
    shippingChargesPayment: {
      paymentType: 'SENDER' | 'RECIPIENT' | 'THIRD_PARTY'
      payor?: {
        responsibleParty: {
          accountNumber: {
            value: string
          }
        }
      }
    }
    labelSpecification: {
      labelFormatType: 'COMMON2D'
      imageType: 'PNG' | 'PDF' | 'ZPLII'
      labelStockType: 'PAPER_4X6' | 'PAPER_4X675' | 'STOCK_4X6' | 'STOCK_4X675'
    }
    requestedPackageLineItems: Array<{
      weight: FedExWeight
      dimensions?: FedExDimensions
    }>
  }
}

export interface FedExShipmentResponse {
  transactionId: string
  output: {
    transactionShipments: Array<{
      masterTrackingNumber: string
      serviceType: string
      serviceName: string
      shipDatestamp: string
      pieceResponses: Array<{
        trackingNumber: string
        packageDocuments: Array<{
          contentType: string
          encodedLabel?: string
          url?: string
        }>
      }>
      completedShipmentDetail: {
        completedPackageDetails: Array<{
          trackingIds: Array<{
            trackingNumber: string
          }>
        }>
        shipmentRating?: {
          actualRateType: string
          shipmentRateDetails: Array<{
            rateType: string
            totalNetCharge: number
            currency: string
          }>
        }
      }
    }>
  }
}

export interface CreateShipmentResult {
  trackingNumber: string
  labelBase64: string
  labelFormat: 'PNG' | 'PDF' | 'ZPLII'
  cost: number
  currency: string
}

export interface CreateShipmentResponse {
  shipment?: CreateShipmentResult
  error?: string
}

/**
 * Create a shipment and generate a shipping label
 *
 * @param params.serviceCode - FedEx service code (e.g., 'FEDEX_GROUND')
 * @param params.shipTo - Customer's shipping address
 * @param params.packages - Array of packages with weight and dimensions
 * @param params.labelFormat - Label format: 'PNG' (default), 'PDF', or 'ZPLII' (thermal printers)
 * @returns Object with shipment details or error message
 */
export async function createShipment(params: {
  serviceCode: string
  shipTo: {
    name: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    countryCode: string
    phone?: string
    residential?: boolean
  }
  packages: Array<{
    weight: number
    length?: number
    width?: number
    height?: number
  }>
  labelFormat?: 'PNG' | 'PDF' | 'ZPLII'
}): Promise<CreateShipmentResponse> {
  const config = getConfig()
  if (!config) {
    return { error: 'FedEx is not configured' }
  }

  // Get warehouse address from environment
  const warehouseName = process.env.WAREHOUSE_NAME || 'BoxNCase Warehouse'
  const warehouseAddress1 = process.env.WAREHOUSE_ADDRESS1 || ''
  const warehouseAddress2 = process.env.WAREHOUSE_ADDRESS2 || ''
  const warehouseCity = process.env.WAREHOUSE_CITY || ''
  const warehouseState = process.env.WAREHOUSE_STATE || ''
  const warehouseZip = process.env.WAREHOUSE_ZIP || ''
  const warehouseCountry = process.env.WAREHOUSE_COUNTRY || 'US'
  const warehousePhone = process.env.WAREHOUSE_PHONE || ''

  if (!warehouseAddress1 || !warehouseCity || !warehouseState || !warehouseZip) {
    return { error: 'Warehouse address not fully configured in environment' }
  }

  try {
    // Build shipper address
    const shipperStreetLines = [warehouseAddress1]
    if (warehouseAddress2) {
      shipperStreetLines.push(warehouseAddress2)
    }

    // Build recipient address
    const recipientStreetLines = [params.shipTo.addressLine1]
    if (params.shipTo.addressLine2) {
      recipientStreetLines.push(params.shipTo.addressLine2)
    }

    // Build packages
    const requestedPackageLineItems = params.packages.map((pkg) => {
      const item: FedExShipmentRequest['requestedShipment']['requestedPackageLineItems'][0] = {
        weight: {
          units: 'LB',
          value: Math.max(0.1, pkg.weight),
        },
      }

      if (pkg.length && pkg.width && pkg.height) {
        item.dimensions = {
          length: Math.max(1, Math.round(pkg.length)),
          width: Math.max(1, Math.round(pkg.width)),
          height: Math.max(1, Math.round(pkg.height)),
          units: 'IN',
        }
      }

      return item
    })

    const labelImageType = params.labelFormat || 'PNG'

    const requestBody: FedExShipmentRequest = {
      accountNumber: {
        value: config.accountNumber,
      },
      labelResponseOptions: 'LABEL',
      requestedShipment: {
        shipper: {
          contact: {
            personName: warehouseName,
            phoneNumber: warehousePhone || undefined,
            companyName: warehouseName,
          },
          address: {
            streetLines: shipperStreetLines,
            city: warehouseCity,
            stateOrProvinceCode: warehouseState,
            postalCode: warehouseZip,
            countryCode: warehouseCountry,
          },
        },
        recipients: [
          {
            contact: {
              personName: params.shipTo.name,
              phoneNumber: params.shipTo.phone || undefined,
            },
            address: {
              streetLines: recipientStreetLines,
              city: params.shipTo.city,
              stateOrProvinceCode: params.shipTo.state,
              postalCode: params.shipTo.postalCode,
              countryCode: params.shipTo.countryCode,
              residential: params.shipTo.residential,
            },
          },
        ],
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        serviceType: params.serviceCode,
        packagingType: 'YOUR_PACKAGING',
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: {
            responsibleParty: {
              accountNumber: {
                value: config.accountNumber,
              },
            },
          },
        },
        labelSpecification: {
          labelFormatType: 'COMMON2D',
          imageType: labelImageType,
          labelStockType: 'PAPER_4X6',
        },
        requestedPackageLineItems,
      },
    }

    console.log(`[FedEx] Creating shipment with service ${params.serviceCode}...`)

    const response = await fedexRequest<FedExShipmentResponse>('/ship/v1/shipments', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const shipment = response.output.transactionShipments[0]
    const pieceResponse = shipment.pieceResponses[0]
    const trackingNumber = pieceResponse.trackingNumber || shipment.masterTrackingNumber

    // Get the label (base64 encoded)
    const labelDoc = pieceResponse.packageDocuments.find(
      (doc) => doc.encodedLabel || doc.url
    )

    if (!labelDoc?.encodedLabel) {
      return { error: 'No label data returned from FedEx' }
    }

    // Get the shipping cost
    let cost = 0
    let currency = 'USD'
    const ratingDetail = shipment.completedShipmentDetail?.shipmentRating
    if (ratingDetail?.shipmentRateDetails?.length) {
      const rateDetail = ratingDetail.shipmentRateDetails[0]
      cost = rateDetail.totalNetCharge
      currency = rateDetail.currency
    }

    console.log(`[FedEx] Shipment created: ${trackingNumber}`)

    return {
      shipment: {
        trackingNumber,
        labelBase64: labelDoc.encodedLabel,
        labelFormat: labelImageType,
        cost,
        currency,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown FedEx error'
    console.error('[FedEx] Failed to create shipment:', message)
    return { error: `FedEx error: ${message}` }
  }
}

/**
 * Test the FedEx connection by requesting an OAuth token
 */
export async function testConnection(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const config = getConfig()
    if (!config) {
      return { success: false, error: 'FedEx credentials not configured' }
    }

    await getAccessToken()
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
