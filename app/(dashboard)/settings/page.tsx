import { redirect } from 'next/navigation'
import { auth } from '@/src/lib/auth'
import { ShopifySync } from '@/src/components/ShopifySync'

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Only admins can access settings
  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your warehouse settings and integrations
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Shopify Integration */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrations</h2>
          <ShopifySync />
        </section>

        {/* Warehouse Info */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Warehouse Information</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {process.env.WAREHOUSE_ADDRESS_LINE1 || 'Not configured'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">City</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {process.env.WAREHOUSE_CITY || 'Not configured'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">State</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {process.env.WAREHOUSE_STATE || 'Not configured'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ZIP Code</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {process.env.WAREHOUSE_ZIP || 'Not configured'}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-gray-400">
              To update warehouse address, edit the .env.local file
            </p>
          </div>
        </section>

        {/* System Info */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Logged in as</dt>
                <dd className="mt-1 text-sm text-gray-900">{session.user.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{session.user.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {session.user.role}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  )
}
