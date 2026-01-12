'use client'

import React from 'react'
import { useScreenSize } from '@/hooks/useIsMobile'

interface ResponsiveChartProps {
  children: (size: { width: number; height: number }) => React.ReactNode
  minWidth?: number
  maxWidth?: number
  aspectRatio?: number
  className?: string
}

export function ResponsiveChart({
  children,
  minWidth = 280,
  maxWidth = 600,
  aspectRatio = 1,
  className = '',
}: ResponsiveChartProps) {
  const { width: screenWidth } = useScreenSize()

  // Calculate responsive dimensions
  const getChartSize = () => {
    // Mobile: use screen width minus padding
    if (screenWidth < 640) {
      const width = Math.max(minWidth, Math.min(screenWidth - 32, maxWidth))
      return {
        width,
        height: Math.round(width * aspectRatio),
      }
    }

    // Tablet
    if (screenWidth < 1024) {
      const width = Math.min(400, maxWidth)
      return {
        width,
        height: Math.round(width * aspectRatio),
      }
    }

    // Desktop
    const width = maxWidth
    return {
      width,
      height: Math.round(width * aspectRatio),
    }
  }

  const chartSize = getChartSize()

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div style={{ width: chartSize.width, height: chartSize.height }}>{children(chartSize)}</div>
    </div>
  )
}

// Specialized wrapper for Recharts
interface ResponsiveRechartsProps {
  children: (width: number, height: number) => React.ReactNode
  minHeight?: number
  maxHeight?: number
  aspectRatio?: number
  className?: string
}

export function ResponsiveRecharts({
  children,
  minHeight = 200,
  maxHeight = 400,
  aspectRatio = 16 / 9,
  className = '',
}: ResponsiveRechartsProps) {
  const { width: screenWidth } = useScreenSize()

  const getChartDimensions = () => {
    // Mobile: full width minus padding
    if (screenWidth < 640) {
      const width = screenWidth - 32
      const height = Math.min(maxHeight, Math.max(minHeight, width / aspectRatio))
      return { width, height }
    }

    // Tablet
    if (screenWidth < 1024) {
      const width = screenWidth * 0.9
      const height = Math.min(maxHeight, width / aspectRatio)
      return { width, height }
    }

    // Desktop
    const width = screenWidth > 1600 ? 1200 : screenWidth * 0.7
    const height = Math.min(maxHeight, width / aspectRatio)
    return { width, height }
  }

  const { width, height } = getChartDimensions()

  return <div className={className}>{children(width, height)}</div>
}

// Helper for determining chart size based on container
export function useContainerSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return size
}
