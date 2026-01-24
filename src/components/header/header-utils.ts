import type { MouseEvent } from 'react'

export function scheduleFallbackNavigation(
  event: MouseEvent<HTMLElement>,
  href?: string | null
): void {
  if (!href) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.setTimeout(() => {
    const after = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (after === current) {
      window.location.assign(href)
    }
  }, 350)
}
