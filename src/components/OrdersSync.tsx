'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

interface SyncResult {
  success: boolean
  orders?: {
    created: number
    updated: number
    total: number
  }
  lineItems?: {
    created: number
    updated: number
    total: number
  }
  errors?: string[]
  error?: string
}

interface OrdersSyncProps {
  onSyncComplete?: () => void
}

export function OrdersSync({ onSyncComplete }: OrdersSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setResult(null)

    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
      })

      const data = await response.json()
      setResult(data)

      if (data.success && onSyncComplete) {
        onSyncComplete()
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync orders',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Orders'}
      </button>

      {result && (
        <div className="mt-4">
          {result.success ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Sync completed</span>
              </div>
              <div className="text-sm text-green-700">
                <p>Orders: {result.orders?.created} created, {result.orders?.updated} updated</p>
                <p>Line items: {result.lineItems?.created} created, {result.lineItems?.updated} updated</p>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-sm font-medium text-amber-700">
                    {result.errors.length} errors occurred
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Sync failed</span>
              </div>
              <p className="mt-1 text-sm text-red-600">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
