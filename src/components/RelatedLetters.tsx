'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, ExternalLink, ChevronRight } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '@/lib/utils'
import type { LetterStatus } from '@/types/prisma'

interface RelatedLetter {
  id: string
  number: string
  org: string
  date: string
  status: LetterStatus
  content: string | null
}

interface RelatedLettersProps {
  currentLetterId: string
  organization: string
}

export function RelatedLetters({ currentLetterId, organization }: RelatedLettersProps) {
  const [letters, setLetters] = useState<RelatedLetter[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const loadRelated = async () => {
      try {
        const params = new URLSearchParams({
          org: organization,
          exclude: currentLetterId,
          limit: '10',
        })
        const res = await fetch(`/api/letters/related?${params}`)
        if (res.ok) {
          const data = await res.json()
          setLetters(data.letters || [])
        }
      } catch (error) {
        console.error('Failed to load related letters:', error)
      } finally {
        setLoading(false)
      }
    }

    if (organization) {
      loadRelated()
    } else {
      setLoading(false)
    }
  }, [currentLetterId, organization])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Загрузка связанных писем...</span>
        </div>
      </div>
    )
  }

  if (letters.length === 0) {
    return null
  }

  const displayLetters = expanded ? letters : letters.slice(0, 3)

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileText className="h-4 w-4 text-blue-400" />
          Другие письма от {organization}
        </h3>
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
          {letters.length}
        </span>
      </div>

      <div className="space-y-2">
        {displayLetters.map((letter) => (
          <Link
            key={letter.id}
            href={`/letters/${letter.id}`}
            className="group flex items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-900/50 p-3 transition hover:border-gray-600 hover:bg-gray-900"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-emerald-400">#{letter.number}</span>
                <StatusBadge status={letter.status} size="sm" />
              </div>
              {letter.content && (
                <p className="mt-1 truncate text-xs text-gray-400">{letter.content}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">{formatDate(letter.date)}</p>
            </div>
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-600 transition group-hover:text-gray-400" />
          </Link>
        ))}
      </div>

      {letters.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-blue-400 transition hover:text-blue-300"
        >
          {expanded ? 'Свернуть' : `Показать ещё ${letters.length - 3}`}
          <ChevronRight className={`h-4 w-4 transition ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  )
}


