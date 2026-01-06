import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import { RATE_LIMIT_WINDOW_MINUTES, MAX_LOGIN_ATTEMPTS } from '@/lib/constants'
import type { JWT } from 'next-auth/jwt'
import type { Role } from '@prisma/client'

/**
 * NextAuth configuration with JWT strategy for better performance.
 * JWT tokens cache user role and avatar, reducing database queries.
 */
export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow linking Google accounts to existing users created manually
      // This is safe because we verify user existence in signIn callback
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  // Use JWT strategy for better performance (no DB query on each request)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false
      }

      const email = user.email.toLowerCase()
      const now = new Date()
      const rateWindowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)

      const recentFailures = await prisma.loginAudit.count({
        where: {
          email,
          success: false,
          createdAt: { gte: rateWindowStart },
        },
      })

      if (recentFailures >= MAX_LOGIN_ATTEMPTS) {
        await prisma.loginAudit.create({
          data: {
            email,
            success: false,
            reason: 'RATE_LIMIT',
          },
        })
        return false
      }

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, canLogin: true },
      })

      if (!dbUser) {
        await prisma.loginAudit.create({
          data: {
            email,
            success: false,
            reason: 'USER_NOT_FOUND',
          },
        })
        return false
      }

      const isAllowed = dbUser.role === 'ADMIN' || dbUser.role === 'SUPERADMIN' || dbUser.canLogin
      if (isAllowed) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: dbUser.id },
            data: { lastLoginAt: now },
          }),
          prisma.loginAudit.create({
            data: {
              email,
              success: true,
              userId: dbUser.id,
            },
          }),
        ])
      } else {
        await prisma.loginAudit.create({
          data: {
            email,
            success: false,
            userId: dbUser.id,
            reason: 'ACCESS_BLOCKED',
          },
        })
      }

      return isAllowed
    },

    async jwt({ token, user, trigger }) {
      // Initial sign in - fetch user data
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            role: true,
            tokenVersion: true,
            canLogin: true,
            profile: { select: { avatarUrl: true, updatedAt: true } },
          },
        })

        token.id = user.id
        token.role = dbUser?.role || 'EMPLOYEE'
        token.tokenVersion = dbUser?.tokenVersion ?? 0
        token.canLogin = dbUser?.canLogin ?? true
        token.avatarUrl = resolveProfileAssetUrl(
          dbUser?.profile?.avatarUrl ?? null,
          dbUser?.profile?.updatedAt ?? null
        )
      }

      // Refresh token data on update trigger (e.g., after profile change)
      if (trigger === 'update' && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            tokenVersion: true,
            canLogin: true,
            profile: { select: { avatarUrl: true, updatedAt: true } },
          },
        })

        if (dbUser) {
          token.role = dbUser.role
          token.tokenVersion = dbUser.tokenVersion
          token.canLogin = dbUser.canLogin
          token.avatarUrl = resolveProfileAssetUrl(
            dbUser.profile?.avatarUrl ?? null,
            dbUser.profile?.updatedAt ?? null
          )
        }
      }

      // Validate token version on each request to detect invalidated tokens
      // Only check if token has tokenVersion (backwards compatible with old tokens)
      if (token.id && typeof token.tokenVersion === 'number') {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tokenVersion: true },
          })

          // If tokenVersion in DB is higher, the token was invalidated
          // Skip check if dbUser.tokenVersion is null/undefined (field not migrated yet)
          if (
            dbUser &&
            typeof dbUser.tokenVersion === 'number' &&
            dbUser.tokenVersion > token.tokenVersion
          ) {
            // Return empty token to force re-authentication
            return { ...token, id: undefined, role: undefined }
          }
        } catch {
          // If tokenVersion field doesn't exist in DB yet, skip validation
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = (token.role as Role) || 'EMPLOYEE'
        session.user.canLogin = Boolean(token.canLogin ?? true)
        if (token.avatarUrl) {
          session.user.image = token.avatarUrl as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

// Extend JWT type
declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: Role
    avatarUrl?: string | null
    tokenVersion?: number
    canLogin?: boolean
  }
}
