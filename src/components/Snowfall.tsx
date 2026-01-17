'use client'

import { useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface Snowflake {
  id: number
  x: number
  size: number
  speed: number
  opacity: number
  wobble: number
  delay: number
}

export function Snowfall() {
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
  const [personalization] = useLocalStorage<{
    backgroundAnimations?: boolean
    snowfall?: boolean
  }>(
    'personalization-settings',
    { backgroundAnimations: true, snowfall: false }
  )
  const backgroundAnimations = personalization?.backgroundAnimations ?? true
  const snowfallEnabled = personalization?.snowfall ?? false
  const [snowflakes] = useState<Snowflake[]>(() => {
    if (typeof window === 'undefined') return []
    const flakeCount = window.innerWidth < 768 ? 30 : 60
    return Array.from({ length: flakeCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 4 + 2,
      speed: Math.random() * 3 + 2,
      opacity: Math.random() * 0.6 + 0.4,
      wobble: Math.random() * 15 - 7.5, // -7.5 to 7.5
      delay: -Math.random() * 10,
    }))
  })

  // Show snowfall if either New Year mode OR snowfall toggle is enabled
  const shouldShowSnowfall = (newYearVibe || snowfallEnabled) && backgroundAnimations
  if (!shouldShowSnowfall) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="animate-snowfall absolute"
          style={
            {
              left: `${flake.x}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              opacity: flake.opacity,
              animationDuration: `${flake.speed + 5}s`,
              animationDelay: `${flake.delay}s`,
              '--wobble': `${flake.wobble}px`,
            } as React.CSSProperties
          }
        >
          {'\u2744'}
        </div>
      ))}
    </div>
  )
}

// Новогодние украшения для хедера
export function ChristmasLights() {
  return (
    <div className="absolute left-0 right-0 top-0 h-1 overflow-hidden">
      <div className="animate-lights flex">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="mx-2 h-2 w-2 rounded-full"
            style={{
              backgroundColor: ['#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff'][i % 5],
              animationDelay: `${i * 0.1}s`,
              boxShadow: `0 0 6px ${['#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff'][i % 5]}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Новогодний баннер
export function NewYearBanner() {
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
  const [bannerDismissed, setBannerDismissed] = useLocalStorage<boolean>(
    'new-year-banner-dismissed',
    false
  )

  if (!newYearVibe || bannerDismissed) return null

  return (
    <div className="relative bg-gradient-to-r from-red-600 via-green-600 to-red-600 px-3 py-1.5 text-center text-white sm:px-4 sm:py-2">
      <span className="text-xs font-medium sm:text-sm md:text-base">
        {
          '\u0421 \u041d\u043e\u0432\u044b\u043c 2025 \u0433\u043e\u0434\u043e\u043c! \u0416\u0435\u043b\u0430\u0435\u043c \u0443\u0441\u043f\u0435\u0445\u043e\u0432 \u0438 \u043e\u0442\u043b\u0438\u0447\u043d\u043e\u0433\u043e \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u044f!'
        }
      </span>
      <button
        onClick={() => setBannerDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white sm:right-4"
      >
        {'\u2715'}
      </button>
    </div>
  )
}
