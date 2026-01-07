'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  FileText,
  Inbox,
  User,
  BarChart3,
  Settings,
  Home,
  Loader2,
  Command,
} from 'lucide-react'
import { createPortal } from 'react-dom'

interface SearchResult {
  id: string
  type: 'letter' | 'request' | 'user' | 'page'
  title: string
  subtitle?: string
  url: string
  icon: React.ReactNode
}

const STATIC_PAGES: SearchResult[] = [
  { id: 'home', type: 'page', title: 'Главная', url: '/', icon: <Home className="h-4 w-4" /> },
  {
    id: 'letters',
    type: 'page',
    title: 'Письма',
    url: '/letters',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'requests',
    type: 'page',
    title: 'Заявки',
    url: '/requests',
    icon: <Inbox className="h-4 w-4" />,
  },
  {
    id: 'reports',
    type: 'page',
    title: 'Отчёты',
    url: '/reports',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'settings',
    type: 'page',
    title: 'Настройки',
    url: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: 'new-letter',
    type: 'page',
    title: 'Новое письмо',
    url: '/letters/new',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'new-request',
    type: 'page',
    title: 'Подать заявку',
    url: '/request',
    icon: <Inbox className="h-4 w-4" />,
  },
]

export function GlobalSearch() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Search logic
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(STATIC_PAGES)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Filter static pages
      const filteredPages = STATIC_PAGES.filter((page) =>
        page.title.toLowerCase().includes(q.toLowerCase())
      )

      // Search letters
      const lettersRes = await fetch(`/api/letters?q=${encodeURIComponent(q)}&limit=5`)
      const lettersData = lettersRes.ok ? await lettersRes.json() : { letters: [] }
      const letterResults: SearchResult[] = (lettersData.letters || []).map(
        (letter: { id: string; number: string; org: string }) => ({
          id: letter.id,
          type: 'letter' as const,
          title: `Письмо ${letter.number}`,
          subtitle: letter.org,
          url: `/letters/${letter.id}`,
          icon: <FileText className="h-4 w-4 text-blue-400" />,
        })
      )

      // Search requests
      const requestsRes = await fetch(`/api/requests?q=${encodeURIComponent(q)}&limit=5`)
      const requestsData = requestsRes.ok ? await requestsRes.json() : { requests: [] }
      const requestResults: SearchResult[] = (requestsData.requests || []).map(
        (request: { id: string; organization: string; contactName: string }) => ({
          id: request.id,
          type: 'request' as const,
          title: request.organization,
          subtitle: request.contactName,
          url: `/requests/${request.id}`,
          icon: <Inbox className="h-4 w-4 text-emerald-400" />,
        })
      )

      // Search users
      const usersRes = await fetch(`/api/users?q=${encodeURIComponent(q)}&limit=5`)
      const usersData = usersRes.ok ? await usersRes.json() : { users: [] }
      const userResults: SearchResult[] = (usersData.users || []).map(
        (user: { id: string; name: string | null; email: string | null }) => ({
          id: user.id,
          type: 'user' as const,
          title: user.name || user.email || 'Пользователь',
          subtitle: user.email || undefined,
          url: `/users/${user.id}`,
          icon: <User className="h-4 w-4 text-purple-400" />,
        })
      )

      setResults([...filteredPages, ...letterResults, ...requestResults, ...userResults])
    } catch (error) {
      console.error('Search error:', error)
      setResults(STATIC_PAGES.filter((page) => page.title.toLowerCase().includes(q.toLowerCase())))
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setResults(STATIC_PAGES)
      return
    }

    debounceRef.current = setTimeout(() => {
      search(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, search])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      router.push(results[selectedIndex].url)
      setIsOpen(false)
    }
  }

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  if (!isOpen) return null

  const content = (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Search modal */}
      <div className="panel panel-glass animate-scaleIn relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-5 w-5 flex-shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по письмам, заявкам, пользователям..."
            className="flex-1 bg-transparent text-base text-white placeholder-slate-400 outline-none"
          />
          {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          <button onClick={() => setIsOpen(false)} className="app-icon-button p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    router.push(result.url)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                    index === selectedIndex
                      ? 'bg-teal-500/20 text-white'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="flex-shrink-0">{result.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{result.title}</div>
                    {result.subtitle && (
                      <div className="truncate text-sm text-slate-400">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="text-xs capitalize text-slate-500">
                    {result.type === 'page'
                      ? 'Страница'
                      : result.type === 'letter'
                        ? 'Письмо'
                        : result.type === 'request'
                          ? 'Заявка'
                          : 'Пользователь'}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() && !loading ? (
            <div className="py-8 text-center text-slate-400">Ничего не найдено</div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="app-kbd">↑↓</kbd>
              навигация
            </span>
            <span className="flex items-center gap-1">
              <kbd className="app-kbd">Enter</kbd>
              открыть
            </span>
            <span className="flex items-center gap-1">
              <kbd className="app-kbd">Esc</kbd>
              закрыть
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(content, document.body)
}

// Search trigger button for header
export function SearchButton() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleClick = () => {
    // Trigger the keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }

  if (!isClient) return null

  return (
    <button
      onClick={handleClick}
      className="app-pill hidden items-center gap-2 text-sm md:flex"
      title="Поиск (Ctrl+K)"
    >
      <Search className="h-4 w-4" />
      <span className="hidden lg:inline">Поиск</span>
      <kbd className="app-kbd hidden lg:inline">
        <Command className="inline h-3 w-3" />K
      </kbd>
    </button>
  )
}
