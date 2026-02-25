'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Truck,
  Printer,
  Clock,
  DollarSign,
  MapPin,
  ExternalLink,
  Loader2,
  PauseCircle,
  XOctagon,
  PlayCircle,
} from 'lucide-react'
import {
  fulfillOrder,
  putOrderOnHold,
  cancelOrder,
  resumeOrder,
} from '@/app/(dashboard)/orders/[id]/actions'

interface OrderItem {
  id: string
  productId: string | null
  sku: string
  name: string
  quantity: number
  price: string
  currentStock: number
  hasProduct: boolean
}

interface Shipment {
  id: string
  carrier: string
  service: string
  trackingNumber: string | null
  labelUrl: string | null
  shipmentCost: string
  createdAt: string
  shippedBy: string
}

interface ShippingAddress {
  address1: string
  address2: string | null
  city: string
  state: string
  zip: string
  country: string
}

interface WarehouseAddress {
  name: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
}

interface Order {
  id: string
  shopifyOrderId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'CANCELLED' | 'ON_HOLD'
  totalPrice: string
  currency: string
  createdAt: string
  shippingAddress: ShippingAddress
  items: OrderItem[]
  shipments: Shipment[]
  totalWeight: number
}

interface ShippingRate {
  id: string
  carrier: 'UPS' | 'FedEx' | 'USPS'
  service: string
  serviceCode: string
  price: number
  currency: string
  estimatedDays: number
  estimatedDelivery: string
}

interface OrderFulfillmentProps {
  order: Order
  warehouseAddress: WarehouseAddress
  userId: string
}

const statusConfig = {
  PENDING: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  SHIPPED: {
    label: 'Shipped',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  ON_HOLD: {
    label: 'On Hold',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
}

const carrierLogos: Record<string, string> = {
  UPS: '📦',
  FedEx: '📮',
  USPS: '✉️',
}

export function OrderFulfillment({
  order,
  warehouseAddress,
  userId,
}: OrderFulfillmentProps) {
  const router = useRouter()
  const [isLoadingRates, setIsLoadingRates] = useState(false)
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [ratesError, setRatesError] = useState<string | null>(null)
  const [isShipping, setIsShipping] = useState<string | null>(null) // rate ID being processed
  const [shipSuccess, setShipSuccess] = useState<{
    trackingNumber: string
    labelUrl: string
  } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check stock status
  const stockIssues = order.items.filter(
    (item) => !item.hasProduct || item.currentStock < item.quantity
  )
  const allInStock = stockIssues.length === 0
  const canFulfill =
    allInStock && (order.status === 'PENDING' || order.status === 'PROCESSING')

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatCurrency = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount))
  }

  const handleGetRates = async () => {
    setIsLoadingRates(true)
    setRatesError(null)
    setRates([])

    try {
      const response = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          weight: order.totalWeight || 1,
          fromZip: warehouseAddress.zip,
          toZip: order.shippingAddress.zip,
          toCountry: order.shippingAddress.country,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get rates')
      }

      setRates(data.rates)
    } catch (err) {
      setRatesError(err instanceof Error ? err.message : 'Failed to get rates')
    } finally {
      setIsLoadingRates(false)
    }
  }

  const handleShipWithRate = async (rate: ShippingRate) => {
    setIsShipping(rate.id)
    setError(null)

    try {
      // 1. Generate the label
      const labelResponse = await fetch('/api/shipping/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          carrier: rate.carrier,
          serviceCode: rate.serviceCode,
          shipFrom: warehouseAddress,
          shipTo: {
            name: order.customerName,
            address1: order.shippingAddress.address1,
            address2: order.shippingAddress.address2,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            zip: order.shippingAddress.zip,
            country: order.shippingAddress.country,
          },
          weight: order.totalWeight || 1,
        }),
      })

      const labelData = await labelResponse.json()

      if (!labelResponse.ok) {
        throw new Error(labelData.error || 'Failed to generate label')
      }

      // 2. Fulfill the order (create shipment, decrement inventory, mark shipped)
      const result = await fulfillOrder({
        orderId: order.id,
        carrier: rate.carrier,
        service: rate.service,
        trackingNumber: labelData.trackingNumber,
        labelUrl: labelData.labelUrl,
        shipmentCost: rate.price,
        userId,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to fulfill order')
      }

      setShipSuccess({
        trackingNumber: labelData.trackingNumber,
        labelUrl: labelData.labelUrl,
      })

      // Refresh the page data
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ship order')
    } finally {
      setIsShipping(null)
    }
  }

  const handlePutOnHold = async () => {
    setActionLoading('hold')
    setError(null)
    try {
      const result = await putOrderOnHold(order.id)
      if (!result.success) {
        throw new Error('Failed to put order on hold')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return

    setActionLoading('cancel')
    setError(null)
    try {
      const result = await cancelOrder(order.id)
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel order')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResume = async () => {
    setActionLoading('resume')
    setError(null)
    try {
      const result = await resumeOrder(order.id)
      if (!result.success) {
        throw new Error('Failed to resume order')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume order')
    } finally {
      setActionLoading(null)
    }
  }

  const status = statusConfig[order.status]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      {/* Success Banner */}
      {shipSuccess && (
        <div className="mb-6 rounded-xl bg-green-50 border-2 border-green-200 p-6">
          <div className="flex items-start gap-4">
            <CheckCircle className="h-8 w-8 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-800">
                Order Shipped Successfully!
              </h3>
              <p className="mt-1 text-green-700">
                Tracking Number:{' '}
                <span className="font-mono font-bold">
                  {shipSuccess.trackingNumber}
                </span>
              </p>
              <div className="mt-4">
                <a
                  href={shipSuccess.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Printer className="h-5 w-5" />
                  Print Label
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Top Section - Order Info */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Order Details */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {order.orderNumber}
              </h1>
              <p className="mt-1 text-lg text-gray-600">{order.customerName}</p>
              <p className="text-sm text-gray-500">{order.customerEmail}</p>
              <p className="mt-2 text-sm text-gray-500">
                Ordered {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex px-4 py-2 rounded-full text-lg font-semibold border ${status.className}`}
              >
                {status.label}
              </span>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {formatCurrency(order.totalPrice, order.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Ship To</h2>
          </div>
          <div className="text-gray-700">
            <p className="font-medium">{order.customerName}</p>
            <p>{order.shippingAddress.address1}</p>
            {order.shippingAddress.address2 && (
              <p>{order.shippingAddress.address2}</p>
            )}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.zip}
            </p>
            <p>{order.shippingAddress.country}</p>
          </div>
        </div>
      </div>

      {/* Stock Status Banner */}
      {allInStock ? (
        <div className="mb-6 rounded-xl bg-green-50 border-2 border-green-200 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <span className="text-lg font-semibold text-green-800">
              All items in stock — Ready to ship
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-xl bg-red-50 border-2 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-lg font-semibold text-red-800">
                Stock Issue — Cannot ship
              </span>
              <ul className="mt-2 space-y-1">
                {stockIssues.map((item) => (
                  <li key={item.id} className="text-red-700">
                    {item.name} ({item.sku}): Need {item.quantity}, only{' '}
                    {item.hasProduct ? item.currentStock : '0 (not in system)'}{' '}
                    available
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Items Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">
              Items ({order.items.length})
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  SKU
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Qty Ordered
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  In Stock
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items.map((item) => {
                const inStock = item.hasProduct && item.currentStock >= item.quantity

                return (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {item.sku || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {item.hasProduct ? (
                        <span
                          className={
                            item.currentStock >= item.quantity
                              ? 'text-green-600 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {item.currentStock}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {inStock ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircle className="h-5 w-5" />
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Section - Only show when can fulfill */}
      {canFulfill && !shipSuccess && order.status !== 'SHIPPED' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Shipping</h2>
          </div>

          {rates.length === 0 && !isLoadingRates && (
            <button
              onClick={handleGetRates}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Get Shipping Rates
            </button>
          )}

          {isLoadingRates && (
            <div className="flex items-center gap-3 text-gray-600">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Getting rates from carriers...</span>
            </div>
          )}

          {ratesError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-red-800">{ratesError}</p>
              <button
                onClick={handleGetRates}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {rates.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {rates.length} rates found — cheapest option highlighted
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rates.map((rate, index) => {
                  const isCheapest = index === 0
                  const isProcessing = isShipping === rate.id

                  return (
                    <div
                      key={rate.id}
                      className={`relative rounded-xl border-2 p-4 transition-all ${
                        isCheapest
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {isCheapest && (
                        <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">
                          BEST PRICE
                        </span>
                      )}

                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-2xl mr-2">
                            {carrierLogos[rate.carrier]}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {rate.carrier}
                          </span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">
                          ${rate.price.toFixed(2)}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {rate.service}
                      </p>

                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
                        <Clock className="h-4 w-4" />
                        <span>
                          {rate.estimatedDays} day
                          {rate.estimatedDays > 1 ? 's' : ''} —{' '}
                          {rate.estimatedDelivery}
                        </span>
                      </div>

                      <button
                        onClick={() => handleShipWithRate(rate)}
                        disabled={isShipping !== null}
                        className={`w-full py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isCheapest
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {isProcessing ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </span>
                        ) : (
                          `Ship with ${rate.carrier}`
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shipment History */}
      {order.shipments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Shipment History</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {order.shipments.map((shipment) => (
              <div key={shipment.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {shipment.carrier} — {shipment.service}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Tracking:{' '}
                      <span className="font-mono">
                        {shipment.trackingNumber}
                      </span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Shipped {formatDate(shipment.createdAt)} by{' '}
                      {shipment.shippedBy}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      ${parseFloat(shipment.shipmentCost).toFixed(2)}
                    </p>
                    {shipment.labelUrl && (
                      <a
                        href={shipment.labelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Printer className="h-4 w-4" />
                        Print Label
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            Order Actions
          </h3>
          <div className="flex flex-wrap gap-3">
            {order.status === 'ON_HOLD' && (
              <button
                onClick={handleResume}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
              >
                {actionLoading === 'resume' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Resume Order
              </button>
            )}

            {order.status !== 'ON_HOLD' && (
              <button
                onClick={handlePutOnHold}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50"
              >
                {actionLoading === 'hold' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PauseCircle className="h-4 w-4" />
                )}
                Put on Hold
              </button>
            )}

            <button
              onClick={handleCancel}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading === 'cancel' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XOctagon className="h-4 w-4" />
              )}
              Cancel Order
            </button>
          </div>
        </div>
      )}

      {/* Cancelled/Shipped info */}
      {order.status === 'CANCELLED' && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
          <XOctagon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">This order has been cancelled</p>
        </div>
      )}
    </div>
  )
}
