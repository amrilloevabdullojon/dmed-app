'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'

interface ScrollRevealProps {
  children: ReactNode
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scaleIn'
  delay?: number
  threshold?: number
  className?: string
  triggerOnce?: boolean
}

export function ScrollReveal({
  children,
  animation = 'fadeIn',
  delay = 0,
  threshold = 0.1,
  className = '',
  triggerOnce = true,
}: ScrollRevealProps) {
  const { preferences } = useUserPreferences()
  const scrollAnimationsEnabled = preferences?.scrollAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Если анимации отключены, сразу показываем элемент
    if (!scrollAnimationsEnabled || !animationsEnabled) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            if (triggerOnce) {
              setHasBeenVisible(true)
            }
          } else if (!triggerOnce && !hasBeenVisible) {
            setIsVisible(false)
          }
        })
      },
      { threshold }
    )

    const currentElement = elementRef.current
    if (currentElement) {
      observer.observe(currentElement)
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement)
      }
    }
  }, [scrollAnimationsEnabled, animationsEnabled, threshold, triggerOnce, hasBeenVisible])

  const animationClasses = {
    fadeIn: 'animate-fadeIn',
    slideUp: 'animate-slideUp',
    slideLeft: 'animate-slideLeft',
    slideRight: 'animate-slideRight',
    scaleIn: 'animate-scaleIn',
  }

  // Если анимации отключены, возвращаем детей без обёртки
  if (!scrollAnimationsEnabled || !animationsEnabled) {
    return <>{children}</>
  }

  return (
    <div
      ref={elementRef}
      className={`${className} ${isVisible || hasBeenVisible ? animationClasses[animation] : 'opacity-0'}`}
      style={{
        animationDelay: isVisible || hasBeenVisible ? `${delay}ms` : '0ms',
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  )
}

// Компонент для группы элементов с эффектом "каскада"
export function ScrollRevealGroup({
  children,
  animation = 'fadeIn',
  staggerDelay = 100,
  threshold = 0.1,
  className = '',
}: {
  children: ReactNode[]
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scaleIn'
  staggerDelay?: number
  threshold?: number
  className?: string
}) {
  return (
    <div className={className}>
      {(Array.isArray(children) ? children : [children]).map((child, index) => (
        <ScrollReveal
          key={index}
          animation={animation}
          delay={index * staggerDelay}
          threshold={threshold}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
