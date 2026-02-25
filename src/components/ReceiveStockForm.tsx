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
        <h1 className="text-2xl font-bold text-gray-900">Receive Stock</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search for a product and enter the quantity received
        </p>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-4">
          <CheckCircle className="h-10 w-10 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xl font-semibold text-green-800">
              ✓ Received {successMessage.quantity} x {successMessage.productName}
            </p>
            <p className="text-lg text-green-700">
              New stock level: {successMessage.newStock}
            </p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        {state.errors?._form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            {state.errors._form.map((error, i) => (
              <p key={i} className="text-red-600 font-medium">{error}</p>
            ))}
          </div>
        )}

        <form ref={formRef} action={handleSubmit}>
          {/* Product Search */}
          <div className="mb-6" ref={searchRef}>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              Search Product
            </label>

            {!selectedProduct ? (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Type SKU, product name, or barcode..."
                  className="w-full pl-14 pr-4 py-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-medium text-gray-900 truncate">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            SKU: {product.sku} • Stock: {product.currentStock}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && searchQuery && searchResults.length === 0 && !isSearching && (
                  <div className="absolute z-10 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg p-6 text-center">
                    <p className="text-gray-500">No products found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            ) : (
              /* Selected Product Display */
              <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center">
                      <Package className="h-10 w-10 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-xl font-semibold text-gray-900">
                      {selectedProduct.name}
                    </p>
                    <p className="text-lg text-gray-600">
                      SKU: {selectedProduct.sku}
                    </p>
                    <p className="text-lg text-gray-600">
                      Current Stock: <span className="font-semibold">{selectedProduct.currentStock}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearProduct}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <input type="hidden" name="productId" value={selectedProduct.id} />
              </div>
            )}

            {state.errors?.productId && (
              <p className="mt-2 text-red-600">{state.errors.productId[0]}</p>
            )}
          </div>

          {/* Quantity Input */}
          <div className="mb-6">
            <label htmlFor="quantity" className="block text-lg font-medium text-gray-700 mb-2">
              Quantity Received
            </label>
            <input
              ref={quantityRef}
              type="number"
              id="quantity"
              name="quantity"
              min="1"
              placeholder="Enter quantity..."
              className={`w-full px-6 py-5 text-3xl font-semibold border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center ${
                state.errors?.quantity ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {state.errors?.quantity && (
              <p className="mt-2 text-red-600">{state.errors.quantity[0]}</p>
            )}
          </div>

          {/* Notes */}
          <div className="mb-8">
            <label htmlFor="notes" className="block text-lg font-medium text-gray-700 mb-2">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              id="notes"
              name="notes"
              placeholder="PO number, vendor, etc..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedProduct || isPending}
            className="w-full py-5 text-2xl font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Receiving...' : 'Receive Stock'}
          </button>
        </form>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Receiving Activity</h2>
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
