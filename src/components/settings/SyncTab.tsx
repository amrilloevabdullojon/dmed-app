'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ArrowUpFromLine,
  ArrowDownToLine,
} from 'lucide-react'
import type { SyncLog } from '@/lib/settings-types'

interface SyncTabProps {
  onSuccess?: (message: string) => void
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

function getStatusBadge(status: SyncLog['status']) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">
          <CheckCircle className="h-3 w-3" />
          Успешно
        </span>
      )
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">
          <XCircle className="h-3 w-3" />
          Ошибка
        </span>
      )
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />В процессе
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded bg-gray-500/20 px-2 py-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          Ожидание
        </span>
      )
  }
}

export function SyncTab({ onSuccess, onError }: SyncTabProps) {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const loadSyncLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sync')
      if (res.ok) {
        const data = await res.json()
        setSyncLogs(data.logs || [])
      } else {
        onError?.('Не удалось загрузить логи синхронизации')
      }
    } catch (error) {
      console.error('Failed to load sync logs:', error)
      onError?.('Ошибка загрузки логов')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    loadSyncLogs()
  }, [loadSyncLogs])

  const triggerSync = useCallback(
    async (direction: 'to_sheets' | 'from_sheets') => {
      setSyncing(true)
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction }),
        })
        if (res.ok) {
          onSuccess?.(
            direction === 'to_sheets'
              ? 'Синхронизация в Sheets запущена'
              : 'Синхронизация из Sheets запущена'
          )
          loadSyncLogs()
        } else {
          const data = await res.json().catch(() => ({}))
          onError?.(data.error || 'Ошибка запуска синхронизации')
        }
      } catch (error) {
        console.error('Sync trigger failed:', error)
        onError?.('Ошибка запуска синхронизации')
      } finally {
        setSyncing(false)
      }
    },
    [loadSyncLogs, onSuccess, onError]
  )

  return (
    <div className="panel panel-glass mb-8 rounded-2xl p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">Логи синхронизации</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
            Интеграции
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerSync('to_sheets')}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
            title="Синхронизировать в Sheets"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpFromLine className="h-4 w-4" />
            )}
            В Sheets
          </button>
          <button
            onClick={() => triggerSync('from_sheets')}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
            title="Синхронизировать из Sheets"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-4 w-4" />
            )}
            Из Sheets
          </button>
          <button
            onClick={loadSyncLogs}
            disabled={loading}
            aria-label="Обновить логи"
            className="p-2 text-gray-400 transition hover:text-white disabled:opacity-50"
            title="Обновить"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/5"
            />
          ))}
        </div>
      ) : syncLogs.length > 0 ? (
        <>
          {/* Mobile View */}
          <div className="space-y-3 sm:hidden">
            {syncLogs.map((log) => {
              const duration = log.finishedAt
                ? Math.round(
                    (new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000
                  )
                : null

              return (
                <div key={log.id} className="panel-soft panel-glass rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-gray-300">{formatDate(log.startedAt)}</div>
                    {getStatusBadge(log.status)}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    {log.direction === 'TO_SHEETS' ? (
                      <>
                        <ArrowUpFromLine className="h-4 w-4 text-blue-400" />
                        <span className="text-blue-400">В Sheets</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="h-4 w-4 text-purple-400" />
                        <span className="text-purple-400">Из Sheets</span>
                      </>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>Записей: {log.rowsAffected}</div>
                    <div>Время: {duration !== null ? `${duration} сек` : '-'}</div>
                  </div>
                  {log.error && (
                    <div className="mt-3 text-xs text-red-400">
                      {log.error.substring(0, 80)}
                      {log.error.length > 80 ? '...' : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop View */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Время</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Направление</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Записей</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Длительность</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => {
                  const duration = log.finishedAt
                    ? Math.round(
                        (new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) /
                          1000
                      )
                    : null

                  return (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(log.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm">
                          {log.direction === 'TO_SHEETS' ? (
                            <>
                              <ArrowUpFromLine className="h-4 w-4 text-blue-400" />
                              <span className="text-blue-400">В Sheets</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownToLine className="h-4 w-4 text-purple-400" />
                              <span className="text-purple-400">Из Sheets</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(log.status)}</td>
                      <td className="px-4 py-3 text-white">{log.rowsAffected}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {duration !== null ? `${duration} сек` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {log.error && (
                          <span
                            className="block max-w-xs truncate text-xs text-red-400"
                            title={log.error}
                          >
                            {log.error.substring(0, 50)}
                            {log.error.length > 50 ? '...' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="py-8 text-center text-gray-500">Нет записей синхронизации</div>
      )}
    </div>
  )
}
