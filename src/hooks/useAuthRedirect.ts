import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionStatus } from 'next-auth/react'

export function useAuthRedirect(status: SessionStatus) {
  const router = useRouter()

  useEffect(() => {
    if (status !== 'unauthenticated') return
    const nextUrl =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/'
    router.replace(`/login?next=${encodeURIComponent(nextUrl)}`)
  }, [status, router])
}
