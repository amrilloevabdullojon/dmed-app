/**
 * Haptic feedback utilities for mobile devices
 * Uses the Vibration API when available
 */

/**
 * Check if vibration is supported
 */
export function isVibrationSupported(): boolean {
  return typeof window !== 'undefined' && 'vibrate' in navigator
}

/**
 * Light haptic feedback (selection)
 * Duration: 10ms
 */
export function hapticLight(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(10)
  }
}

/**
 * Medium haptic feedback (button press)
 * Duration: 20ms
 */
export function hapticMedium(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(20)
  }
}

/**
 * Heavy haptic feedback (important action)
 * Duration: 40ms
 */
export function hapticHeavy(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(40)
  }
}

/**
 * Success haptic pattern
 * Two short vibrations
 */
export function hapticSuccess(): void {
  if (isVibrationSupported()) {
    navigator.vibrate([20, 50, 20])
  }
}

/**
 * Error haptic pattern
 * Three short vibrations
 */
export function hapticError(): void {
  if (isVibrationSupported()) {
    navigator.vibrate([30, 50, 30, 50, 30])
  }
}

/**
 * Warning haptic pattern
 * One medium vibration
 */
export function hapticWarning(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(50)
  }
}

/**
 * Selection changed haptic (very light)
 * Duration: 5ms
 */
export function hapticSelectionChange(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(5)
  }
}

/**
 * Long press started haptic
 * Two quick pulses
 */
export function hapticLongPressStart(): void {
  if (isVibrationSupported()) {
    navigator.vibrate([15, 30, 15])
  }
}

/**
 * Impact haptic (swipe action completed)
 * One strong vibration
 */
export function hapticImpact(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(30)
  }
}

/**
 * Custom haptic pattern
 * @param pattern Array of vibration durations and pauses in milliseconds
 */
export function hapticCustom(pattern: number[]): void {
  if (isVibrationSupported()) {
    navigator.vibrate(pattern)
  }
}

/**
 * Cancel any ongoing vibration
 */
export function hapticCancel(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(0)
  }
}
