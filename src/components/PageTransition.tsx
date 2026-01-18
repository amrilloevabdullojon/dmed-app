'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUserPreferences } from '@/hooks/useUserPreferences'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const { preferences } = useUserPreferences()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitionStage, setTransitionStage] = useState<'fadeIn' | 'fadeOut' | 'none'>('none')

  const pageTransitionsEnabled = preferences?.pageTransitions ?? true
  const animationsEnabled = preferences?.animations ?? true

  useEffect(() => {
    // Если анимации отключены, сразу показываем контент
    if (!pageTransitionsEnabled || !animationsEnabled) {
      setDisplayChildren(children)
      setTransitionStage('none')
      return
    }

    // Запускаем анимацию выхода при изменении pathname
    setTransitionStage('fadeOut')
  }, [pathname, pageTransitionsEnabled, animationsEnabled])

  useEffect(() => {
    if (transitionStage === 'fadeOut') {
      // После завершения fadeOut обновляем контент и запускаем fadeIn
      const timeout = setTimeout(() => {
        setDisplayChildren(children)
        setTransitionStage('fadeIn')
      }, 150) // Длительность fadeOut

      return () => clearTimeout(timeout)
    } else if (transitionStage === 'fadeIn') {
      // После завершения fadeIn переходим в none
      const timeout = setTimeout(() => {
        setTransitionStage('none')
      }, 150) // Длительность fadeIn

      return () => clearTimeout(timeout)
    }
  }, [transitionStage, children])

  // Если анимации отключены, возвращаем контент без обёртки
  if (!pageTransitionsEnabled || !animationsEnabled) {
    return <>{children}</>
  }

  return (
    <div
      className={`transition-opacity duration-150 ease-out ${
        transitionStage === 'fadeOut'
          ? 'opacity-0'
          : transitionStage === 'fadeIn'
            ? 'animate-fadeIn'
            : 'opacity-100'
      }`}
    >
      {displayChildren}
    </div>
  )
}
