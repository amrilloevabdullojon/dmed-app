import type { Role } from '@/types/prisma'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
      canLogin?: boolean
    }
  }
}


