'use client'

import { signOut } from 'next-auth/react'
import { Menu, LogOut } from 'lucide-react'

interface HeaderProps {
  userName: string
  onMenuClick: () => void
}

export function Header({ userName, onMenuClick }: HeaderProps) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-[#1F2933] hover:text-[#3264B7] hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-[#1F2933]">
            {userName}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#1F2933] hover:text-white hover:bg-[#3264B7] rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
