import NextAuth from 'next-auth'
import { authConfig } from '@/src/lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
}
