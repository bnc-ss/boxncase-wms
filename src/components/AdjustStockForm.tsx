'use client'

import { useState, useEffect, useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { adjustStock } from '@/app/(dashboard)/inventory/actions'
import type { AdjustStockState } from '@/app/(dashboard)/inventory/actions'

interface Product {
  id: string
  sku: string
  name: string
  currentStock: number
}

interface AdjustStockFormProps {
  product: Product
  userId: string
}

export function AdjustStockForm({ product, userId }: AdjustStockFormProps) {
  const router = useRouter()
  const [newStock, setNewStock] = useState<string>(product.currentStock.toString())
  const [showSuccess, setShowSuccess] = useState(false)

  const boundAdjustStock = adjustStock.bind(null, product.id, userId)
  const [state, formAction, isPending] = useActionState(boundAdjustStock, {})

  const currentStock = product.currentStock
  const newStockNum = parseInt(newStock) || 0
  const adjustment = newStockNum - currentStock

  useEffect(() => {
    if (state.success) {
      setShowSuccess(true)
      const timer = setTimeout(() => {
        router.push(`/inventory/products/${product.id}`)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [state.success, router, product.id])

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/inventory/products/${product.id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Product
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Adjust Stock</h1>
      </div>

      {/* Success Message */}
      {showSuccess && state.success && (
        <div className="mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-4">
          <CheckCircle className="h-10 w-10 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-xl font-semibold text-green-800">
              Stock adjusted successfully
            </p>
            <p className="text-lg text-green-700">
              {state.success.previousStock} → {state.success.newStock}
              {state.success.adjustment !== 0 && (
                <span className={state.success.adjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                  {' '}({state.success.adjustment > 0 ? '+' : ''}{state.success.adjustment})
                </span>
              )}
            </p>
            <p className="text-sm text-green-600 mt-1">Redirecting...</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl">
        {/* Product Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xl font-semibold text-gray-900">{product.name}</p>
          <p className="text-gray-600">SKU: {product.sku}</p>
          <p className="text-lg mt-2">
            Current Stock: <span className="font-bold text-2xl">{currentStock}</span>
          </p>
        </div>

        {state.errors?._form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            {state.errors._form.map((error, i) => (
              <p key={i} className="text-red-600 font-medium">{error}</p>
            ))}
          </div>
        )}

        <form action={formAction}>
          {/* New Stock Input */}
          <div className="mb-6">
            <label htmlFor="newStock" className="block text-lg font-medium text-gray-700 mb-2">
              New Stock Count
            </label>
            <input
              type="number"
              id="newStock"
              name="newStock"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className={`w-full px-6 py-4 text-3xl font-semibold border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center ${
                state.errors?.newStock ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {state.errors?.newStock && (
              <p className="mt-2 text-red-600">{state.errors.newStock[0]}</p>
            )}

            {/* Adjustment Preview */}
            {newStock !== '' && !isNaN(newStockNum) && (
              <div className="mt-4 p-4 rounded-lg bg-gray-100">
                <p className="text-center text-lg">
                  Adjustment:{' '}
                  {adjustment === 0 ? (
                    <span className="font-semibold text-gray-600">No change</span>
                  ) : adjustment > 0 ? (
                    <span className="font-bold text-2xl text-green-600">+{adjustment}</span>
                  ) : (
                    <span className="font-bold text-2xl text-red-600">{adjustment}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Notes/Reason */}
          <div className="mb-8">
            <label htmlFor="notes" className="block text-lg font-medium text-gray-700 mb-2">
              Reason for Adjustment <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="e.g., Physical count correction, damaged items, etc."
              className={`w-full px-4 py-3 text-lg border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none ${
                state.errors?.notes ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {state.errors?.notes && (
              <p className="mt-2 text-red-600">{state.errors.notes[0]}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isPending || adjustment === 0}
              className="flex-1 py-4 text-xl font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Saving...' : 'Save Adjustment'}
            </button>
            <Link
              href={`/inventory/products/${product.id}`}
              className="px-6 py-4 text-lg font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
