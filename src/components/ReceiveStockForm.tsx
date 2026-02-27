'use client'

import { useState, useEffect, useRef, useActionState, useTransition } from 'react'
import { Search, Package, CheckCircle, X } from 'lucide-react'
import { searchProducts, receiveStock } from '@/app/(dashboard)/inventory/actions'
import type { ReceiveStockState } from '@/app/(dashboard)/inventory/actions'

interface Product {
  id: string
  sku: string
  name: string
  currentStock: number
  imageUrl: string | null
}

interface RecentReceive {
  id: string
  productSku: string
  productName: string
  quantity: number
  receivedBy: string
  createdAt: string
}

interface ReceiveStockFormProps {
  userId: string
  initialRecentReceives: RecentReceive[]
}

export function ReceiveStockForm({ userId, initialRecentReceives }: ReceiveStockFormProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [successMessage, setSuccessMessage] = useState<ReceiveStockState['success'] | null>(null)
  const [recentReceives, setRecentReceives] = useState(initialRecentReceives)

  const searchRef = useRef<HTMLDivElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const boundReceiveStock = receiveStock.bind(null, userId)
  const [state, formAction] = useActionState(boundReceiveStock, {})
  const [isPending, startTransition] = useTransition()

  // Search for products
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 1) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const results = await searchProducts(searchQuery)
        setSearchResults(results)
        setShowDropdown(true)
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(search, 200)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle success state
  useEffect(() => {
    if (state.success) {
      setSuccessMessage(state.success)
      setSelectedProduct(null)
      setSearchQuery('')
      formRef.current?.reset()

      // Add to recent receives at the top
      const newReceive: RecentReceive = {
        id: Date.now().toString(),
        productSku: selectedProduct?.sku || '',
        productName: state.success.productName,
        quantity: state.success.quantity,
        receivedBy: 'You',
        createdAt: new Date().toISOString(),
      }
      setRecentReceives((prev) => [newReceive, ...prev.slice(0, 19)])

      // Clear success message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [state.success])

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setSearchQuery('')
    setShowDropdown(false)
    // Focus on quantity input
    setTimeout(() => quantityRef.current?.focus(), 100)
  }

  const handleClearProduct = () => {
    setSelectedProduct(null)
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
      formAction(formData)
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
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
        <h1 className="text-2xl font-bold text-gray-900">Receiving</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search for a product and enter the quantity received
        </p>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Received {successMessage.quantity} x {successMessage.productName}
            </p>
            <p className="text-sm text-green-700">
              New stock level: {successMessage.newStock}
            </p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 overflow-visible">
        {state.errors?._form && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            {state.errors._form.map((error, i) => (
              <p key={i} className="text-sm text-red-600">{error}</p>
            ))}
          </div>
        )}

        <form ref={formRef} action={handleSubmit}>
          {/* Product Search */}
          <div className="mb-4" ref={searchRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Product
            </label>

            {!selectedProduct ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Search by SKU or product name..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            SKU: {product.sku} • Stock: {product.currentStock}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && searchQuery && searchResults.length === 0 && !isSearching && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
                    <p className="text-sm text-gray-500">No products found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            ) : (
              /* Selected Product Display */
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-white rounded flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedProduct.name}
                    </p>
                    <p className="text-xs text-gray-600">
                      SKU: {selectedProduct.sku} • Current Stock: {selectedProduct.currentStock}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearProduct}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input type="hidden" name="productId" value={selectedProduct.id} />
              </div>
            )}

            {state.errors?.productId && (
              <p className="mt-1.5 text-sm text-red-600">{state.errors.productId[0]}</p>
            )}
          </div>

          {/* Quantity and Notes in a row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Quantity Input */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1.5">
                Quantity
              </label>
              <input
                ref={quantityRef}
                type="number"
                id="quantity"
                name="quantity"
                min="1"
                placeholder="0"
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                  state.errors?.quantity ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
              {state.errors?.quantity && (
                <p className="mt-1.5 text-sm text-red-600">{state.errors.quantity[0]}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="notes"
                name="notes"
                placeholder="PO number, vendor, etc..."
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedProduct || isPending}
            className="w-full py-2.5 text-sm font-medium text-white bg-[#499C70] rounded-lg hover:bg-[#3d8660] focus:ring-2 focus:ring-green-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Receiving...' : 'Receive Stock'}
          </button>
        </form>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {recentReceives.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No recent receiving activity</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden sm:table-cell">
                      Received By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentReceives.map((receive) => (
                    <tr key={receive.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(receive.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{receive.productName}</p>
                        <p className="text-xs text-gray-500">{receive.productSku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          +{receive.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                        {receive.receivedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
