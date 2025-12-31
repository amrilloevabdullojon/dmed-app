'use client'

import { useEffect, useState } from 'react'

interface Snowflake {
  id: number
  x: number
  size: number
  speed: number
  opacity: number
  wobble: number
}

export function Snowfall() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([])

  useEffect(() => {
    // Создаём снежинки
    const flakeCount = typeof window !== 'undefined' && window.innerWidth < 768 ? 24 : 50
    const flakes: Snowflake[] = Array.from({ length: flakeCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 4 + 2,
      speed: Math.random() * 3 + 2,
      opacity: Math.random() * 0.6 + 0.4,
      wobble: Math.random() * 10,
    }))
    setSnowflakes(flakes)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute animate-snowfall"
          style={{
            left: `${flake.x}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: `${flake.speed + 5}s`,
            animationDelay: `${-Math.random() * 10}s`,
            '--wobble': `${flake.wobble}px`,
          } as React.CSSProperties}
        >
          ❄
        </div>
      ))}
    </div>
  )
}

// Новогодние украшения для хедера
export function ChristmasLights() {
  return (
    <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
      <div className="flex animate-lights">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full mx-2"
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
  const [show, setShow] = useState(true)

  if (!show) return null

  return (
    <div className="bg-gradient-to-r from-red-600 via-green-600 to-red-600 text-white py-1.5 sm:py-2 px-3 sm:px-4 text-center relative">
      <span className="text-xs sm:text-sm md:text-base font-medium">
        🎄 С Новым 2025 годом! 🎅 Желаем успехов и отличного настроения! 🎁
      </span>
      <button
        onClick={() => setShow(false)}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
      >
        ✕
      </button>
    </div>
  )
}
