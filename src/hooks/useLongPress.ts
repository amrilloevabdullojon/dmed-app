import { useCallback, useRef, useState } from 'react'

export interface LongPressOptions {
  /**
   * Time in milliseconds to trigger long press
   * @default 500
   */
  delay?: number
  /**
   * Callback when long press is triggered
   */
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void
  /**
   * Optional callback when press starts
   */
  onStart?: (e: React.TouchEvent | React.MouseEvent) => void
  /**
   * Optional callback when press is cancelled
   */
  onCancel?: () => void
  /**
   * Optional callback when press ends
   */
  onFinish?: () => void
  /**
   * Threshold in pixels - if finger moves more than this, cancel long press
   * @default 10
   */
  moveThreshold?: number
}

export function useLongPress(options: LongPressOptions) {
  const { delay = 500, onLongPress, onStart, onCancel, onFinish, moveThreshold = 10 } = options

  const [isLongPressing, setIsLongPressing] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const startPosition = useRef<{ x: number; y: number } | null>(null)
  const isLongPressTriggered = useRef(false)
  const eventRef = useRef<React.TouchEvent | React.MouseEvent | null>(null)

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Get position
      const position =
        'touches' in e
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : { x: e.clientX, y: e.clientY }

      startPosition.current = position
      isLongPressTriggered.current = false
      eventRef.current = e

      onStart?.(e)
      setIsLongPressing(true)

      timerRef.current = setTimeout(() => {
        isLongPressTriggered.current = true
        if (eventRef.current) {
          onLongPress(eventRef.current)
        }
      }, delay)
    },
    [delay, onLongPress, onStart]
  )

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (isLongPressing && !isLongPressTriggered.current) {
      onCancel?.()
    }

    setIsLongPressing(false)
    startPosition.current = null
    isLongPressTriggered.current = false
  }, [isLongPressing, onCancel])

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!startPosition.current || !isLongPressing) return

      // Get current position
      const currentPosition =
        'touches' in e
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : { x: e.clientX, y: e.clientY }

      // Calculate distance from start
      const distance = Math.sqrt(
        Math.pow(currentPosition.x - startPosition.current.x, 2) +
          Math.pow(currentPosition.y - startPosition.current.y, 2)
      )

      // If moved too far, cancel long press
      if (distance > moveThreshold) {
        cancel()
      }
    },
    [isLongPressing, moveThreshold, cancel]
  )

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (isLongPressTriggered.current) {
      onFinish?.()
    }

    setIsLongPressing(false)
    startPosition.current = null
    isLongPressTriggered.current = false
  }, [onFinish])

  return {
    isLongPressing,
    handlers: {
      onMouseDown: start,
      onMouseUp: end,
      onMouseLeave: cancel,
      onMouseMove: move,
      onTouchStart: start,
      onTouchEnd: end,
      onTouchCancel: cancel,
      onTouchMove: move,
    },
  }
}
