'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Printer,
  ExternalLink,
  Package,
  Calendar,
  DollarSign,
} from 'lucide-react'

interface Shipment {
  id: string
  createdAt: string
  orderId: string
  orderNumber: string
  customerName: string
  carrier: string
  service: string
  trackingNumber: string | null
  shipmentCost: string
  shippedBy: string
  labelUrl: string | null
}

interface ShipmentsPageClientProps {
  shipments: Shipment[]
  totalShippingCost: string
  currentRange: string
  currentFrom?: string
  currentTo?: string
  currentSearch?: string
}

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  if (carrier === 'UPS') {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`
  }
  if (carrier === 'FedEx') {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
  }
  return '#'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(amount))
}

export function ShipmentsPageClient({
  shipments,
  totalShippingCost,
  currentRange,
  currentFrom,
  currentTo,
  currentSearch,
}: ShipmentsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentSearch || '')
  const [range, setRange] = useState(currentRange)
  const [customFrom, setCustomFrom] = useState(currentFrom || '')
  const [customTo, setCustomTo] = useState(currentTo || '')

  const updateFilters = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    router.push(`/shipments?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: search || undefined })
  }

  const handleRangeChange = (newRange: string) => {
    setRange(newRange)
    if (newRange === 'custom') {
      // Don't update URL until custom dates are set
      return
    }
    updateFilters({
      range: newRange,
      from: undefined,
      to: undefined,
    })
  }

  const handleCustomDateApply = () => {
    if (customFrom && customTo) {
      updateFilters({
        range: 'custom',
        from: customFrom,
        to: customTo,
      })
    }
  }

  const handlePrintLabel = (labelUrl: string) => {
    window.open(labelUrl, '_blank')
  }

  const rangeOptions = [
    { value: 'today', label: 'Today' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage all shipments
        </p>
      </div>

      {/* Stats Card */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Total Shipping Cost ({rangeOptions.find((r) => r.value === range)?.label || 'Selected Period'})
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatCurrency(totalShippingCost)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-100">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order # or tracking #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleRangeChange(option.value)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    range === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Date Range */}
        {range === 'custom' && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCustomDateApply}
              disabled={!customFrom || !customTo}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carrier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tracking #
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shipped By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-4 text-sm text-gray-500">
                      No shipments found for the selected period.
                    </p>
                  </td>
                </tr>
              ) : (
                shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(shipment.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/orders/${shipment.orderId}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {shipment.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shipment.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          shipment.carrier === 'UPS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {shipment.carrier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shipment.service}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {shipment.trackingNumber ? (
                        <a
                          href={getTrackingUrl(shipment.carrier, shipment.trackingNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-mono text-blue-600 hover:text-blue-800"
                        >
                          {shipment.trackingNumber}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(shipment.shipmentCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shipment.shippedBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {shipment.labelUrl && (
                        <button
                          onClick={() => handlePrintLabel(shipment.labelUrl!)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                          Print Label
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
