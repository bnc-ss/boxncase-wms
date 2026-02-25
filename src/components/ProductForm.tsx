'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ProductFormState } from '@/app/(dashboard)/inventory/actions'

interface ProductData {
  id?: string
  sku: string
  name: string
  description: string | null
  barcode: string | null
  weight: string
  length: string
  width: string
  height: string
  lowStockThreshold: number
  imageUrl: string | null
}

interface ProductFormProps {
  product?: ProductData
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>
  title: string
  submitLabel: string
}

function FormField({
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  required,
  errors,
  hint,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | number | null
  placeholder?: string
  required?: boolean
  errors?: string[]
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
          errors ? 'border-red-500 bg-red-50' : 'border-gray-300'
        }`}
      />
      {hint && !errors && (
        <p className="mt-1.5 text-sm text-gray-500">{hint}</p>
      )}
      {errors && (
        <div className="mt-1.5">
          {errors.map((error, i) => (
            <p key={i} className="text-sm text-red-600">{error}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  errors,
}: {
  label: string
  name: string
  defaultValue?: string | null
  placeholder?: string
  errors?: string[]
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none ${
          errors ? 'border-red-500 bg-red-50' : 'border-gray-300'
        }`}
      />
      {errors && (
        <div className="mt-1.5">
          {errors.map((error, i) => (
            <p key={i} className="text-sm text-red-600">{error}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductForm({ product, action, title, submitLabel }: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
        {state.errors?._form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            {state.errors._form.map((error, i) => (
              <p key={i} className="text-sm text-red-600">{error}</p>
            ))}
          </div>
        )}

        <form action={formAction} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              label="SKU"
              name="sku"
              defaultValue={product?.sku}
              placeholder="e.g., WIDGET-001"
              required
              errors={state.errors?.sku}
              hint="Unique product identifier"
            />
            <FormField
              label="Barcode"
              name="barcode"
              defaultValue={product?.barcode}
              placeholder="e.g., 012345678901"
              errors={state.errors?.barcode}
            />
          </div>

          <FormField
            label="Product Name"
            name="name"
            defaultValue={product?.name}
            placeholder="e.g., Blue Widget"
            required
            errors={state.errors?.name}
          />

          <TextAreaField
            label="Description"
            name="description"
            defaultValue={product?.description}
            placeholder="Product description..."
            errors={state.errors?.description}
          />

          {/* Dimensions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dimensions</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField
                label="Weight (lbs)"
                name="weight"
                type="number"
                defaultValue={product?.weight}
                placeholder="0.00"
                required
                errors={state.errors?.weight}
              />
              <FormField
                label="Length (in)"
                name="length"
                type="number"
                defaultValue={product?.length}
                placeholder="0.00"
                required
                errors={state.errors?.length}
              />
              <FormField
                label="Width (in)"
                name="width"
                type="number"
                defaultValue={product?.width}
                placeholder="0.00"
                required
                errors={state.errors?.width}
              />
              <FormField
                label="Height (in)"
                name="height"
                type="number"
                defaultValue={product?.height}
                placeholder="0.00"
                required
                errors={state.errors?.height}
              />
            </div>
          </div>

          {/* Stock Settings */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              label="Low Stock Threshold"
              name="lowStockThreshold"
              type="number"
              defaultValue={product?.lowStockThreshold ?? 10}
              errors={state.errors?.lowStockThreshold}
              hint="Alert when stock falls below this number"
            />
            <FormField
              label="Image URL"
              name="imageUrl"
              type="url"
              defaultValue={product?.imageUrl}
              placeholder="https://..."
              errors={state.errors?.imageUrl}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Saving...' : submitLabel}
            </button>
            <Link
              href="/inventory"
              className="px-6 py-3 text-base font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
