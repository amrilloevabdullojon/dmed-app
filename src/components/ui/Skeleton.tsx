'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/10',
        className
      )}
    />
  )
}

/**
 * Skeleton for request card
 */
export function RequestCardSkeleton() {
  return (
    <div className="panel panel-soft panel-glass rounded-2xl p-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-6 w-3/4 max-w-[300px]" />
          <Skeleton className="h-4 w-full max-w-[400px]" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mt-3" />
      <Skeleton className="h-4 w-2/3 mt-2" />
      <div className="flex gap-4 mt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

/**
 * Multiple request card skeletons
 */
export function RequestListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <RequestCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Skeleton for letter row
 */
export function LetterRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-700/50">
      <Skeleton className="h-5 w-5 rounded" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-full max-w-[500px]" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

/**
 * Multiple letter row skeletons
 */
export function LetterListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-700/50">
      {Array.from({ length: count }).map((_, i) => (
        <LetterRowSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Generic card skeleton
 */
export function CardSkeleton() {
  return (
    <div className="panel panel-glass rounded-2xl p-6 space-y-4">
      <Skeleton className="h-6 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

/**
 * Stats skeleton for dashboard
 */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="panel panel-glass rounded-xl p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}
