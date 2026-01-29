'use client'

import { memo, useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar,
  Clock,
  User,
  AlertTriangle,
  Send,
  CheckCircle2,
  Bell,
  Loader2,
  Edit3,
  Check,
  X,
} from 'lucide-react'
import { SLAIndicator } from '@/components/SLAIndicator'
import { OwnerSelector, type OwnerOption } from '@/components/OwnerSelector'
import {
  formatDate,
  getPriorityLabel,
  getWorkingDaysUntilDeadline,
  isDoneStatus,
} from '@/lib/utils'
import type { Letter } from '../types'

interface LetterInfoProps {
  letter: Letter
  updating: boolean
  notifyingOwner: boolean
  canManageLetters: boolean
  onPostponeDeadline: () => void
  onEscalate: () => void
  onNotifyOwner: () => void
  onSaveField?: (field: string, value: string) => Promise<void>
  onChangeOwner?: (ownerId: string | null) => Promise<void>
}

// Компонент для редактирования даты
function EditableDate({
  label,
  value,
  field,
  icon: Icon,
  colorClass = 'text-white',
  canEdit,
  onSave,
}: {
  label: string
  value: string
  field: string
  icon: React.ElementType
  colorClass?: string
  canEdit: boolean
  onSave?: (field: string, value: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    // Преобразуем дату в формат YYYY-MM-DD для input
    const date = new Date(value)
    const formatted = date.toISOString().split('T')[0]
    setEditValue(formatted)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const saveDate = async () => {
    if (!onSave || !editValue) return
    setSaving(true)
    try {
      await onSave(field, new Date(editValue).toISOString())
      setIsEditing(false)
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-slate-500" />
        <div className="flex-1">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-700/50 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={saveDate}
              disabled={saving}
              className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-50"
              title="Сохранить"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-lg bg-red-500/20 p-1.5 text-red-400 transition hover:bg-red-500/30 disabled:opacity-50"
              title="Отмена"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3">
      <Icon className="h-5 w-5 text-slate-500" />
      <div className="flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`flex items-center gap-2 ${colorClass}`}>
          <span>{formatDate(value)}</span>
          {canEdit && onSave && (
            <button
              onClick={startEditing}
              className="rounded p-1 opacity-0 transition hover:bg-white/10 group-hover:opacity-100"
              title="Редактировать"
            >
              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const LetterInfo = memo(function LetterInfo({
  letter,
  updating,
  notifyingOwner,
  canManageLetters,
  onPostponeDeadline,
  onEscalate,
  onNotifyOwner,
  onSaveField,
  onChangeOwner,
}: LetterInfoProps) {
  const [users, setUsers] = useState<OwnerOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const isDone = isDoneStatus(letter.status)
  const isOverdue = !isDone && daysLeft < 0
  const priorityInfo = getPriorityLabel(letter.priority)

  const notifyDisabledReason = !canManageLetters
    ? 'Недостаточно прав для уведомлений'
    : !letter.owner?.id
      ? 'Нет назначенного сотрудника'
      : !letter.owner?.telegramChatId
        ? 'У исполнителя нет Telegram ID'
        : null

  const notifyDisabled = notifyingOwner || !!notifyDisabledReason

  // Загрузка списка пользователей при монтировании (только если есть права)
  useEffect(() => {
    if (!canManageLetters) return

    let cancelled = false
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (!cancelled) {
          setUsers(data.users || [])
        }
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        if (!cancelled) {
          setLoadingUsers(false)
        }
      }
    }

    loadUsers()
    return () => { cancelled = true }
  }, [canManageLetters])

  const currentOwner: OwnerOption | null = useMemo(() =>
    letter.owner
      ? {
          id: letter.owner.id,
          name: letter.owner.name,
          email: letter.owner.email,
        }
      : null,
    [letter.owner?.id, letter.owner?.name, letter.owner?.email]
  )

  return (
    <div className="panel panel-glass rounded-2xl p-4 md:p-5">
      <h3 className="mb-4 font-semibold text-white">Информация</h3>

      <div className="space-y-4">
        <EditableDate
          label="Дата письма"
          value={letter.date}
          field="date"
          icon={Calendar}
          canEdit={canManageLetters}
          onSave={onSaveField}
        />

        <EditableDate
          label="Дедлайн"
          value={letter.deadlineDate}
          field="deadlineDate"
          icon={Clock}
          colorClass={isOverdue ? 'text-red-400' : isDone ? 'text-teal-400' : 'text-white'}
          canEdit={canManageLetters && !isDone}
          onSave={onSaveField}
        />

        <div className="border-t border-slate-700/50 pt-2">
          <SLAIndicator
            createdAt={letter.date}
            deadlineDate={letter.deadlineDate}
            status={letter.status}
            closedAt={letter.closeDate}
            size="md"
          />
        </div>

        {!isDone && (
          <div className="flex flex-wrap gap-2 border-t border-slate-700/50 pt-3">
            <button
              onClick={onPostponeDeadline}
              disabled={updating}
              className="btn-secondary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              Перенести дедлайн
            </button>
            <button
              onClick={onEscalate}
              disabled={updating}
              className="btn-secondary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-amber-300 transition disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Эскалировать
            </button>
          </div>
        )}

        {/* Исполнитель - с возможностью смены */}
        <div className="border-t border-slate-700/50 pt-3">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-slate-500" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 text-xs text-slate-500">Исполнитель</div>
              {canManageLetters && onChangeOwner ? (
                <OwnerSelector
                  currentOwner={currentOwner}
                  users={users}
                  onSelect={onChangeOwner}
                  disabled={updating || loadingUsers}
                  canEdit={canManageLetters}
                  placeholder="Назначить исполнителя"
                />
              ) : (
                <div className="text-white">
                  {letter.owner?.name || letter.owner?.email || 'Не назначен'}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onNotifyOwner}
          disabled={notifyDisabled}
          title={notifyDisabledReason || 'Отправить уведомление'}
          className="btn-secondary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:opacity-50"
        >
          {notifyingOwner ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Уведомить исполнителя
        </button>
        {notifyDisabledReason && (
          <div className="text-xs text-slate-500">{notifyDisabledReason}</div>
        )}

        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-slate-500" />
          <div>
            <div className="mb-1 text-xs text-slate-500">Приоритет</div>
            <div className={`font-medium ${priorityInfo.color}`}>
              {priorityInfo.label} ({letter.priority})
            </div>
          </div>
        </div>

        {letter.ijroDate && (
          <EditableDate
            label="Дата ответа в IJRO"
            value={letter.ijroDate}
            field="ijroDate"
            icon={Send}
            canEdit={canManageLetters}
            onSave={onSaveField}
          />
        )}

        {letter.closeDate && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-teal-500" />
            <div>
              <div className="text-xs text-slate-500">Дата закрытия</div>
              <div className="text-teal-400">{formatDate(letter.closeDate)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
