'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function SyncOrdersButton() {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setResult(null)

    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({
          success: false,
          message: data.error || 'Failed to sync orders',
        })
        return
      }

      setResult({
        success: true,
        message: `Synced ${data.created} new, ${data.updated} updated orders`,
      })

      // Refresh the page to show new data
      router.refresh()
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync orders',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Orders'}
      </button>

      {result && (
        <div
          className={`absolute top-full left-0 mt-2 px-3 py-2 text-sm rounded-lg whitespace-nowrap ${
            result.success
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
