import { prisma } from '@/src/lib/db'
import { ProductsTable } from '@/src/components/ProductsTable'

export default async function InventoryPage() {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      lowStockThreshold: true,
      weight: true,
    },
  })

  const formattedProducts = products.map((product) => ({
    ...product,
    weight: product.weight.toString(),
  }))

  return <ProductsTable products={formattedProducts} />
}
