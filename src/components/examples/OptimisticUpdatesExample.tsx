'use client'

/**
 * Optimistic Updates Example
 *
 * Демонстрация мгновенных обновлений UI с автоматическим rollback при ошибках
 */

import { useEffect } from 'react'
import { useLettersOptimisticStore } from '@/stores/letters-optimistic-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  User,
} from 'lucide-react'

const STATUS_LABELS = {
  NOT_REVIEWED: 'Не рассмотрено',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнено',
  ARCHIVED: 'В архиве',
}

const STATUS_COLORS = {
  NOT_REVIEWED: 'destructive',
  IN_PROGRESS: 'default',
  COMPLETED: 'secondary',
  ARCHIVED: 'outline',
} as const

export function OptimisticUpdatesExample() {
  const {
    letters,
    addLetter,
    optimisticUpdateStatus,
    optimisticUpdatePriority,
    optimisticAssign,
    rollbackUpdate,
    confirmUpdate,
    getFilteredLetters,
    getPendingUpdatesCount,
  } = useLettersOptimisticStore()

  const filteredLetters = getFilteredLetters()
  const pendingCount = getPendingUpdatesCount()

  // Инициализация демо данных
  useEffect(() => {
    if (letters.size === 0) {
      // Добавляем тестовые письма
      addLetter({
        id: '1',
        number: '101/2024',
        org: 'ООО "Альфа"',
        status: 'NOT_REVIEWED',
        priority: 50,
        assignedToId: null,
        updatedAt: new Date(),
      })
      addLetter({
        id: '2',
        number: '102/2024',
        org: 'ЗАО "Бета"',
        status: 'IN_PROGRESS',
        priority: 75,
        assignedToId: 'user1',
        updatedAt: new Date(),
      })
      addLetter({
        id: '3',
        number: '103/2024',
        org: 'ИП Сидоров',
        status: 'COMPLETED',
        priority: 30,
        assignedToId: 'user2',
        updatedAt: new Date(),
      })
    }
  }, [letters.size, addLetter])

  // Имитация успешного обновления
  const handleStatusChange = async (id: string, newStatus: any) => {
    const updateId = `${id}-status-${Date.now()}`

    // Оптимистичное обновление - UI меняется мгновенно
    optimisticUpdateStatus(id, newStatus)
    toast.success('Статус изменен мгновенно!')

    // Имитация API запроса
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Успех - подтверждаем обновление
      confirmUpdate(updateId)
      toast.success('Изменения сохранены на сервере')
    } catch (error) {
      // Ошибка - откатываем изменения
      rollbackUpdate(updateId)
      toast.error('Ошибка! Изменения отменены')
    }
  }

  // Имитация обновления приоритета
  const handlePriorityChange = async (id: string, delta: number) => {
    const letter = letters.get(id)
    if (!letter) return

    const newPriority = Math.max(0, Math.min(100, letter.priority + delta))
    const updateId = `${id}-priority-${Date.now()}`

    optimisticUpdatePriority(id, newPriority)

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      confirmUpdate(updateId)
      toast.success('Приоритет обновлен')
    } catch {
      rollbackUpdate(updateId)
      toast.error('Не удалось обновить приоритет')
    }
  }

  // Имитация назначения исполнителя
  const handleAssign = async (id: string) => {
    const updateId = `${id}-assign-${Date.now()}`
    const randomUser = Math.random() > 0.5 ? 'user1' : 'user2'

    optimisticAssign(id, randomUser)

    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      confirmUpdate(updateId)
      toast.success('Исполнитель назначен')
    } catch {
      rollbackUpdate(updateId)
      toast.error('Ошибка назначения')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Optimistic Updates - Мгновенный отклик UI</CardTitle>
            <CardDescription>
              UI обновляется мгновенно, автоматический rollback при ошибках
            </CardDescription>
          </div>
          {pendingCount > 0 && (
            <Badge variant="outline" className="gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {pendingCount} в процессе
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Letters List */}
        <div className="space-y-3">
          {filteredLetters.map((letter) => (
            <div
              key={letter.id}
              className="rounded-lg border border-white/10 bg-slate-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-teal-400">{letter.number}</span>
                    <Badge variant={STATUS_COLORS[letter.status]}>
                      {STATUS_LABELS[letter.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400">{letter.org}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-24 rounded-full bg-gradient-to-r from-gray-500 to-teal-500"
                        style={{
                          background: `linear-gradient(to right, ${
                            letter.priority >= 80
                              ? '#ef4444'
                              : letter.priority >= 50
                                ? '#f59e0b'
                                : '#6b7280'
                          }, ${
                            letter.priority >= 80
                              ? '#dc2626'
                              : letter.priority >= 50
                                ? '#d97706'
                                : '#4b5563'
                          })`,
                        }}
                      >
                        <div
                          className="h-full rounded-full bg-white/30"
                          style={{ width: `${letter.priority}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{letter.priority}</span>
                    </div>
                    {letter.assignedToId && (
                      <Badge variant="outline" className="gap-1">
                        <User className="h-3 w-3" />
                        {letter.assignedToId}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(letter.id, 'IN_PROGRESS')}
                      disabled={letter.status === 'IN_PROGRESS'}
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(letter.id, 'COMPLETED')}
                      disabled={letter.status === 'COMPLETED'}
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(letter.id, 'ARCHIVED')}
                      disabled={letter.status === 'ARCHIVED'}
                    >
                      <AlertCircle className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePriorityChange(letter.id, 10)}
                    >
                      <TrendingUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePriorityChange(letter.id, -10)}
                    >
                      <TrendingDown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAssign(letter.id)}
                    >
                      <User className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
          <h4 className="mb-2 text-sm font-medium text-white">Как это работает:</h4>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>✅ <strong>Мгновенный отклик</strong> - UI обновляется сразу при клике</li>
            <li>✅ <strong>Автоматический rollback</strong> - откат при ошибках API</li>
            <li>✅ <strong>Оптимистичные обновления</strong> - не ждем ответа сервера</li>
            <li>✅ <strong>Zustand + Immer</strong> - иммутабельные обновления состояния</li>
            <li>
              ✅ <strong>Persist</strong> - сохранение в localStorage между сессиями
            </li>
            <li>✅ <strong>DevTools</strong> - отладка в Redux DevTools Extension</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
