import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/src/lib/db'
import { ProductForm } from '@/src/components/ProductForm'
import { updateProduct } from '../../actions'
import { Package, ArrowLeftRight } from 'lucide-react'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      barcode: true,
      weight: true,
      length: true,
      width: true,
      height: true,
      lowStockThreshold: true,
      imageUrl: true,
      currentStock: true,
    },
  })

  if (!product) {
    notFound()
  }

  const productData = {
    ...product,
    weight: product.weight.toString(),
    length: product.length.toString(),
    width: product.width.toString(),
    height: product.height.toString(),
  }

  const boundUpdateProduct = updateProduct.bind(null, product.id)

  const isLowStock = product.currentStock <= product.lowStockThreshold
  const isOutOfStock = product.currentStock === 0

  return (
    <div>
      {/* Stock Info Card */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${isOutOfStock ? 'bg-red-100' : isLowStock ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Package className={`h-6 w-6 ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Stock</p>
              <p className={`text-3xl font-bold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>
                {product.currentStock}
              </p>
            </div>
          </div>
          <Link
            href={`/inventory/products/${product.id}/adjust`}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Adjust Stock
          </Link>
        </div>
        {isLowStock && !isOutOfStock && (
          <p className="mt-3 text-sm text-amber-600">
            ⚠ Stock is below threshold ({product.lowStockThreshold})
          </p>
        )}
        {isOutOfStock && (
          <p className="mt-3 text-sm text-red-600">
            ⚠ This product is out of stock
          </p>
        )}
      </div>

      <ProductForm
        product={productData}
        action={boundUpdateProduct}
        title="Edit Product"
        submitLabel="Save Changes"
      />
    </div>
  )
}
