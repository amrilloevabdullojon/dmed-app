'use client'

export function SkipToContent() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    if (main) {
      main.focus()
      main.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-teal-500 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
    >
      Перейти к основному содержимому
    </a>
  )
}
