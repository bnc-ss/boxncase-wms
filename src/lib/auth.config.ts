import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = nextUrl.pathname.startsWith('/login')
      const isAuthApi = nextUrl.pathname.startsWith('/api/auth')
      const isWebhook = nextUrl.pathname.startsWith('/api/webhooks')
      const isPublicApi = nextUrl.pathname.startsWith('/api/shopify/register-webhooks')

      // Allow public routes
      if (isAuthApi || isWebhook || isPublicApi) {
        return true
      }

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/', nextUrl))
        }
        return true
      }

      return isLoggedIn
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as 'ADMIN' | 'EMPLOYEE'
      return session
    },
  },
  providers: [],
  session: {
    strategy: 'jwt',
  },
}
