'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface Order {
  id: string
  shopifyOrderId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'CANCELLED' | 'ON_HOLD'
  totalPrice: string
  currency: string
  itemCount: number
  stockStatus: 'ready' | 'issue'
  createdAt: string
}

interface StatusCounts {
  all: number
  PENDING: number
  PROCESSING: number
  SHIPPED: number
  CANCELLED: number
  ON_HOLD: number
}

interface OrdersPageClientProps {
  orders: Order[]
  statusCounts: StatusCounts
  currentStatus: string
  currentSearch: string
  currentPage: number
  totalPages: number
  totalOrders: number
}

const statusConfig = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
  ON_HOLD: { label: 'On Hold', className: 'bg-red-100 text-red-800' },
}

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

export function OrdersPageClient({
  orders,
  statusCounts,
  currentStatus,
  currentSearch,
  currentPage,
  totalPages,
  totalOrders,
}: OrdersPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(currentSearch)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const updateUrl = (updates: { status?: string; search?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.status !== undefined) {
      if (updates.status === 'all') {
        params.delete('status')
      } else {
        params.set('status', updates.status)
      }
      params.delete('page') // Reset to page 1 when filtering
    }

    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
      } else {
        params.set('search', updates.search)
      }
      params.delete('page') // Reset to page 1 when searching
    }

    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }

    startTransition(() => {
      router.push(`/orders?${params.toString()}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateUrl({ search: searchInput })
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setSyncResult({
          success: true,
          message: `Synced ${data.orders?.created || 0} new, ${data.orders?.updated || 0} updated`,
        })
        router.refresh()
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Sync failed',
        })
      }
    } catch {
      setSyncResult({
        success: false,
        message: 'Failed to sync orders',
      })
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  const handleRowClick = (orderId: string) => {
    router.push(`/orders/${orderId}`)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const startOrder = (currentPage - 1) * 50 + 1
  const endOrder = Math.min(currentPage * 50, totalOrders)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and fulfill customer orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          {syncResult && (
            <span
              className={`text-sm ${
                syncResult.success ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {syncResult.message}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from Shopify'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => {
            const count = statusCounts[tab.key as keyof StatusCounts]
            const isActive = currentStatus === tab.key

            return (
              <button
                key={tab.key}
                onClick={() => updateUrl({ status: tab.key })}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    isActive
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order # or customer name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchInput !== currentSearch && (
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Search
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${
          isPending ? 'opacity-60' : ''
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Order #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                  Items
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Stock
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    {currentSearch || currentStatus !== 'all'
                      ? 'No orders found matching your filters.'
                      : 'No orders yet. Click "Sync from Shopify" to import orders.'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const status = statusConfig[order.status]

                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleRowClick(order.id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-blue-600">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {order.customerName}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-600 sm:table-cell">
                        {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {order.stockStatus === 'ready' ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            Stock Issue
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {startOrder} to {endOrder} of {totalOrders} orders
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateUrl({ page: currentPage - 1 })}
              disabled={currentPage === 1 || isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => updateUrl({ page: currentPage + 1 })}
              disabled={currentPage === totalPages || isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Results count for single page */}
      {totalPages <= 1 && orders.length > 0 && (
        <p className="mt-3 text-sm text-gray-500">
          Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
