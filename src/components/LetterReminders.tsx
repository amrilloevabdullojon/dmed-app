'use client'

import { useState, useEffect } from 'react'
import { Bell, Plus, X, Clock, Check, Trash2, AlertTriangle } from 'lucide-react'
import type { LetterReminderType } from '@prisma/client'
import {
  REMINDER_TYPE_LABELS,
  REMINDER_TYPE_COLORS,
} from '@/lib/letter-reminders.constants'

type LetterReminder = {
  id: string
  type: LetterReminderType
  triggerDate: string
  message: string
  isActive: boolean
  isSent: boolean
  sentAt: string | null
  createdBy: {
    id: string
    name: string | null
    email: string | null
  } | null
  createdAt: string
}

interface LetterRemindersProps {
  letterId: string
}

export function LetterReminders({ letterId }: LetterRemindersProps) {
  const [reminders, setReminders] = useState<LetterReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const [newType, setNewType] = useState<LetterReminderType>('CUSTOM')
  const [newTriggerDate, setNewTriggerDate] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadReminders()
  }, [letterId])

  const loadReminders = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/letters/${letterId}/reminders`)
      if (res.ok) {
        const data = await res.json()
        setReminders(data.reminders || [])
      }
    } catch (error) {
      console.error('Failed to load reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newMessage.trim() || !newTriggerDate) return

    setCreating(true)
    try {
      const res = await fetch(`/api/letters/${letterId}/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token':
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({
          type: newType,
          triggerDate: new Date(newTriggerDate).toISOString(),
          message: newMessage,
        }),
      })

      if (res.ok) {
        setNewType('CUSTOM')
        setNewTriggerDate('')
        setNewMessage('')
        setShowCreate(false)
        loadReminders()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка создания напоминания')
      }
    } catch (error) {
      console.error('Failed to create reminder:', error)
      alert('Ошибка создания напоминания')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (reminderId: string) => {
    if (!confirm('Деактивировать это напоминание?')) return

    try {
      const res = await fetch(`/api/letters/${letterId}/reminders?reminderId=${reminderId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token':
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
        },
      })

      if (res.ok) {
        loadReminders()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка удаления')
      }
    } catch (error) {
      console.error('Failed to delete reminder:', error)
      alert('Ошибка удаления напоминания')
    }
  }

  const activeReminders = reminders.filter((r) => r.isActive && !r.isSent)
  const sentReminders = reminders.filter((r) => r.isSent)
  const inactiveReminders = reminders.filter((r) => !r.isActive && !r.isSent)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-white">Напоминания</h3>
          {activeReminders.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {activeReminders.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Отмена' : 'Добавить'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-4 p-4 bg-gray-700 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Тип</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as LetterReminderType)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(REMINDER_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Дата и время
            </label>
            <input
              type="datetime-local"
              value={newTriggerDate}
              onChange={(e) => setNewTriggerDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Сообщение</label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={2}
              placeholder="Текст напоминания..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !newMessage.trim() || !newTriggerDate}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {creating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Создать напоминание
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-400">Загрузка...</p>
        </div>
      )}

      {/* Reminders List */}
      {!loading && (
        <div className="space-y-3">
          {/* Active Reminders */}
          {activeReminders.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">
                Активные ({activeReminders.length})
              </h4>
              <div className="space-y-2">
                {activeReminders.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sent Reminders */}
          {sentReminders.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">
                Отправлено ({sentReminders.length})
              </h4>
              <div className="space-y-2">
                {sentReminders.slice(0, 3).map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {reminders.length === 0 && (
            <div className="text-center py-6">
              <Bell className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Нет напоминаний</p>
              <p className="text-xs text-gray-500 mt-1">
                Создайте напоминание или они будут созданы автоматически
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReminderCard({
  reminder,
  onDelete,
}: {
  reminder: LetterReminder
  onDelete: (id: string) => void
}) {
  const now = new Date()
  const triggerDate = new Date(reminder.triggerDate)
  const isOverdue = triggerDate < now && !reminder.isSent
  const color = REMINDER_TYPE_COLORS[reminder.type]

  return (
    <div
      className="p-3 bg-gray-700 rounded-lg border-l-4 transition hover:bg-gray-650"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">
              {REMINDER_TYPE_LABELS[reminder.type]}
            </span>
            {isOverdue && (
              <AlertTriangle className="w-4 h-4 text-red-400" title="Просрочено" />
            )}
            {reminder.isSent && (
              <Check className="w-4 h-4 text-green-400" title="Отправлено" />
            )}
          </div>

          <p className="text-sm text-gray-300 mb-2">{reminder.message}</p>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{triggerDate.toLocaleString('ru-RU')}</span>
            </div>
            {reminder.createdBy && (
              <span>• {reminder.createdBy.name || reminder.createdBy.email}</span>
            )}
          </div>
        </div>

        {reminder.isActive && !reminder.isSent && (
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-1.5 text-gray-400 hover:text-red-400 transition"
            title="Деактивировать"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
