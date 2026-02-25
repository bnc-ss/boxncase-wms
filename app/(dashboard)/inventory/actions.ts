'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/src/lib/db'
import { Prisma } from '@/app/generated/prisma/client'

export type ProductFormState = {
  errors?: {
    sku?: string[]
    name?: string[]
    description?: string[]
    barcode?: string[]
    weight?: string[]
    length?: string[]
    width?: string[]
    height?: string[]
    lowStockThreshold?: string[]
    imageUrl?: string[]
    _form?: string[]
  }
  success?: boolean
}

function validateProductData(formData: FormData): ProductFormState['errors'] {
  const errors: ProductFormState['errors'] = {}

  const sku = formData.get('sku') as string
  const name = formData.get('name') as string
  const weight = formData.get('weight') as string
  const length = formData.get('length') as string
  const width = formData.get('width') as string
  const height = formData.get('height') as string
  const lowStockThreshold = formData.get('lowStockThreshold') as string

  if (!sku || sku.trim() === '') {
    errors.sku = ['SKU is required']
  }

  if (!name || name.trim() === '') {
    errors.name = ['Product name is required']
  }

  if (!weight || isNaN(parseFloat(weight)) || parseFloat(weight) < 0) {
    errors.weight = ['Weight must be a valid positive number']
  }

  if (!length || isNaN(parseFloat(length)) || parseFloat(length) < 0) {
    errors.length = ['Length must be a valid positive number']
  }

  if (!width || isNaN(parseFloat(width)) || parseFloat(width) < 0) {
    errors.width = ['Width must be a valid positive number']
  }

  if (!height || isNaN(parseFloat(height)) || parseFloat(height) < 0) {
    errors.height = ['Height must be a valid positive number']
  }

  if (lowStockThreshold && (isNaN(parseInt(lowStockThreshold)) || parseInt(lowStockThreshold) < 0)) {
    errors.lowStockThreshold = ['Low stock threshold must be a valid positive number']
  }

  return Object.keys(errors).length > 0 ? errors : undefined
}

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const errors = validateProductData(formData)
  if (errors) {
    return { errors }
  }

  const sku = (formData.get('sku') as string).trim()
  const name = (formData.get('name') as string).trim()
  const description = (formData.get('description') as string)?.trim() || null
  const barcode = (formData.get('barcode') as string)?.trim() || null
  const weight = parseFloat(formData.get('weight') as string)
  const length = parseFloat(formData.get('length') as string)
  const width = parseFloat(formData.get('width') as string)
  const height = parseFloat(formData.get('height') as string)
  const lowStockThreshold = parseInt(formData.get('lowStockThreshold') as string) || 10
  const imageUrl = (formData.get('imageUrl') as string)?.trim() || null

  try {
    await prisma.product.create({
      data: {
        sku,
        name,
        description,
        barcode,
        weight: new Prisma.Decimal(weight),
        length: new Prisma.Decimal(length),
        width: new Prisma.Decimal(width),
        height: new Prisma.Decimal(height),
        lowStockThreshold,
        imageUrl,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return {
          errors: {
            sku: ['A product with this SKU already exists'],
          },
        }
      }
    }
    return {
      errors: {
        _form: ['An error occurred while creating the product. Please try again.'],
      },
    }
  }

  redirect('/inventory')
}

export async function updateProduct(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const errors = validateProductData(formData)
  if (errors) {
    return { errors }
  }

  const sku = (formData.get('sku') as string).trim()
  const name = (formData.get('name') as string).trim()
  const description = (formData.get('description') as string)?.trim() || null
  const barcode = (formData.get('barcode') as string)?.trim() || null
  const weight = parseFloat(formData.get('weight') as string)
  const length = parseFloat(formData.get('length') as string)
  const width = parseFloat(formData.get('width') as string)
  const height = parseFloat(formData.get('height') as string)
  const lowStockThreshold = parseInt(formData.get('lowStockThreshold') as string) || 10
  const imageUrl = (formData.get('imageUrl') as string)?.trim() || null

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        sku,
        name,
        description,
        barcode,
        weight: new Prisma.Decimal(weight),
        length: new Prisma.Decimal(length),
        width: new Prisma.Decimal(width),
        height: new Prisma.Decimal(height),
        lowStockThreshold,
        imageUrl,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return {
          errors: {
            sku: ['A product with this SKU already exists'],
          },
        }
      }
      if (error.code === 'P2025') {
        return {
          errors: {
            _form: ['Product not found'],
          },
        }
      }
    }
    return {
      errors: {
        _form: ['An error occurred while updating the product. Please try again.'],
      },
    }
  }

  redirect('/inventory')
}

// Receive Stock Types and Actions

export type ReceiveStockState = {
  errors?: {
    productId?: string[]
    quantity?: string[]
    _form?: string[]
  }
  success?: {
    productName: string
    quantity: number
    newStock: number
  }
}

export async function searchProducts(query: string) {
  if (!query || query.length < 1) {
    return []
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      imageUrl: true,
    },
    take: 10,
    orderBy: { name: 'asc' },
  })

  return products
}

export async function getRecentReceives() {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { type: 'RECEIVED' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      product: {
        select: { sku: true, name: true },
      },
      user: {
        select: { name: true },
      },
    },
  })

  return transactions.map((t) => ({
    id: t.id,
    productSku: t.product.sku,
    productName: t.product.name,
    quantity: t.quantity,
    receivedBy: t.user.name,
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function receiveStock(
  userId: string,
  _prevState: ReceiveStockState,
  formData: FormData
): Promise<ReceiveStockState> {
  const productId = formData.get('productId') as string
  const quantityStr = formData.get('quantity') as string
  const notes = (formData.get('notes') as string)?.trim() || null

  const errors: ReceiveStockState['errors'] = {}

  if (!productId) {
    errors.productId = ['Please select a product']
  }

  const quantity = parseInt(quantityStr)
  if (!quantityStr || isNaN(quantity) || quantity <= 0) {
    errors.quantity = ['Please enter a valid quantity greater than 0']
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create the inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          quantity,
          type: 'RECEIVED',
          notes,
          userId,
        },
      })

      // Update the product stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: { increment: quantity },
        },
        select: { name: true, currentStock: true },
      })

      return updatedProduct
    })

    return {
      success: {
        productName: result.name,
        quantity,
        newStock: result.currentStock,
      },
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return {
          errors: {
            _form: ['Product not found'],
          },
        }
      }
    }
    return {
      errors: {
        _form: ['An error occurred while receiving stock. Please try again.'],
      },
    }
  }
}

// Adjust Stock Types and Actions

export type AdjustStockState = {
  errors?: {
    newStock?: string[]
    notes?: string[]
    _form?: string[]
  }
  success?: {
    productName: string
    previousStock: number
    newStock: number
    adjustment: number
  }
}

export async function adjustStock(
  productId: string,
  userId: string,
  _prevState: AdjustStockState,
  formData: FormData
): Promise<AdjustStockState> {
  const newStockStr = formData.get('newStock') as string
  const notes = (formData.get('notes') as string)?.trim()

  const errors: AdjustStockState['errors'] = {}

  const newStock = parseInt(newStockStr)
  if (newStockStr === '' || isNaN(newStock) || newStock < 0) {
    errors.newStock = ['Please enter a valid stock count (0 or greater)']
  }

  if (!notes) {
    errors.notes = ['Please provide a reason for this adjustment']
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current stock
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { name: true, currentStock: true },
      })

      if (!product) {
        throw new Error('Product not found')
      }

      const adjustment = newStock - product.currentStock

      // Only create transaction if there's actually a change
      if (adjustment !== 0) {
        await tx.inventoryTransaction.create({
          data: {
            productId,
            quantity: adjustment,
            type: 'ADJUSTED',
            notes,
            userId,
          },
        })

        await tx.product.update({
          where: { id: productId },
          data: { currentStock: newStock },
        })
      }

      return {
        productName: product.name,
        previousStock: product.currentStock,
        newStock,
        adjustment,
      }
    })

    return { success: result }
  } catch (error) {
    if (error instanceof Error && error.message === 'Product not found') {
      return {
        errors: {
          _form: ['Product not found'],
        },
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return {
          errors: {
            _form: ['Product not found'],
          },
        }
      }
    }
    return {
      errors: {
        _form: ['An error occurred while adjusting stock. Please try again.'],
      },
    }
  }
}
