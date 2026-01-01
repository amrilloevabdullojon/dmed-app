import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import { RATE_LIMIT_WINDOW_MINUTES, MAX_LOGIN_ATTEMPTS } from '@/lib/constants'

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        // Получить роль пользователя
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            profile: { select: { avatarUrl: true, updatedAt: true } },
          },
        })
        session.user.role = dbUser?.role || 'EMPLOYEE'
        const avatarUrl = resolveProfileAssetUrl(
          dbUser?.profile?.avatarUrl ?? null,
          dbUser?.profile?.updatedAt ?? null
        )
        if (avatarUrl) {
          session.user.image = avatarUrl
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
