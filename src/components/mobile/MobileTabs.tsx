'use client'

import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface MobileTab {
  id: string
  label: string
  icon?: ReactNode
  content: ReactNode
  badge?: number
}

interface MobileTabsProps {
  tabs: MobileTab[]
  defaultTab?: string
  className?: string
}

export function MobileTabs({ tabs, defaultTab, className }: MobileTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab Navigation */}
      <div className="mobile-scroll no-scrollbar -mx-4 flex gap-2 overflow-x-auto border-b border-white/10 px-4 pb-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'tap-highlight touch-target-sm relative flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition',
                isActive
                  ? 'border border-teal-400/30 bg-teal-500/15 text-teal-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
              aria-selected={isActive}
              role="tab"
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-semibold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-4" role="tabpanel">
        {activeTabContent}
      </div>
    </div>
  )
}

// Accordion variant for nested content
interface MobileAccordionItem {
  id: string
  title: string
  content: ReactNode
  icon?: ReactNode
  defaultOpen?: boolean
}

interface MobileAccordionProps {
  items: MobileAccordionItem[]
  allowMultiple?: boolean
  className?: string
}

export function MobileAccordion({ items, allowMultiple = false, className }: MobileAccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(
    items.filter((item) => item.defaultOpen).map((item) => item.id)
  )

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setOpenItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
    } else {
      setOpenItems((prev) => (prev.includes(id) ? [] : [id]))
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const isOpen = openItems.includes(item.id)
        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
          >
            {/* Header */}
            <button
              onClick={() => toggleItem(item.id)}
              className="tap-highlight flex w-full items-center justify-between p-4 text-left transition hover:bg-white/5"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3">
                {item.icon && <div className="text-emerald-300">{item.icon}</div>}
                <span className="font-medium text-white">{item.title}</span>
              </div>
              <svg
                className={cn(
                  'h-5 w-5 text-slate-400 transition-transform',
                  isOpen && 'rotate-180'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Content */}
            {isOpen && <div className="border-t border-white/10 p-4">{item.content}</div>}
          </div>
        )
      })}
    </div>
  )
}
