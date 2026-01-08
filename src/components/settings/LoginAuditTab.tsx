'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { History, RefreshCw, Search, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { LoginAuditEntry, LoginAuditDaySummary } from '@/lib/settings-types'
import { LOGIN_STATUS_OPTIONS, fieldBase } from '@/lib/settings-types'

interface LoginAuditTabProps {
  onError?: (message: string) => void
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSummaryDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatLoginReason(reason: string | null): string {
  if (!reason) return '-'
  const labels: Record<string, string> = {
    RATE_LIMIT: 'Слишком много попыток',
    USER_NOT_FOUND: 'Пользователь не найден',
    ACCESS_BLOCKED: 'Доступ закрыт',
  }
  return labels[reason] || reason
}

function getLoginStatusBadge(success: boolean) {
  return success ? (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">
      <CheckCircle className="h-3 w-3" />
      Успешно
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">
      <XCircle className="h-3 w-3" />
      Ошибка
    </span>
  )
}

export function LoginAuditTab({ onError }: LoginAuditTabProps) {
  const [loginAudits, setLoginAudits] = useState<LoginAuditEntry[]>([])
  const [loginAuditSummary, setLoginAuditSummary] = useState<LoginAuditDaySummary[]>([])
  const [loginAuditLoading, setLoginAuditLoading] = useState(true)
  const [loginAuditCursor, setLoginAuditCursor] = useState<string | null>(null)
  const [loginAuditStatus, setLoginAuditStatus] = useState<'all' | 'success' | 'failure'>('all')
  const [loginAuditQuery, setLoginAuditQuery] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadLoginAudits = useCallback(
    async (mode: 'replace' | 'more' = 'replace') => {
      setLoginAuditLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('take', '20')
        if (mode === 'more' && loginAuditCursor) {
          params.set('cursor', loginAuditCursor)
        }
        if (loginAuditStatus !== 'all') {
          params.set('status', loginAuditStatus)
        }
        if (loginAuditQuery.trim()) {
          params.set('q', loginAuditQuery.trim())
        }

        const res = await fetch(`/api/security/logins?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (mode === 'more') {
            setLoginAudits((prev) => [...prev, ...(data.events || [])])
          } else {
            setLoginAudits(data.events || [])
            setLoginAuditSummary(data.summary || [])
          }
          setLoginAuditCursor(data.nextCursor || null)
        } else {
          onError?.('Не удалось загрузить журнал входов')
        }
      } catch (error) {
        console.error('Failed to load login audits:', error)
        onError?.('Ошибка загрузки журнала')
      } finally {
        setLoginAuditLoading(false)
      }
    },
    [loginAuditCursor, loginAuditStatus, loginAuditQuery, onError]
  )

  // Initial load and filter changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      loadLoginAudits('replace')
    }, 400)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [loginAuditStatus, loginAuditQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = useCallback(() => {
    setLoginAuditStatus('all')
    setLoginAuditQuery('')
  }, [])

  return (
    <div className="panel panel-glass mb-8 rounded-2xl p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">Безопасность: входы</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
            Безопасность
          </span>
        </div>
        <button
          onClick={() => loadLoginAudits('replace')}
          disabled={loginAuditLoading}
          aria-label="Обновить журнал"
          className="p-2 text-gray-400 transition hover:text-white disabled:opacity-50"
          title="Обновить"
        >
          <RefreshCw className={`h-5 w-5 ${loginAuditLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          value={loginAuditStatus}
          onChange={(e) => setLoginAuditStatus(e.target.value as 'all' | 'success' | 'failure')}
          className={`${fieldBase} w-full px-3 py-2`}
          aria-label="Статус входа"
        >
          {LOGIN_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={loginAuditQuery}
            onChange={(e) => setLoginAuditQuery(e.target.value)}
            className={`${fieldBase} w-full py-2 pl-9 pr-3`}
            placeholder="Поиск по email или имени"
            aria-label="Поиск"
          />
        </div>
        <button
          onClick={resetFilters}
          className="rounded border border-white/10 px-3 py-2 text-gray-300 hover:bg-white/5 hover:text-white"
        >
          Сбросить
        </button>
      </div>

      {/* Summary Cards */}
      {loginAuditSummary.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {loginAuditSummary.map((day) => (
            <div key={day.date} className="panel-soft panel-glass rounded-xl p-3">
              <div className="text-xs text-gray-400">{formatSummaryDate(day.date)}</div>
              <div className="text-sm text-white">{day.success} успешно</div>
              <div className="text-xs text-red-400">{day.failure} ошибок</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loginAuditLoading && loginAudits.length === 0 ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/5"
            />
          ))}
        </div>
      ) : loginAudits.length > 0 ? (
        <>
          {/* Mobile View */}
          <div className="space-y-3 sm:hidden">
            {loginAudits.map((event) => {
              const displayName = event.user?.name || event.user?.email || event.email
              return (
                <div key={event.id} className="panel-soft panel-glass rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white">{displayName}</div>
                      <div className="text-xs text-gray-500">{event.email}</div>
                    </div>
                    {getLoginStatusBadge(event.success)}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">{formatDate(event.createdAt)}</div>
                  <div className="mt-2 text-xs text-gray-400">
                    {formatLoginReason(event.reason)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop View */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Дата</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Пользователь</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Результат</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Причина</th>
                </tr>
              </thead>
              <tbody>
                {loginAudits.map((event) => {
                  const displayName = event.user?.name || event.user?.email || event.email
                  return (
                    <tr key={event.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(event.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-white">{displayName}</div>
                        <div className="text-xs text-gray-500">{event.email}</div>
                      </td>
                      <td className="px-4 py-3">{getLoginStatusBadge(event.success)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatLoginReason(event.reason)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="py-8 text-center text-gray-500">Нет данных</div>
      )}

      {/* Load More */}
      {loginAuditCursor && (
        <div className="mt-4">
          <button
            onClick={() => loadLoginAudits('more')}
            disabled={loginAuditLoading}
            className="text-sm text-emerald-400 transition hover:text-emerald-300 disabled:opacity-50"
          >
            {loginAuditLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </span>
            ) : (
              'Показать ещё'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
