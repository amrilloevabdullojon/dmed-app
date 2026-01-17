'use client'

import { ReactNode, Children, cloneElement, isValidElement } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'

interface AnimatedListProps {
  children: ReactNode
  className?: string
  delay?: number
  animation?: 'fadeIn' | 'slideUp' | 'scaleIn'
}

export function AnimatedList({
  children,
  className = '',
  delay = 50,
  animation = 'fadeIn',
}: AnimatedListProps) {
  const { preferences } = useUserPreferences()
  const listAnimationsEnabled = preferences?.listAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  // Если анимации отключены, возвращаем детей без обёртки
  if (!listAnimationsEnabled || !animationsEnabled) {
    return <div className={className}>{children}</div>
  }

  const animationClasses = {
    fadeIn: 'animate-fadeIn',
    slideUp: 'animate-slideUp',
    scaleIn: 'animate-scaleIn',
  }

  const childrenArray = Children.toArray(children)

  return (
    <div className={className}>
      {childrenArray.map((child, index) => {
        if (!isValidElement(child)) return child

        return cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
          key: index,
          className: `${child.props.className || ''} ${animationClasses[animation]}`,
          style: {
            ...child.props.style,
            animationDelay: `${index * delay}ms`,
            animationFillMode: 'backwards',
          },
        })
      })}
    </div>
  )
}

// Компонент для плавного удаления элементов из списка
export function AnimatedListItem({
  children,
  isRemoving = false,
  onRemoveComplete,
}: {
  children: ReactNode
  isRemoving?: boolean
  onRemoveComplete?: () => void
}) {
  const { preferences } = useUserPreferences()
  const listAnimationsEnabled = preferences?.listAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  if (isRemoving && listAnimationsEnabled && animationsEnabled) {
    return (
      <div
        className="animate-slideOutLeft"
        onAnimationEnd={onRemoveComplete}
        style={{ overflow: 'hidden' }}
      >
        {children}
      </div>
    )
  }

  return <>{children}</>
}
