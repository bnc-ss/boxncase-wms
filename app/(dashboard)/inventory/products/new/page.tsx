import { ProductForm } from '@/src/components/ProductForm'
import { createProduct } from '../../actions'

export default function NewProductPage() {
  return (
    <ProductForm
      action={createProduct}
      title="Add New Product"
      submitLabel="Create Product"
    />
  )
}
