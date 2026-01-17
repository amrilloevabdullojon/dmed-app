'use client'

import { useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface Particle {
  id: number
  x: number
  size: number
  speed: number
  opacity: number
  floatX: number
  delay: number
  color: string
}

export function Particles() {
  const [personalization] = useLocalStorage<{
    backgroundAnimations?: boolean
    particles?: boolean
  }>(
    'personalization-settings',
    { backgroundAnimations: true, particles: false }
  )
  const backgroundAnimations = personalization?.backgroundAnimations ?? true
  const particlesEnabled = personalization?.particles ?? false

  const [particles] = useState<Particle[]>(() => {
    if (typeof window === 'undefined') return []
    const particleCount = window.innerWidth < 768 ? 12 : 25
    const colors = [
      'rgba(16, 185, 129, 0.6)',   // emerald
      'rgba(59, 130, 246, 0.6)',   // blue
      'rgba(139, 92, 246, 0.6)',   // purple
      'rgba(251, 191, 36, 0.6)',   // amber
      'rgba(236, 72, 153, 0.6)',   // pink
    ]

    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 6 + 3,
      speed: Math.random() * 5 + 8, // 8-13s
      opacity: Math.random() * 0.4 + 0.3,
      floatX: Math.random() * 40 - 20, // -20 to 20
      delay: -Math.random() * 15,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
  })

  if (!particlesEnabled || !backgroundAnimations) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="animate-float-up absolute rounded-full blur-[1px]"
          style={
            {
              left: `${particle.x}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              animationDuration: `${particle.speed}s`,
              animationDelay: `${particle.delay}s`,
              '--float-x': `${particle.floatX}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
