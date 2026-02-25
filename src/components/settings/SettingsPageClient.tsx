'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  ShoppingBag,
  RefreshCw,
  Webhook,
  Truck,
  CheckCircle,
  XCircle,
  MapPin,
  AlertCircle,
  X,
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: string
  lastLogin: string
  createdAt: string
}

interface SettingsPageClientProps {
  currentUserId: string
  users: User[]
  carriersConfig: {
    ups: { configured: boolean }
    fedex: { configured: boolean }
  }
  shopifyConfig: {
    configured: boolean
    storeDomain: string
  }
  warehouseAddress: {
    name: string
    address1: string
    address2: string
    city: string
    state: string
    zip: string
    country: string
    phone: string
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function SettingsPageClient({
  currentUserId,
  users,
  carriersConfig,
  shopifyConfig,
  warehouseAddress,
}: SettingsPageClientProps) {
  const router = useRouter()

  // User management state
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
  })
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState('')

  // Shopify state
  const [syncProductsLoading, setSyncProductsLoading] = useState(false)
  const [syncProductsResult, setSyncProductsResult] = useState<string | null>(null)
  const [syncOrdersLoading, setSyncOrdersLoading] = useState(false)
  const [syncOrdersResult, setSyncOrdersResult] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState(
    typeof window !== 'undefined' ? window.location.origin : ''
  )
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<string | null>(null)

  // Carrier test state
  const [upsTestLoading, setUpsTestLoading] = useState(false)
  const [upsTestResult, setUpsTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [fedexTestLoading, setFedexTestLoading] = useState(false)
  const [fedexTestResult, setFedexTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // User management functions
  const openAddUserModal = () => {
    setEditingUser(null)
    setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE' })
    setUserError('')
    setShowUserModal(true)
  }

  const openEditUserModal = (user: User) => {
    setEditingUser(user)
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setUserError('')
    setShowUserModal(true)
  }

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserLoading(true)
    setUserError('')

    try {
      const url = editingUser
        ? `/api/users/${editingUser.id}`
        : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const body: Record<string, string> = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
      }
      if (userForm.password) {
        body.password = userForm.password
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setUserError(data.error || 'Failed to save user')
        return
      }

      setShowUserModal(false)
      router.refresh()
    } catch {
      setUserError('Failed to save user')
    } finally {
      setUserLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete user')
        return
      }

      router.refresh()
    } catch {
      alert('Failed to delete user')
    }
  }

  // Shopify functions
  const handleSyncProducts = async () => {
    setSyncProductsLoading(true)
    setSyncProductsResult(null)

    try {
      const response = await fetch('/api/shopify/sync-products', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        setSyncProductsResult(`Error: ${data.error}`)
        return
      }

      setSyncProductsResult(`Synced ${data.created} new, ${data.updated} updated products`)
      router.refresh()
    } catch {
      setSyncProductsResult('Error: Failed to sync products')
    } finally {
      setSyncProductsLoading(false)
    }
  }

  const handleSyncOrders = async () => {
    setSyncOrdersLoading(true)
    setSyncOrdersResult(null)

    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        setSyncOrdersResult(`Error: ${data.error}`)
        return
      }

      setSyncOrdersResult(`Synced ${data.created} new, ${data.updated} updated orders`)
      router.refresh()
    } catch {
      setSyncOrdersResult('Error: Failed to sync orders')
    } finally {
      setSyncOrdersLoading(false)
    }
  }

  const handleRegisterWebhooks = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)

    try {
      const response = await fetch('/api/shopify/register-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: webhookUrl }),
      })
      const data = await response.json()

      if (!response.ok) {
        setWebhookResult(`Error: ${data.error}`)
        return
      }

      setWebhookResult(`Created ${data.created} webhooks (${data.existing} already existed)`)
    } catch {
      setWebhookResult('Error: Failed to register webhooks')
    } finally {
      setWebhookLoading(false)
    }
  }

  // Carrier test functions
  const handleTestUps = async () => {
    setUpsTestLoading(true)
    setUpsTestResult(null)

    try {
      const response = await fetch('/api/carriers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier: 'UPS' }),
      })
      const data = await response.json()

      setUpsTestResult({
        success: response.ok,
        message: response.ok
          ? `Success! Got ${data.rateCount} rates`
          : data.error || 'Test failed',
      })
    } catch {
      setUpsTestResult({ success: false, message: 'Test failed' })
    } finally {
      setUpsTestLoading(false)
    }
  }

  const handleTestFedex = async () => {
    setFedexTestLoading(true)
    setFedexTestResult(null)

    try {
      const response = await fetch('/api/carriers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier: 'FedEx' }),
      })
      const data = await response.json()

      setFedexTestResult({
        success: response.ok,
        message: response.ok
          ? `Success! Got ${data.rateCount} rates`
          : data.error || 'Test failed',
      })
    } catch {
      setFedexTestResult({ success: false, message: 'Test failed' })
    } finally {
      setFedexTestLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage users, integrations, and system configuration
        </p>
      </div>

      <div className="space-y-8">
        {/* User Management Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">User Management</h2>
            </div>
            <button
              onClick={openAddUserModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Add Employee
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-gray-500">(you)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditUserModal(user)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.id !== currentUserId && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Shopify Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Shopify Integration</h2>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Connection Status */}
            <div className="flex items-center gap-4">
              {shopifyConfig.configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Connected</p>
                    <p className="text-sm text-gray-500">{shopifyConfig.storeDomain}</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Not Connected</p>
                    <p className="text-sm text-gray-500">
                      Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in environment
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Sync Buttons */}
            <div className="flex flex-wrap gap-4">
              <div>
                <button
                  onClick={handleSyncProducts}
                  disabled={syncProductsLoading || !shopifyConfig.configured}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${syncProductsLoading ? 'animate-spin' : ''}`} />
                  Sync Products
                </button>
                {syncProductsResult && (
                  <p className={`mt-2 text-sm ${syncProductsResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {syncProductsResult}
                  </p>
                )}
              </div>

              <div>
                <button
                  onClick={handleSyncOrders}
                  disabled={syncOrdersLoading || !shopifyConfig.configured}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${syncOrdersLoading ? 'animate-spin' : ''}`} />
                  Sync Orders
                </button>
                {syncOrdersResult && (
                  <p className={`mt-2 text-sm ${syncOrdersResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {syncOrdersResult}
                  </p>
                )}
              </div>
            </div>

            {/* Webhook Registration */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Webhook Registration</h3>
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-sm text-gray-600 mb-1">Base URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-domain.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleRegisterWebhooks}
                  disabled={webhookLoading || !shopifyConfig.configured}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Webhook className={`h-4 w-4 ${webhookLoading ? 'animate-spin' : ''}`} />
                  Register Webhooks
                </button>
              </div>
              {webhookResult && (
                <p className={`mt-2 text-sm ${webhookResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {webhookResult}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Carriers Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Shipping Carriers</h2>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* UPS */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                {carriersConfig.ups.configured ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">UPS</p>
                  <p className="text-sm text-gray-500">
                    {carriersConfig.ups.configured
                      ? 'Configured'
                      : 'Not configured - set UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {upsTestResult && (
                  <span className={`text-sm ${upsTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {upsTestResult.message}
                  </span>
                )}
                <button
                  onClick={handleTestUps}
                  disabled={upsTestLoading || !carriersConfig.ups.configured}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {upsTestLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
            </div>

            {/* FedEx */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                {carriersConfig.fedex.configured ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">FedEx</p>
                  <p className="text-sm text-gray-500">
                    {carriersConfig.fedex.configured
                      ? 'Configured'
                      : 'Not configured - set FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET, FEDEX_ACCOUNT_NUMBER'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {fedexTestResult && (
                  <span className={`text-sm ${fedexTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {fedexTestResult.message}
                  </span>
                )}
                <button
                  onClick={handleTestFedex}
                  disabled={fedexTestLoading || !carriersConfig.fedex.configured}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {fedexTestLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Warehouse Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Warehouse Address</h2>
            </div>
          </div>
          <div className="p-6">
            {warehouseAddress.address1 ? (
              <div className="space-y-2">
                {warehouseAddress.name && (
                  <p className="text-sm font-medium text-gray-900">{warehouseAddress.name}</p>
                )}
                <p className="text-sm text-gray-700">{warehouseAddress.address1}</p>
                {warehouseAddress.address2 && (
                  <p className="text-sm text-gray-700">{warehouseAddress.address2}</p>
                )}
                <p className="text-sm text-gray-700">
                  {warehouseAddress.city}, {warehouseAddress.state} {warehouseAddress.zip}
                </p>
                <p className="text-sm text-gray-700">{warehouseAddress.country}</p>
                {warehouseAddress.phone && (
                  <p className="text-sm text-gray-500">{warehouseAddress.phone}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Warehouse address not configured</p>
              </div>
            )}
            <p className="mt-4 text-xs text-gray-400">
              To update warehouse address, edit the environment variables:
              WAREHOUSE_NAME, WAREHOUSE_ADDRESS1, WAREHOUSE_ADDRESS2, WAREHOUSE_CITY,
              WAREHOUSE_STATE, WAREHOUSE_ZIP, WAREHOUSE_COUNTRY, WAREHOUSE_PHONE
            </p>
          </div>
        </section>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowUserModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <button
              onClick={() => setShowUserModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingUser ? 'Edit User' : 'Add Employee'}
            </h3>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser && <span className="text-gray-400">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!editingUser}
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {userError && (
                <p className="text-sm text-red-600">{userError}</p>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {userLoading ? 'Saving...' : editingUser ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
