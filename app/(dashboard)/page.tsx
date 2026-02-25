import { ShoppingCart, Send, AlertTriangle, Package } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBgColor: string
}

function StatCard({ title, value, icon: Icon, iconColor, iconBgColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
}

export default function DashboardPage() {
  // Placeholder data - will be replaced with real data later
  const stats = [
    {
      title: 'Pending Orders',
      value: 24,
      icon: ShoppingCart,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-100',
    },
    {
      title: 'Shipped Today',
      value: 12,
      icon: Send,
      iconColor: 'text-green-600',
      iconBgColor: 'bg-green-100',
    },
    {
      title: 'Low Stock Items',
      value: 8,
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      iconBgColor: 'bg-amber-100',
    },
    {
      title: 'Total Products',
      value: 156,
      icon: Package,
      iconColor: 'text-purple-600',
      iconBgColor: 'bg-purple-100',
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to your warehouse management dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
    </div>
  )
}
