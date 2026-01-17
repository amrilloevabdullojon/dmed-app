'use client'

import React from 'react'
import { LoadingState } from './LoadingState'
import { StatsSkeleton, LetterListSkeleton, CardSkeleton } from './ui/Skeleton'

interface DashboardSectionProps {
  title?: string
  loading: boolean
  children: React.ReactNode
  type?: 'stats' | 'list' | 'card' | 'custom'
  skeleton?: React.ReactNode
  className?: string
}

/**
 * Компонент секции дашборда с автоматическими skeleton loaders
 */
export function DashboardSection({
  title,
  loading,
  children,
  type = 'custom',
  skeleton,
  className,
}: DashboardSectionProps) {
  // Автоматический выбор skeleton на основе типа
  const getDefaultSkeleton = () => {
    switch (type) {
      case 'stats':
        return <StatsSkeleton />
      case 'list':
        return <LetterListSkeleton count={5} />
      case 'card':
        return <CardSkeleton />
      default:
        return null
    }
  }

  return (
    <div className={className}>
      {title && <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>}
      <LoadingState loading={loading} skeleton={skeleton || getDefaultSkeleton()}>
        {children}
      </LoadingState>
    </div>
  )
}
