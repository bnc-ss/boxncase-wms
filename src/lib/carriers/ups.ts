/**
 * UPS API Service
 *
 * Uses OAuth 2.0 client_credentials flow for authentication.
 * Production API: https://onlinetools.ups.com
 *
 * Required environment variables:
 *   - UPS_CLIENT_ID
 *   - UPS_CLIENT_SECRET
 *   - UPS_ACCOUNT_NUMBER
 */

const UPS_BASE_URL = 'https://onlinetools.ups.com'
const UPS_OAUTH_URL = `${UPS_BASE_URL}/security/v1/oauth/token`

// In-memory token cache
let cachedToken: {
  accessToken: string
  expiresAt: number // Unix timestamp in ms
} | null = null

interface UPSConfig {
  clientId: string
  clientSecret: string
  accountNumber: string
}

function getConfig(): UPSConfig | null {
  const clientId = process.env.UPS_CLIENT_ID
  const clientSecret = process.env.UPS_CLIENT_SECRET
  const accountNumber = process.env.UPS_ACCOUNT_NUMBER

  if (!clientId || !clientSecret || !accountNumber) {
    console.warn(
      '[UPS] Missing credentials. Set UPS_CLIENT_ID, UPS_CLIENT_SECRET, and UPS_ACCOUNT_NUMBER in environment.'
    )
    return null
  }

  return { clientId, clientSecret, accountNumber }
}

/**
 * Check if UPS integration is configured
 */
export function isConfigured(): boolean {
  return getConfig() !== null
}

/**
 * Fetch a new OAuth access token from UPS
 */
async function fetchAccessToken(config: UPSConfig): Promise<string> {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString('base64')

  const response = await fetch(UPS_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[UPS] OAuth token request failed:', response.status, errorText)
    throw new Error(`UPS OAuth failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Cache the token with expiry (subtract 60 seconds buffer)
  const expiresIn = data.expires_in || 3600 // Default 1 hour
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  }

  console.log(`[UPS] OAuth token obtained, expires in ${expiresIn} seconds`)
  return data.access_token
}

/**
 * Get a valid access token, refreshing if expired
 */
async function getAccessToken(): Promise<string> {
  const config = getConfig()
  if (!config) {
    throw new Error('UPS is not configured')
  }

  // Check if cached token is still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken
  }

  // Fetch new token
  return fetchAccessToken(config)
}

/**
 * Make an authenticated API request to UPS
 */
async function upsRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken()

  const url = endpoint.startsWith('http') ? endpoint : `${UPS_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      transId: `boxncase-${Date.now()}`,
      transactionSrc: 'BoxNCase WMS',
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
    console.error(`[UPS] API Error ${response.status}:`, errorBody)
    throw new UPSError(
      `UPS API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    )
  }

  return response.json()
}

export class UPSError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'UPSError'
    this.status = status
    this.details = details
  }
}

// ============================================================================
// Rate API Types
// ============================================================================

export interface UPSAddress {
  addressLine?: string[]
  city: string
  stateProvinceCode: string
  postalCode: string
  countryCode: string
}

export interface UPSPackage {
  packagingType: {
    code: string // '02' = Customer Supplied Package
  }
  dimensions?: {
    unitOfMeasurement: { code: string } // 'IN' for inches
    length: string
    width: string
    height: string
  }
  packageWeight: {
    unitOfMeasurement: { code: string } // 'LBS' for pounds
    weight: string
  }
}

export interface UPSRateRequest {
  RateRequest: {
    Request: {
      RequestOption: string // 'Shop' = all services, 'Rate' = specific service
      SubVersion?: string
      TransactionReference?: {
        CustomerContext?: string
      }
    }
    Shipment: {
      Shipper: {
        Name?: string
        ShipperNumber: string
        Address: UPSAddress
      }
      ShipTo: {
        Name?: string
        Address: UPSAddress
      }
      ShipFrom: {
        Name?: string
        Address: UPSAddress
      }
      PaymentDetails?: {
        ShipmentCharge: {
          Type: string
          BillShipper: {
            AccountNumber: string
          }
        }[]
      }
      Service?: {
        Code: string
      }
      Package: UPSPackage[]
    }
  }
}

export interface UPSRatedShipment {
  Service: {
    Code: string
    Description?: string
  }
  RatedPackage?: Array<{
    TotalCharges: {
      CurrencyCode: string
      MonetaryValue: string
    }
  }>
  TotalCharges: {
    CurrencyCode: string
    MonetaryValue: string
  }
  GuaranteedDelivery?: {
    BusinessDaysInTransit: string
    DeliveryByTime?: string
  }
  TimeInTransit?: {
    ServiceSummary?: {
      EstimatedArrival?: {
        Arrival?: {
          Date?: string
          Time?: string
        }
        BusinessDaysInTransit?: string
      }
    }
  }
}

export interface UPSRateResponse {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: string
        Description: string
      }
    }
    RatedShipment: UPSRatedShipment | UPSRatedShipment[]
  }
}

// UPS Service Codes
export const UPS_SERVICES: Record<string, string> = {
  '01': 'UPS Next Day Air',
  '02': 'UPS 2nd Day Air',
  '03': 'UPS Ground',
  '12': 'UPS 3 Day Select',
  '13': 'UPS Next Day Air Saver',
  '14': 'UPS Next Day Air Early',
  '59': 'UPS 2nd Day Air A.M.',
  '65': 'UPS Saver',
}

// ============================================================================
// Rate API
// ============================================================================

export interface RateResult {
  serviceCode: string
  serviceName: string
  totalCharge: number
  currency: string
  businessDaysInTransit?: number
  estimatedDeliveryDate?: string
}

export interface GetRatesResponse {
  rates: RateResult[]
  error?: string
}

/**
 * Get shipping rates from UPS using the Shop option (returns all available services)
 *
 * @param params.shipTo - Customer's shipping address
 * @param params.packages - Array of packages with weight and optional dimensions
 * @returns Object with rates array (sorted by price) and optional error message
 */
export async function getRates(params: {
  shipTo: {
    name?: string
    city: string
    state: string
    postalCode: string
    countryCode: string
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
    return { rates: [], error: 'UPS is not configured' }
  }

  // Get warehouse address from environment
  const warehouseName = process.env.WAREHOUSE_NAME || 'BoxNCase Warehouse'
  const warehouseCity = process.env.WAREHOUSE_CITY || ''
  const warehouseState = process.env.WAREHOUSE_STATE || ''
  const warehouseZip = process.env.WAREHOUSE_ZIP || ''
  const warehouseCountry = process.env.WAREHOUSE_COUNTRY || 'US'

  if (!warehouseCity || !warehouseState || !warehouseZip) {
    return { rates: [], error: 'Warehouse address not configured in environment' }
  }

  try {
    const upsPackages: UPSPackage[] = params.packages.map((pkg) => {
      const upsPackage: UPSPackage = {
        packagingType: { code: '02' }, // Customer Supplied Package
        packageWeight: {
          unitOfMeasurement: { code: 'LBS' },
          weight: Math.max(0.1, pkg.weight).toFixed(1), // Minimum 0.1 lbs
        },
      }

      if (pkg.length && pkg.width && pkg.height) {
        upsPackage.dimensions = {
          unitOfMeasurement: { code: 'IN' },
          length: Math.max(1, pkg.length).toFixed(0),
          width: Math.max(1, pkg.width).toFixed(0),
          height: Math.max(1, pkg.height).toFixed(0),
        }
      }

      return upsPackage
    })

    const requestBody: UPSRateRequest = {
      RateRequest: {
        Request: {
          RequestOption: 'Shop', // Get all available service rates
          SubVersion: '2403',
          TransactionReference: {
            CustomerContext: `BoxNCase-${Date.now()}`,
          },
        },
        Shipment: {
          Shipper: {
            Name: warehouseName,
            ShipperNumber: config.accountNumber,
            Address: {
              city: warehouseCity,
              stateProvinceCode: warehouseState,
              postalCode: warehouseZip,
              countryCode: warehouseCountry,
            },
          },
          ShipTo: {
            Name: params.shipTo.name || 'Customer',
            Address: {
              city: params.shipTo.city,
              stateProvinceCode: params.shipTo.state,
              postalCode: params.shipTo.postalCode,
              countryCode: params.shipTo.countryCode,
            },
          },
          ShipFrom: {
            Name: warehouseName,
            Address: {
              city: warehouseCity,
              stateProvinceCode: warehouseState,
              postalCode: warehouseZip,
              countryCode: warehouseCountry,
            },
          },
          PaymentDetails: {
            ShipmentCharge: [
              {
                Type: '01', // Transportation
                BillShipper: {
                  AccountNumber: config.accountNumber,
                },
              },
            ],
          },
          Package: upsPackages,
        },
      },
    }

    console.log('[UPS] Requesting rates...')

    const response = await upsRequest<UPSRateResponse>('/api/rating/v2403/Rate', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    // Normalize response (can be single object or array)
    const ratedShipments = Array.isArray(response.RateResponse.RatedShipment)
      ? response.RateResponse.RatedShipment
      : [response.RateResponse.RatedShipment]

    const results: RateResult[] = ratedShipments.map((shipment) => {
      const serviceCode = shipment.Service.Code
      const serviceName = UPS_SERVICES[serviceCode] || `UPS Service ${serviceCode}`
      const totalCharge = parseFloat(shipment.TotalCharges.MonetaryValue)
      const currency = shipment.TotalCharges.CurrencyCode

      let businessDaysInTransit: number | undefined
      let estimatedDeliveryDate: string | undefined

      if (shipment.GuaranteedDelivery?.BusinessDaysInTransit) {
        businessDaysInTransit = parseInt(shipment.GuaranteedDelivery.BusinessDaysInTransit)
      } else if (shipment.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit) {
        businessDaysInTransit = parseInt(
          shipment.TimeInTransit.ServiceSummary.EstimatedArrival.BusinessDaysInTransit
        )
      }

      if (shipment.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Date) {
        estimatedDeliveryDate = shipment.TimeInTransit.ServiceSummary.EstimatedArrival.Arrival.Date
      }

      return {
        serviceCode,
        serviceName,
        totalCharge,
        currency,
        businessDaysInTransit,
        estimatedDeliveryDate,
      }
    })

    console.log(`[UPS] Got ${results.length} rates`)
    return { rates: results.sort((a, b) => a.totalCharge - b.totalCharge) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown UPS error'
    console.error('[UPS] Failed to get rates:', message)
    return { rates: [], error: `UPS error: ${message}` }
  }
}

// ============================================================================
// Shipping Label API Types
// ============================================================================

export interface UPSShipmentRequest {
  ShipmentRequest: {
    Request: {
      SubVersion?: string
      TransactionReference?: {
        CustomerContext?: string
      }
    }
    Shipment: {
      Description?: string
      Shipper: {
        Name: string
        AttentionName?: string
        ShipperNumber: string
        Phone?: {
          Number: string
        }
        Address: UPSAddress & { addressLine: string[] }
      }
      ShipTo: {
        Name: string
        AttentionName?: string
        Phone?: {
          Number: string
        }
        Address: UPSAddress & { addressLine: string[] }
      }
      ShipFrom: {
        Name: string
        AttentionName?: string
        Phone?: {
          Number: string
        }
        Address: UPSAddress & { addressLine: string[] }
      }
      PaymentInformation: {
        ShipmentCharge: {
          Type: string
          BillShipper: {
            AccountNumber: string
          }
        }[]
      }
      Service: {
        Code: string
        Description?: string
      }
      Package: Array<{
        Description?: string
        Packaging: {
          Code: string
        }
        Dimensions?: {
          UnitOfMeasurement: { Code: string }
          Length: string
          Width: string
          Height: string
        }
        PackageWeight: {
          UnitOfMeasurement: { Code: string }
          Weight: string
        }
      }>
    }
    LabelSpecification: {
      LabelImageFormat: {
        Code: string // 'PNG', 'GIF', 'ZPL'
      }
      LabelStockSize?: {
        Height: string
        Width: string
      }
    }
  }
}

export interface UPSShipmentResponse {
  ShipmentResponse: {
    Response: {
      ResponseStatus: {
        Code: string
        Description: string
      }
    }
    ShipmentResults: {
      ShipmentCharges: {
        TotalCharges: {
          CurrencyCode: string
          MonetaryValue: string
        }
      }
      ShipmentIdentificationNumber: string
      PackageResults: Array<{
        TrackingNumber: string
        ShippingLabel: {
          ImageFormat: {
            Code: string
          }
          GraphicImage: string // Base64 encoded
        }
      }>
    }
  }
}

export interface CreateShipmentResult {
  trackingNumber: string
  labelBase64: string // Base64 encoded label image
  labelFormat: 'PNG' | 'GIF' | 'ZPL'
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
 * Endpoint: POST /api/shipments/v2403/ship
 *
 * @param params.serviceCode - UPS service code (e.g., '03' for Ground)
 * @param params.shipTo - Customer's shipping address
 * @param params.packages - Array of packages with weight and dimensions
 * @param params.labelFormat - Label format: 'PNG' (default), 'GIF', or 'ZPL' (thermal printers)
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
  }
  packages: Array<{
    weight: number // in lbs
    length?: number // in inches
    width?: number // in inches
    height?: number // in inches
    description?: string
  }>
  labelFormat?: 'PNG' | 'GIF' | 'ZPL'
}): Promise<CreateShipmentResponse> {
  const config = getConfig()
  if (!config) {
    return { error: 'UPS is not configured' }
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
    // Build shipper/shipFrom address lines
    const shipFromAddress: string[] = [warehouseAddress1]
    if (warehouseAddress2) {
      shipFromAddress.push(warehouseAddress2)
    }

    // Build shipTo address lines
    const shipToAddress: string[] = [params.shipTo.addressLine1]
    if (params.shipTo.addressLine2) {
      shipToAddress.push(params.shipTo.addressLine2)
    }

    // Build packages
    const packages = params.packages.map((pkg) => {
      const upsPackage: UPSShipmentRequest['ShipmentRequest']['Shipment']['Package'][0] = {
        Description: pkg.description || 'Package',
        Packaging: { Code: '02' }, // Customer Supplied Package
        PackageWeight: {
          UnitOfMeasurement: { Code: 'LBS' },
          Weight: Math.max(0.1, pkg.weight).toFixed(1),
        },
      }

      if (pkg.length && pkg.width && pkg.height) {
        upsPackage.Dimensions = {
          UnitOfMeasurement: { Code: 'IN' },
          Length: Math.max(1, pkg.length).toFixed(0),
          Width: Math.max(1, pkg.width).toFixed(0),
          Height: Math.max(1, pkg.height).toFixed(0),
        }
      }

      return upsPackage
    })

    const requestBody: UPSShipmentRequest = {
      ShipmentRequest: {
        Request: {
          SubVersion: '2403',
          TransactionReference: {
            CustomerContext: `BoxNCase-${Date.now()}`,
          },
        },
        Shipment: {
          Description: 'BoxNCase Order',
          Shipper: {
            Name: warehouseName,
            ShipperNumber: config.accountNumber,
            Phone: warehousePhone ? { Number: warehousePhone } : undefined,
            Address: {
              addressLine: shipFromAddress,
              city: warehouseCity,
              stateProvinceCode: warehouseState,
              postalCode: warehouseZip,
              countryCode: warehouseCountry,
            },
          },
          ShipTo: {
            Name: params.shipTo.name,
            Phone: params.shipTo.phone ? { Number: params.shipTo.phone } : undefined,
            Address: {
              addressLine: shipToAddress,
              city: params.shipTo.city,
              stateProvinceCode: params.shipTo.state,
              postalCode: params.shipTo.postalCode,
              countryCode: params.shipTo.countryCode,
            },
          },
          ShipFrom: {
            Name: warehouseName,
            Phone: warehousePhone ? { Number: warehousePhone } : undefined,
            Address: {
              addressLine: shipFromAddress,
              city: warehouseCity,
              stateProvinceCode: warehouseState,
              postalCode: warehouseZip,
              countryCode: warehouseCountry,
            },
          },
          PaymentInformation: {
            ShipmentCharge: [
              {
                Type: '01', // Transportation charges
                BillShipper: {
                  AccountNumber: config.accountNumber,
                },
              },
            ],
          },
          Service: {
            Code: params.serviceCode,
            Description: UPS_SERVICES[params.serviceCode],
          },
          Package: packages,
        },
        LabelSpecification: {
          LabelImageFormat: {
            Code: params.labelFormat || 'PNG',
          },
          LabelStockSize: {
            Height: '6', // 4x6 label
            Width: '4',
          },
        },
      },
    }

    console.log(`[UPS] Creating shipment with service ${params.serviceCode}...`)

    const response = await upsRequest<UPSShipmentResponse>('/api/shipments/v2403/ship', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const results = response.ShipmentResponse.ShipmentResults
    const packageResult = results.PackageResults[0]

    console.log(`[UPS] Shipment created: ${packageResult.TrackingNumber}`)

    return {
      shipment: {
        trackingNumber: packageResult.TrackingNumber,
        labelBase64: packageResult.ShippingLabel.GraphicImage,
        labelFormat: packageResult.ShippingLabel.ImageFormat.Code as 'PNG' | 'GIF' | 'ZPL',
        cost: parseFloat(results.ShipmentCharges.TotalCharges.MonetaryValue),
        currency: results.ShipmentCharges.TotalCharges.CurrencyCode,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown UPS error'
    console.error('[UPS] Failed to create shipment:', message)
    return { error: `UPS error: ${message}` }
  }
}

/**
 * Test the UPS connection by requesting an OAuth token
 */
export async function testConnection(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const config = getConfig()
    if (!config) {
      return { success: false, error: 'UPS credentials not configured' }
    }

    await getAccessToken()
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
