'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { Clock, FileText, Inbox } from 'lucide-react'
import { hapticLight } from '@/lib/haptic'
import type { RecentItem } from './header-types'
import { scheduleFallbackNavigation } from './header-utils'

interface HeaderRecentItemsProps {
  items: RecentItem[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onUpdateItems: (items: RecentItem[] | ((prev: RecentItem[]) => RecentItem[])) => void
}

export const HeaderRecentItems = memo(function HeaderRecentItems({
  items,
  isOpen,
  onToggle,
  onClose,
  onUpdateItems,
}: HeaderRecentItemsProps) {
  const fetchAbortRef = useRef<AbortController | null>(null)

  const handleLinkClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string) => {
      hapticLight()
      onClose()
      scheduleFallbackNavigation(event, href)
    },
    [onClose]
  )

  // Fetch details for unresolved items when menu opens
  useEffect(() => {
    if (!isOpen || items.length === 0) return

    const pending = items.filter((item) => !item.resolved)
    if (pending.length === 0) return

    const controller = new AbortController()
    fetchAbortRef.current?.abort()
    fetchAbortRef.current = controller

    const fetchDetails = async () => {
      type RecentUpdate = { id: string; label: string; subtitle?: string; resolved: true }

      const resolvedItems: Array<RecentUpdate | null> = await Promise.all(
        pending.map(async (item) => {
          try {
            if (item.kind === 'letter') {
              const res = await fetch(`/api/letters/${item.id}?summary=1`, {
                signal: controller.signal,
                cache: 'no-store',
              })
              if (!res.ok) return null
              const data = await res.json()
              const number = typeof data?.number === 'string' ? data.number : null
              const org = typeof data?.org === 'string' ? data.org : null
              return {
                id: item.id,
                label: number ? `Письмо №${number}` : item.label,
                subtitle: org || undefined,
                resolved: true,
              }
            }

            const res = await fetch(`/api/requests/${item.id}`, {
              signal: controller.signal,
              cache: 'no-store',
            })
            if (!res.ok) return null
            const data = await res.json()
            const request = data?.request
            const org = typeof request?.organization === 'string' ? request.organization : null
            const contact =
              typeof request?.contactName === 'string'
                ? request.contactName
                : typeof request?.contactEmail === 'string'
                  ? request.contactEmail
                  : null
            return {
              id: item.id,
              label: org ? `Заявка: ${org}` : item.label,
              subtitle: contact || undefined,
              resolved: true,
            }
          } catch (error) {
            if ((error as Error)?.name === 'AbortError') return null
            return null
          }
        })
      )

      if (controller.signal.aborted) return
      const updates = resolvedItems.filter((item): item is RecentUpdate => Boolean(item))
      if (updates.length === 0) return

      onUpdateItems((prev) =>
        prev.map((item) => {
          const match = updates.find((update) => update.id === item.id)
          return match ? { ...item, ...match } : item
        })
      )
    }

    void fetchDetails()
    return () => {
      controller.abort()
    }
  }, [isOpen, items, onUpdateItems])

  if (items.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white/10 hover:text-white"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Недавнее"
        aria-label="Недавние документы"
      >
        <Clock className="h-[18px] w-[18px]" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} />
          <div className="absolute right-0 top-full z-[70] mt-2 w-64 origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Недавнее
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto p-1.5">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => handleLinkClick(event, item.href)}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-white/10"
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-1.5 ${
                        item.kind === 'letter' ? 'bg-blue-500/10' : 'bg-emerald-500/10'
                      }`}
                    >
                      {item.kind === 'letter' ? (
                        <FileText className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Inbox className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-200">
                        {item.label}
                      </span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-slate-500">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
})
