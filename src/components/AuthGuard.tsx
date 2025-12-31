'use client'

import { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

const PUBLIC_PREFIXES = ['/login', '/portal', '/u']

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { status } = useSession()

  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  useAuthRedirect(isPublic ? 'authenticated' : status)

  if (isPublic) return <>{children}</>

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return <>{children}</>
}
