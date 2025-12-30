import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

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

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { role: true, canLogin: true },
      })

      if (!dbUser) {
        return false
      }

      const isAllowed = dbUser.role === 'ADMIN' || dbUser.canLogin
      if (isAllowed) {
        await prisma.user.update({
          where: { email: user.email },
          data: { lastLoginAt: new Date() },
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
          select: { role: true },
        })
        session.user.role = dbUser?.role || 'EMPLOYEE'
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
