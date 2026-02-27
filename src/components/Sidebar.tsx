'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  Package,
  Truck,
  ShoppingCart,
  Send,
  Settings,
  X,
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Receive Stock', href: '/inventory/receive', icon: Truck },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Shipments', href: '/shipments', icon: Send },
  { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
]

interface SidebarProps {
  userRole: 'ADMIN' | 'EMPLOYEE'
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ userRole, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || userRole === 'ADMIN'
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex flex-col items-center px-6 py-6 border-b border-gray-100">
            <div className="flex items-center justify-between w-full mb-4 lg:justify-center">
              <div className="flex flex-col items-center">
                <Image
                  src="/boxncase-logo.png"
                  alt="BoxNCase"
                  width={170}
                  height={85}
                  className="object-contain"
                  priority
                />
                <span className="mt-2 text-xs font-medium tracking-wide text-[#1F2933]">
                  Warehouse Management System
                </span>
              </div>
              <button
                onClick={onClose}
                className="lg:hidden text-gray-400 hover:text-gray-600 absolute right-4 top-4"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#3264B7] text-white'
                      : 'text-[#1F2933] hover:bg-gray-100'
                  }`}
                >
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? '' : 'text-[#499C70]'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer - Powered By */}
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-sm text-gray-400">Powered by</span>
              <Image
                src="/powered-by-icon.png"
                alt="Powered by"
                width={18}
                height={18}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
