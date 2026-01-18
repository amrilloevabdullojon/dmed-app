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
      className="fixed left-4 top-3 z-[200] -translate-y-full rounded-lg bg-teal-500 px-4 py-2 font-medium text-white opacity-0 shadow-lg transition-all duration-200 focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-teal-400 sm:left-6 lg:left-8"
    >
      Перейти к основному содержимому
    </a>
  )
}
