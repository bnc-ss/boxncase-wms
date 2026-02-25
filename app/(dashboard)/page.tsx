import Link from 'next/link'
import { prisma } from '@/src/lib/db'
import {
  ShoppingCart,
  Send,
  AlertTriangle,
  PackageX,
  RefreshCw,
  PackagePlus,
  List,
} from 'lucide-react'
import { SyncOrdersButton } from '@/src/components/dashboard/SyncOrdersButton'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBgColor: string
  href?: string
}

function StatCard({ title, value, icon: Icon, iconColor, iconBgColor, href }: StatCardProps) {
  const content = (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${iconBgColor}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
  ON_HOLD: { label: 'On Hold', className: 'bg-red-100 text-red-800' },
}

export default async function DashboardPage() {
  // Get today's date range for "Shipped Today"
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Fetch all stats in parallel
  const [
    pendingOrdersCount,
    shippedTodayCount,
    lowStockCount,
    outOfStockCount,
    recentOrders,
    lowStockProducts,
  ] = await Promise.all([
    // Pending orders
    prisma.order.count({
      where: { status: 'PENDING' },
    }),
    // Shipped today
    prisma.shipment.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
    // Low stock (at or below threshold but not zero)
    prisma.product.count({
      where: {
        currentStock: { gt: 0 },
        AND: {
          currentStock: { lte: prisma.product.fields.lowStockThreshold },
        },
      },
    }),
    // Out of stock
    prisma.product.count({
      where: { currentStock: 0 },
    }),
    // Recent orders (last 10)
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        createdAt: true,
      },
    }),
    // Low stock products
    prisma.product.findMany({
      where: {
        OR: [
          { currentStock: 0 },
          {
            currentStock: { gt: 0 },
            AND: {
              currentStock: { lte: prisma.product.fields.lowStockThreshold },
            },
          },
        ],
      },
      orderBy: { currentStock: 'asc' },
      take: 10,
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        lowStockThreshold: true,
      },
    }),
  ])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to your warehouse management dashboard
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 flex flex-wrap gap-3">
        <SyncOrdersButton />
        <Link
          href="/inventory/receive"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <PackagePlus className="h-4 w-4" />
          Receive Stock
        </Link>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <List className="h-4 w-4" />
          View All Orders
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Pending Orders"
          value={pendingOrdersCount}
          icon={ShoppingCart}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          href="/orders?status=PENDING"
        />
        <StatCard
          title="Shipped Today"
          value={shippedTodayCount}
          icon={Send}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockCount}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-100"
          href="/inventory?filter=low-stock"
        />
        <StatCard
          title="Out of Stock"
          value={outOfStockCount}
          icon={PackageX}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
          href="/inventory?filter=out-of-stock"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link
              href="/orders"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentOrders.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No orders yet. Sync from Shopify to get started.
              </div>
            ) : (
              recentOrders.map((order) => {
                const status = statusConfig[order.status] || statusConfig.PENDING
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">
                          {order.orderNumber}
                        </span>
                        <p className="text-sm text-gray-500">{order.customerName}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Low Stock Items</h2>
            <Link
              href="/inventory"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View inventory
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {lowStockProducts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                All products are well stocked.
              </div>
            ) : (
              lowStockProducts.map((product) => {
                const isOutOfStock = product.currentStock === 0
                return (
                  <Link
                    key={product.id}
                    href={`/inventory/products/${product.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">
                          {product.name}
                        </span>
                        <p className="text-sm text-gray-500 font-mono">
                          {product.sku}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            isOutOfStock ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {isOutOfStock ? (
                            <PackageX className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          {product.currentStock}
                        </span>
                        <p className="text-xs text-gray-400">
                          Threshold: {product.lowStockThreshold}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
