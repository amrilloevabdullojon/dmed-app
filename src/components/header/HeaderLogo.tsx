'use client'

import { memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { PageMeta } from './header-types'
import { scheduleFallbackNavigation } from './header-utils'

interface HeaderLogoProps {
  compact?: boolean
  pageMeta?: PageMeta
}

export const HeaderLogo = memo(function HeaderLogo({ compact, pageMeta }: HeaderLogoProps) {
  const PageIcon = pageMeta?.icon

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/"
        onClick={(event) => scheduleFallbackNavigation(event, '/')}
        className="group flex shrink-0 items-center gap-3 transition-transform hover:scale-[1.02]"
      >
        {/* Logo Mark */}
        <div
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-400/20 to-emerald-500/20 shadow-lg shadow-teal-500/20 ring-1 ring-white/10 transition-all group-hover:shadow-teal-500/30 ${
            compact ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-10 w-10 sm:h-11 sm:w-11'
          }`}
        >
          <Image src="/logo-mark.svg" alt="DMED" fill className="object-contain p-1" priority />
        </div>

        {/* Desktop Brand Text */}
        <div className="hidden leading-tight sm:block">
          <span className="bg-gradient-to-r from-white to-slate-200 bg-clip-text text-lg font-semibold text-transparent">
            DMED Letters
          </span>
          <span className="block text-[11px] font-medium tracking-widest text-teal-400/70">
            DOCUMENT FLOW
          </span>
        </div>

        {/* Mobile Brand Text */}
        <span className="text-sm font-semibold text-white sm:hidden">DMED</span>
      </Link>

      {/* Mobile Page Indicator */}
      {pageMeta && PageIcon && (
        <div className="ml-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 backdrop-blur-sm sm:hidden">
          <PageIcon className="h-3.5 w-3.5 text-teal-400" />
          <span className="max-w-[100px] truncate text-[11px] font-medium text-slate-200">
            {pageMeta.label}
          </span>
        </div>
      )}
    </div>
  )
})
