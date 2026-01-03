'use client'

import { ReactNode } from 'react'
import { Inbox, FileText, Search, AlertCircle, FolderOpen, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyStateVariant = 'requests' | 'letters' | 'search' | 'error' | 'files' | 'comments' | 'default'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

const VARIANTS: Record<EmptyStateVariant, {
  icon: typeof Inbox
  defaultTitle: string
  defaultDescription: string
  iconColor: string
  bgColor: string
}> = {
  requests: {
    icon: Inbox,
    defaultTitle: 'Заявок пока нет',
    defaultDescription: 'Новые заявки появятся здесь',
    iconColor: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
  },
  letters: {
    icon: FileText,
    defaultTitle: 'Писем не найдено',
    defaultDescription: 'Письма появятся после синхронизации',
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  search: {
    icon: Search,
    defaultTitle: 'Ничего не найдено',
    defaultDescription: 'Попробуйте изменить параметры поиска',
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  error: {
    icon: AlertCircle,
    defaultTitle: 'Произошла ошибка',
    defaultDescription: 'Не удалось загрузить данные',
    iconColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  files: {
    icon: FolderOpen,
    defaultTitle: 'Нет файлов',
    defaultDescription: 'Прикреплённые файлы появятся здесь',
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  comments: {
    icon: MessageSquare,
    defaultTitle: 'Нет комментариев',
    defaultDescription: 'Будьте первым, кто оставит комментарий',
    iconColor: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
  },
  default: {
    icon: Inbox,
    defaultTitle: 'Пусто',
    defaultDescription: 'Здесь пока ничего нет',
    iconColor: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
  },
}

export function EmptyState({
  variant = 'default',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = VARIANTS[variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'panel panel-glass rounded-2xl p-8 flex flex-col items-center justify-center text-center animate-fadeIn',
        className
      )}
    >
      <div className={cn('rounded-full p-4 mb-4', config.bgColor)}>
        <Icon className={cn('w-8 h-8', config.iconColor)} />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">
        {title || config.defaultTitle}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        {description || config.defaultDescription}
      </p>
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  )
}

/**
 * Compact empty state for inline use
 */
export function EmptyStateCompact({
  variant = 'default',
  message,
  className,
}: {
  variant?: EmptyStateVariant
  message?: string
  className?: string
}) {
  const config = VARIANTS[variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg text-slate-400',
        config.bgColor,
        className
      )}
    >
      <Icon className={cn('w-5 h-5', config.iconColor)} />
      <span className="text-sm">{message || config.defaultTitle}</span>
    </div>
  )
}
