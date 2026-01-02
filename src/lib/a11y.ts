/**
 * Accessibility (A11y) utilities and helpers
 */

/**
 * Focus trap for modals and dialogs
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)
  firstElement?.focus()

  return () => {
    container.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Announce message to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcer = document.createElement('div')
  announcer.setAttribute('role', 'status')
  announcer.setAttribute('aria-live', priority)
  announcer.setAttribute('aria-atomic', 'true')
  announcer.className = 'sr-only'
  announcer.textContent = message

  document.body.appendChild(announcer)

  setTimeout(() => {
    document.body.removeChild(announcer)
  }, 1000)
}

/**
 * Skip to main content link helper
 */
export function setupSkipLink(): void {
  if (typeof window === 'undefined') return

  const skipLink = document.querySelector<HTMLAnchorElement>('[data-skip-link]')
  if (!skipLink) return

  skipLink.addEventListener('click', (e) => {
    e.preventDefault()
    const target = document.querySelector<HTMLElement>(skipLink.getAttribute('href') || '#main')
    if (target) {
      target.tabIndex = -1
      target.focus()
      target.addEventListener(
        'blur',
        () => {
          target.removeAttribute('tabindex')
        },
        { once: true }
      )
    }
  })
}

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}`
}

/**
 * ARIA live region manager
 */
class LiveRegionManager {
  private politeRegion: HTMLElement | null = null
  private assertiveRegion: HTMLElement | null = null

  private getOrCreateRegion(priority: 'polite' | 'assertive'): HTMLElement {
    const existingRegion = priority === 'polite' ? this.politeRegion : this.assertiveRegion
    if (existingRegion && document.body.contains(existingRegion)) {
      return existingRegion
    }

    const region = document.createElement('div')
    region.id = `live-region-${priority}`
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', priority)
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only'
    document.body.appendChild(region)

    if (priority === 'polite') {
      this.politeRegion = region
    } else {
      this.assertiveRegion = region
    }

    return region
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = this.getOrCreateRegion(priority)
    // Clear and set to trigger announcement
    region.textContent = ''
    requestAnimationFrame(() => {
      region.textContent = message
    })
  }

  clear(): void {
    if (this.politeRegion) this.politeRegion.textContent = ''
    if (this.assertiveRegion) this.assertiveRegion.textContent = ''
  }
}

export const liveRegion = new LiveRegionManager()

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers dark color scheme
 */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * Keyboard navigation helpers
 */
export const keyboardNav = {
  /**
   * Handle arrow key navigation in a list
   */
  handleListNavigation(
    e: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    options: { loop?: boolean; vertical?: boolean } = {}
  ): number {
    const { loop = true, vertical = true } = options
    const key = e.key
    let newIndex = currentIndex

    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft'
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight'

    if (key === prevKey) {
      e.preventDefault()
      if (currentIndex > 0) {
        newIndex = currentIndex - 1
      } else if (loop) {
        newIndex = items.length - 1
      }
    } else if (key === nextKey) {
      e.preventDefault()
      if (currentIndex < items.length - 1) {
        newIndex = currentIndex + 1
      } else if (loop) {
        newIndex = 0
      }
    } else if (key === 'Home') {
      e.preventDefault()
      newIndex = 0
    } else if (key === 'End') {
      e.preventDefault()
      newIndex = items.length - 1
    }

    if (newIndex !== currentIndex && items[newIndex]) {
      items[newIndex].focus()
    }

    return newIndex
  },

  /**
   * Handle grid navigation (2D)
   */
  handleGridNavigation(
    e: KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    rowCount: number,
    colCount: number
  ): { row: number; col: number } {
    let newRow = rowIndex
    let newCol = colIndex

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        newRow = Math.max(0, rowIndex - 1)
        break
      case 'ArrowDown':
        e.preventDefault()
        newRow = Math.min(rowCount - 1, rowIndex + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        newCol = Math.max(0, colIndex - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        newCol = Math.min(colCount - 1, colIndex + 1)
        break
      case 'Home':
        e.preventDefault()
        if (e.ctrlKey) {
          newRow = 0
          newCol = 0
        } else {
          newCol = 0
        }
        break
      case 'End':
        e.preventDefault()
        if (e.ctrlKey) {
          newRow = rowCount - 1
          newCol = colCount - 1
        } else {
          newCol = colCount - 1
        }
        break
    }

    return { row: newRow, col: newCol }
  },
}

/**
 * ARIA attributes builder
 */
export function ariaAttrs(attrs: {
  label?: string
  labelledBy?: string
  describedBy?: string
  controls?: string
  expanded?: boolean
  selected?: boolean
  checked?: boolean | 'mixed'
  disabled?: boolean
  hidden?: boolean
  pressed?: boolean | 'mixed'
  current?: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
  live?: 'polite' | 'assertive' | 'off'
  busy?: boolean
  atomic?: boolean
  hasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  role?: string
}): Record<string, string | boolean | undefined> {
  const result: Record<string, string | boolean | undefined> = {}

  if (attrs.role) result.role = attrs.role
  if (attrs.label) result['aria-label'] = attrs.label
  if (attrs.labelledBy) result['aria-labelledby'] = attrs.labelledBy
  if (attrs.describedBy) result['aria-describedby'] = attrs.describedBy
  if (attrs.controls) result['aria-controls'] = attrs.controls
  if (attrs.expanded !== undefined) result['aria-expanded'] = attrs.expanded
  if (attrs.selected !== undefined) result['aria-selected'] = attrs.selected
  if (attrs.checked !== undefined) result['aria-checked'] = attrs.checked
  if (attrs.disabled !== undefined) result['aria-disabled'] = attrs.disabled
  if (attrs.hidden !== undefined) result['aria-hidden'] = attrs.hidden
  if (attrs.pressed !== undefined) result['aria-pressed'] = attrs.pressed
  if (attrs.current !== undefined) result['aria-current'] = attrs.current
  if (attrs.live) result['aria-live'] = attrs.live
  if (attrs.busy !== undefined) result['aria-busy'] = attrs.busy
  if (attrs.atomic !== undefined) result['aria-atomic'] = attrs.atomic
  if (attrs.hasPopup !== undefined) result['aria-haspopup'] = attrs.hasPopup

  return result
}
