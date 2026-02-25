import { Suspense } from 'react'
import { LoginForm } from '@/src/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          BoxNCase WMS
        </h1>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
        <div className="h-14 bg-gray-200 rounded-lg" />
      </div>
      <div>
        <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
        <div className="h-14 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-14 bg-gray-200 rounded-lg" />
    </div>
  )
}
