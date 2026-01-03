'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'
import { EditableField } from '@/components/EditableField'
import { FileUpload } from '@/components/FileUpload'
import { TemplateSelector } from '@/components/TemplateSelector'
import { ActivityFeed } from '@/components/ActivityFeed'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { LetterStatus } from '@prisma/client'
import {
  STATUS_LABELS,
  formatDate,
  getDaysUntilDeadline,
  pluralizeDays,
  getPriorityLabel,
  isDoneStatus,
} from '@/lib/utils'
import { LETTER_TYPES } from '@/lib/constants'
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Send,
  Trash2,
  Copy,
  Printer,
  Star,
  Bell,
  MessageSquare,
  Link2,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useOptimisticList } from '@/hooks/useOptimistic'

interface CommentItem {
  id: string
  text: string
  createdAt: string
  author: {
    id: string
    name: string | null
    email: string | null
  }
  replies?: CommentItem[]
}

interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  content: string | null
  comment: string | null
  contacts: string | null
  applicantName: string | null
  applicantEmail: string | null
  applicantPhone: string | null
  applicantTelegramChatId: string | null
  applicantAccessToken: string | null
  applicantAccessTokenExpiresAt: string | null
  priority: number
  jiraLink: string | null
  zordoc: string | null
  answer: string | null
  sendStatus: string | null
  ijroDate: string | null
  closeDate: string | null
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  files: Array<{
    id: string
    name: string
    url: string
    size?: number | null
    mimeType?: string | null
    status?: string | null
    uploadError?: string | null
  }>
  comments: CommentItem[]
  history: Array<{
    id: string
    field: string
    oldValue: string | null
    newValue: string | null
    createdAt: string
    user: {
      name: string | null
      email: string | null
    }
  }>
  isWatching: boolean
  isFavorite: boolean
}

const STATUSES: LetterStatus[] = [
  'NOT_REVIEWED',
  'ACCEPTED',
  'IN_PROGRESS',
  'CLARIFICATION',
  'READY',
  'DONE',
]

export default function LetterDetailPage() {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const params = useParams()
  const router = useRouter()
  const { confirm: confirmDialog, Dialog } = useConfirmDialog()
  const toast = useToast()

  const [letter, setLetter] = useState<Letter | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [notifyingOwner, setNotifyingOwner] = useState(false)
  const [commentText, setCommentText] = useState('')
  const {
    items: comments,
    add: addComment,
    pending: commentPending,
    setItems: setComments,
  } = useOptimisticList<CommentItem>([], {
    addFn: async (item) => {
      if (!letter) {
        throw new Error('Missing letter')
      }
      const res = await fetch(`/api/letters/${letter.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.text }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add comment")
      }
      return data.comment as CommentItem
    },
    onError: (error) => {
      console.error(error)
      toast.error('Не удалось добавить комментарий')
    },
  })
  const isCommentSubmitting = commentPending.size > 0
  const [portalLink, setPortalLink] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)

  const loadLetter = useCallback(async () => {
    try {
      const res = await fetch(`/api/letters/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setLetter(data)
      } else {
        router.push('/letters')
      }
    } catch (error) {
      console.error('Failed to load letter:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    if (authStatus === 'authenticated' && params.id) {
      loadLetter()
    }
  }, [authStatus, params.id, loadLetter])

  useEffect(() => {
    if (letter?.comments) {
      setComments(letter.comments)
    } else {
      setComments([])
    }
  }, [letter, setComments])

  useEffect(() => {
    if (letter?.applicantAccessToken && typeof window !== 'undefined') {
      setPortalLink(`${window.location.origin}/portal/${letter.applicantAccessToken}`)
    } else {
      setPortalLink('')
    }
  }, [letter?.applicantAccessToken])

  const updateField = async (field: string, value: string) => {
    if (!letter) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/letters/${letter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })

      if (res.ok) {
        await loadLetter()
      }
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setUpdating(false)
    }
  }

  const deleteLetter = async () => {
    if (!letter) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/letters/${letter.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Письмо удалено')
        router.push('/letters')
      } else {
        toast.error('Не удалось удалить письмо')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Ошибка при удалении письма')
    } finally {
      setDeleting(false)
    }
  }

  const handleDelete = useCallback(() => {
    if (!letter) return
    confirmDialog({
      title: 'Удалить письмо?',
      message: 'Вы уверены, что хотите удалить это письмо? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
      onConfirm: deleteLetter,
    })
  }, [confirmDialog, deleteLetter, letter])

  const handleDuplicate = async () => {
    if (!letter) return

    setDuplicating(true)
    try {
      const res = await fetch(`/api/letters/${letter.id}/duplicate`, {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Письмо скопировано')
        router.push(`/letters/${data.id}`)
      } else {
        toast.error(data.error || 'Не удалось дублировать письмо')
      }
    } catch (error) {
      console.error('Failed to duplicate:', error)
      toast.error('Ошибка при дублировании письма')
    } finally {
      setDuplicating(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleNotifyOwner = async () => {
    if (!letter) return
    if (!letter.owner?.id) {
      toast.error('\u041d\u0435\u0442 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u043e\u0433\u043e \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430')
      return
    }

    setNotifyingOwner(true)
    const toastId = toast.loading('\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435...')

    try {
      const res = await fetch(`/api/letters/${letter.id}/notify`, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e', { id: toastId })
      } else {
        toast.error(data.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435', { id: toastId })
      }
    } catch (error) {
      console.error('Failed to notify owner:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f', { id: toastId })
    } finally {
      setNotifyingOwner(false)
    }
  }

  const handleGeneratePortalLink = async () => {
    if (!letter) return
    setPortalLoading(true)
    try {
      const res = await fetch(`/api/letters/${letter.id}/portal`, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.link) {
        setPortalLink(data.link)
        await loadLetter()
        toast.success(data.notified ? 'Ссылка отправлена заявителю' : 'Ссылка создана')
      } else {
        toast.error(data.error || 'Не удалось создать ссылку')
      }
    } catch (error) {
      console.error('Failed to create portal link:', error)
      toast.error('Ошибка создания ссылки')
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCopyPortalLink = async () => {
    if (!portalLink) return
    try {
      await navigator.clipboard.writeText(portalLink)
      toast.success('Ссылка скопирована')
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error('Не удалось скопировать ссылку')
    }
  }

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!letter || !commentText.trim()) return

    const author = {
      id: session?.user?.id || 'unknown',
      name: session?.user?.name || null,
      email: session?.user?.email || null,
    }
    const optimisticComment = {
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
      author,
      replies: [],
    }

    const result = await addComment(optimisticComment)
    if (result) {
      setCommentText('')
      toast.success('Комментарий добавлен')
    }
  }
  const toggleFavorite = async () => {
    if (!letter) return

    setTogglingFavorite(true)
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterId: letter.id }),
      })

      if (res.ok) {
        setLetter((prev) =>
          prev ? { ...prev, isFavorite: !prev.isFavorite } : null
        )
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    } finally {
      setTogglingFavorite(false)
    }
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !letter) {
    return null
  }

  const daysLeft = getDaysUntilDeadline(letter.deadlineDate)
  const isDone = isDoneStatus(letter.status)
  const isOverdue = !isDone && daysLeft < 0
  const isUrgent = !isDone && daysLeft <= 2 && daysLeft >= 0
  const priorityInfo = getPriorityLabel(letter.priority)
  const letterTypeOptions = LETTER_TYPES.filter((type) => type.value !== 'all')
  const typeValue = letter.type || ''
  const hasCustomType =
    !!typeValue && !letterTypeOptions.some((option) => option.value === typeValue)

  const renderComment = (comment: CommentItem, depth = 0) => {
    const author = comment.author.name || comment.author.email || 'Пользователь'
    const replies = comment.replies ?? []
    return (
      <div
        key={comment.id}
        className={`rounded-lg border border-gray-700/60 bg-gray-900/40 p-4 ${
          depth > 0 ? 'ml-6' : ''
        }`}
      >
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-medium text-gray-200">{author}</span>
          <span>{new Date(comment.createdAt).toLocaleString('ru-RU')}</span>
        </div>
        <p className="mt-2 text-sm text-gray-200 whitespace-pre-wrap">{comment.text}</p>
        {replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 print:hidden">
          <Link
            href="/letters"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад к списку
          </Link>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={toggleFavorite}
              disabled={togglingFavorite}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition disabled:opacity-50 w-full sm:w-auto ${
                letter.isFavorite
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={letter.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            >
              {togglingFavorite ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Star className={`w-4 h-4 ${letter.isFavorite ? 'fill-current' : ''}`} />
              )}
              {letter.isFavorite ? 'В избранном' : 'В избранное'}
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition w-full sm:w-auto"
              title="Печать"
            >
              <Printer className="w-4 h-4" />
              Печать
            </button>

            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition disabled:opacity-50 w-full sm:w-auto"
              title="Дублировать письмо"
            >
              {duplicating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              Дублировать
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition disabled:opacity-50 w-full sm:w-auto"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Удалить
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-400 mb-2 block">
                  {'\u0422\u0438\u043f \u0437\u0430\u043f\u0440\u043e\u0441\u0430'}
                </label>
                <select
                  value={typeValue}
                  onChange={(e) => updateField('type', e.target.value)}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  aria-label="Тип запроса"
                >
                  <option value="">{'\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d'}</option>
                  {hasCustomType && <option value={typeValue}>{typeValue}</option>}
                  {letterTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-lg text-emerald-400">
                      №{letter.number}
                    </span>
                    {letter.type && (
                      <span className="text-sm px-2 py-1 bg-gray-700 rounded text-gray-400">
                        {letter.type}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-white">{letter.org}</h1>
                </div>
                <StatusBadge status={letter.status} size="lg" />
              </div>

              {/* Deadline warning */}
              {(isOverdue || isUrgent) && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                    isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                  {isOverdue
                    ? `Просрочено на ${Math.abs(daysLeft)} ${pluralizeDays(daysLeft)}`
                    : `До дедлайна осталось ${daysLeft} ${pluralizeDays(daysLeft)}`}
                </div>
              )}

              {/* Done indicator */}
              {isDone && (
                <div className="flex items-center gap-2 p-3 rounded-lg mb-4 bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Выполнено
                </div>
              )}
            </div>

            {/* Editable Fields Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Информация о письме</h3>

              <EditableField
                label="Содержание"
                value={letter.content}
                field="content"
                onSave={updateField}
                type="textarea"
                placeholder="Добавить содержание..."
                rows={4}
              />

              <EditableField
                label="Контакты"
                value={letter.contacts}
                field="contacts"
                onSave={updateField}
                placeholder="Добавить контакты..."
              />

              <EditableField
                label="Ссылка на Jira"
                value={letter.jiraLink}
                field="jiraLink"
                onSave={updateField}
                type="url"
                placeholder="https://jira.example.com/..."
              />

              <EditableField
                label="Комментарии ZorDoc"
                value={letter.zordoc}
                field="zordoc"
                onSave={updateField}
                type="textarea"
                placeholder="Добавить комментарий ZorDoc..."
                rows={3}
              />

              {/* Ответ с шаблонами */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Ответ</label>
                  <TemplateSelector
                    currentUserId={session.user.id}
                    onSelect={(content) => {
                      const newAnswer = letter.answer
                        ? `${letter.answer}\n\n${content}`
                        : content
                      updateField('answer', newAnswer)
                    }}
                  />
                </div>
                <EditableField
                  label=""
                  value={letter.answer}
                  field="answer"
                  onSave={updateField}
                  type="textarea"
                  placeholder="Добавить ответ..."
                  rows={4}
                />
              </div>

              <EditableField
                label="Статус отправки"
                value={letter.sendStatus}
                field="sendStatus"
                onSave={updateField}
                placeholder="Добавить статус отправки..."
              />

            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'}
              </h3>
              <EditableField
                label=""
                value={letter.comment}
                field="comment"
                onSave={updateField}
                type="textarea"
                placeholder={'\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439...'}
                rows={3}
              />
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438'}
              </h3>

              {comments.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {'\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432'}
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => renderComment(comment))}
                </div>
              )}

              <form onSubmit={handleAddComment} className="mt-4 space-y-3">
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder={'\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439...'}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isCommentSubmitting || !commentText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {isCommentSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'}
                  </button>
                </div>
              </form>
            </div>

            {/* History */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <ActivityFeed letterId={letter.id} />
            </div>
          </div>

{/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Информация</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Дата письма</div>
                    <div className="text-white">{formatDate(letter.date)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Дедлайн</div>
                    <div className={isOverdue ? 'text-red-400' : isDone ? 'text-emerald-400' : 'text-white'}>
                      {formatDate(letter.deadlineDate)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Исполнитель</div>
                    <div className="text-white">
                      {letter.owner?.name || letter.owner?.email || 'Не назначен'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNotifyOwner}
                  disabled={notifyingOwner || !letter.owner?.id}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  {notifyingOwner ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {'\u0423\u0432\u0435\u0434\u043e\u043c\u0438\u0442\u044c \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f'}
                </button>

                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Приоритет</div>
                    <div className={`font-medium ${priorityInfo.color}`}>
                      {priorityInfo.label} ({letter.priority})
                    </div>
                  </div>
                </div>

                {letter.ijroDate && (
                  <div className="flex items-center gap-3">
                    <Send className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="text-xs text-gray-500">Дата ответа в IJRO</div>
                      <div className="text-white">{formatDate(letter.ijroDate)}</div>
                    </div>
                  </div>
                )}

                {letter.closeDate && (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <div className="text-xs text-gray-500">Дата закрытия</div>
                      <div className="text-emerald-400">{formatDate(letter.closeDate)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>



            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {'Заявитель'}
              </h3>

              <EditableField
                label={'Имя'}
                value={letter.applicantName}
                field="applicantName"
                onSave={updateField}
                placeholder={'Имя заявителя'}
              />

              <EditableField
                label="Email"
                value={letter.applicantEmail}
                field="applicantEmail"
                onSave={updateField}
                placeholder="email@example.com"
              />

              <EditableField
                label={'Телефон'}
                value={letter.applicantPhone}
                field="applicantPhone"
                onSave={updateField}
                placeholder="+998901234567"
              />

              <EditableField
                label="Telegram chat id"
                value={letter.applicantTelegramChatId}
                field="applicantTelegramChatId"
                onSave={updateField}
                placeholder="123456789"
              />

              <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                <div className="text-sm text-gray-400 mb-2">
                  {'Ссылка для заявителя'}
                </div>
                {portalLink ? (
                  <p className="text-sm text-emerald-300 break-all">{portalLink}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    {'Ссылка еще не создана'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleGeneratePortalLink}
                    disabled={portalLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-50 text-sm"
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    {'Создать/обновить ссылку'}
                  </button>
                  <button
                    onClick={handleCopyPortalLink}
                    disabled={!portalLink}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition disabled:opacity-50 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    {'Скопировать'}
                  </button>
                </div>
              </div>
            </div>

            {/* Status Change */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Изменить статус</h3>
              <div className="space-y-2">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateField('status', status)}
                    disabled={updating || letter.status === status}
                    className={`w-full text-left px-4 py-2 rounded-lg transition ${
                      letter.status === status
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Files */}
            <FileUpload
              letterId={letter.id}
              files={letter.files}
              onFilesChange={loadLetter}
            />
          </div>
        </div>
      </main>

      {Dialog}
    </div>
  )
}
