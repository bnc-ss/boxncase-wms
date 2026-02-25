'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  currentStock: number
  lowStockThreshold: number
  weight: string
}

interface ProductsTableProps {
  products: Product[]
}

function getStockStatus(stock: number, threshold: number) {
  if (stock === 0) {
    return { label: 'Out of Stock', className: 'bg-red-100 text-red-700' }
  }
  if (stock <= threshold) {
    return { label: 'Low Stock', className: 'bg-amber-100 text-amber-700' }
  }
  return { label: 'In Stock', className: 'bg-green-100 text-green-700' }
}

export function ProductsTable({ products }: ProductsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProducts = products.filter(
    (product) =>
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your product inventory
          </p>
        </div>
        <Link
          href="/inventory/products/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by SKU or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Product Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Stock
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                  Weight
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    {searchQuery
                      ? 'No products found matching your search.'
                      : 'No products in inventory. Add your first product to get started.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(
                    product.currentStock,
                    product.lowStockThreshold
                  )

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/inventory/products/${product.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {product.sku}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/inventory/products/${product.id}`}
                          className="text-gray-700 hover:text-blue-600"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {product.currentStock}
                      </td>
                      <td className="hidden px-4 py-3 text-gray-700 md:table-cell">
                        {product.weight} lbs
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      {filteredProducts.length > 0 && (
        <p className="mt-3 text-sm text-gray-500">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      )}
    </div>
  )
}
