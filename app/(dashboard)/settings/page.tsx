import { auth } from '@/src/lib/auth'
import { prisma } from '@/src/lib/db'
import { redirect } from 'next/navigation'
import { SettingsPageClient } from '@/src/components/settings/SettingsPageClient'
import * as ups from '@/src/lib/carriers/ups'
import * as fedex from '@/src/lib/carriers/fedex'

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Not Authorized</h1>
          <p className="mt-2 text-gray-500">
            You do not have permission to access this page.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Only administrators can access settings.
          </p>
        </div>
      </div>
    )
  }

  // Fetch all users
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const usersData = users.map((u) => ({
    id: u.id,
    name: u.name || '',
    email: u.email || '',
    role: u.role,
    lastLogin: u.updatedAt.toISOString(),
    createdAt: u.createdAt.toISOString(),
  }))

  // Get carrier configuration status
  const carriersConfig = {
    ups: {
      configured: ups.isConfigured(),
    },
    fedex: {
      configured: fedex.isConfigured(),
    },
  }

  // Get Shopify configuration
  const shopifyConfig = {
    configured: !!(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN),
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
  }

  // Get warehouse address from environment
  const warehouseAddress = {
    name: process.env.WAREHOUSE_NAME || '',
    address1: process.env.WAREHOUSE_ADDRESS1 || '',
    address2: process.env.WAREHOUSE_ADDRESS2 || '',
    city: process.env.WAREHOUSE_CITY || '',
    state: process.env.WAREHOUSE_STATE || '',
    zip: process.env.WAREHOUSE_ZIP || '',
    country: process.env.WAREHOUSE_COUNTRY || 'US',
    phone: process.env.WAREHOUSE_PHONE || '',
  }

  return (
    <SettingsPageClient
      currentUserId={currentUser.id}
      users={usersData}
      carriersConfig={carriersConfig}
      shopifyConfig={shopifyConfig}
      warehouseAddress={warehouseAddress}
    />
  )
}
