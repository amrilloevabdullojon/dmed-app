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
      className="absolute left-4 top-4 z-[100] -translate-y-16 rounded-lg bg-teal-500 px-4 py-2 font-medium text-white shadow-lg transition-transform duration-200 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900"
    >
      Перейти к основному содержимому
    </a>
  )
}
