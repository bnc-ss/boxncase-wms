'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

interface SyncResult {
  success: boolean
  created?: number
  updated?: number
  skipped?: number
  total?: number
  errors?: string[]
  error?: string
}

export function ShopifySync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setResult(null)

    try {
      const response = await fetch('/api/shopify/sync-products', {
        method: 'POST',
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync products',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Shopify Product Sync</h3>
          <p className="mt-1 text-sm text-gray-500">
            Import and update products from your Shopify store. This will not overwrite your
            current stock levels.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Products'}
        </button>
      </div>

      {result && (
        <div className="mt-4">
          {result.success ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Sync completed successfully</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                <div>
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-sm text-green-600">Created</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-sm text-blue-600">Updated</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-700">{result.skipped}</p>
                  <p className="text-sm text-gray-600">Skipped</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-sm font-medium text-amber-700 mb-1">
                    {result.errors.length} items had errors:
                  </p>
                  <ul className="text-sm text-amber-600 list-disc list-inside">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
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
