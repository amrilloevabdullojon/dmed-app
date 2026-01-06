'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'
import { EditableField } from '@/components/EditableField'
import { FileUpload } from '@/components/FileUpload'
import { TemplateSelector } from '@/components/TemplateSelector'
import { ActivityFeed } from '@/components/ActivityFeed'
import { SLAIndicator } from '@/components/SLAIndicator'
import { RelatedLetters } from '@/components/RelatedLetters'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { LetterStatus } from '@prisma/client'
import {
  STATUS_LABELS,
  formatDate,
  getWorkingDaysUntilDeadline,
  addWorkingDays,
  parseDateValue,
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
        throw new Error(data.error || 'Failed to add comment')
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

  useEffect(() => {
    document.body.style.overflow = ''
  }, [])

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

  const updateField = async (
    field: string,
    value: string,
    options: { throwOnError?: boolean } = {}
  ) => {
    if (!letter) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/letters/${letter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const message = data?.error || 'Не удалось обновить поле'
        toast.error(message)
        if (options.throwOnError) {
          throw new Error(message)
        }
        return
      }
      await loadLetter()
    } catch (error) {
      console.error('Failed to update:', error)
      if (options.throwOnError) {
        throw error
      }
    } finally {
      setUpdating(false)
    }
  }

  const saveField = (field: string, value: string) =>
    updateField(field, value, { throwOnError: true })

  const deleteLetter = useCallback(async () => {
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
  }, [letter, router, toast])

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
      toast.error(
        '\u041d\u0435\u0442 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u043e\u0433\u043e \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430'
      )
      return
    }

    setNotifyingOwner(true)
    const toastId = toast.loading(
      '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435...'
    )

    try {
      const res = await fetch(`/api/letters/${letter.id}/notify`, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success(
          '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e',
          { id: toastId }
        )
      } else {
        toast.error(
          data.error ||
            '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435',
          { id: toastId }
        )
      }
    } catch (error) {
      console.error('Failed to notify owner:', error)
      toast.error(
        '\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
        { id: toastId }
      )
    } finally {
      setNotifyingOwner(false)
    }
  }

  const handlePostponeDeadline = async () => {
    if (!letter) return

    const input = window.prompt(
      '\u041d\u0430 \u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0440\u0430\u0431\u043e\u0447\u0438\u0445 \u0434\u043d\u0435\u0439 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 \u0434\u0435\u0434\u043b\u0430\u0439\u043d?',
      '3'
    )
    if (!input) return

    const delta = Number.parseInt(input, 10)
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error(
        '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0447\u0438\u0441\u043b\u043e \u0440\u0430\u0431\u043e\u0447\u0438\u0445 \u0434\u043d\u0435\u0439'
      )
      return
    }

    const currentDeadline = parseDateValue(letter.deadlineDate)
    if (!currentDeadline) {
      toast.error(
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0434\u0430\u0442\u0443 \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430'
      )
      return
    }

    const nextDeadline = addWorkingDays(currentDeadline, delta)
    try {
      await updateField('deadlineDate', nextDeadline.toISOString(), { throwOnError: true })
      toast.success(
        '\u0414\u0435\u0434\u043b\u0430\u0439\u043d \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d'
      )
    } catch {
      // updateField already notifies on error
    }
  }

  const handleEscalate = async () => {
    if (!letter) return
    if (letter.priority >= 90) {
      toast.success(
        '\u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442 \u0443\u0436\u0435 \u0432\u044b\u0441\u043e\u043a\u0438\u0439'
      )
      return
    }

    try {
      await updateField('priority', '100', { throwOnError: true })
      toast.success(
        '\u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442 \u043f\u043e\u0432\u044b\u0448\u0435\u043d'
      )
      if (letter.owner?.id) {
        await handleNotifyOwner()
      }
    } catch {
      // updateField already notifies on error
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
        setLetter((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null))
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    } finally {
      setTogglingFavorite(false)
    }
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !letter) {
    return null
  }

  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const isDone = isDoneStatus(letter.status)
  const isOverdue = !isDone && daysLeft < 0
  const isUrgent = !isDone && daysLeft <= 2 && daysLeft >= 0
  const priorityInfo = getPriorityLabel(letter.priority)
  const letterTypeOptions = LETTER_TYPES.filter((type) => type.value !== 'all')
  const typeValue = letter.type || ''
  const hasCustomType =
    !!typeValue && !letterTypeOptions.some((option) => option.value === typeValue)
  const canEditIdentity = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'

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
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">{comment.text}</p>
        {replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen overflow-auto bg-gray-900">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 pb-16 sm:px-6 sm:py-8 lg:px-8">
        {/* Back button */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Link
            href="/letters"
            className="inline-flex items-center gap-2 text-gray-400 transition hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            Назад к списку
          </Link>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={toggleFavorite}
              disabled={togglingFavorite}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition disabled:opacity-50 sm:w-auto ${
                letter.isFavorite
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title={letter.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            >
              {togglingFavorite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Star className={`h-4 w-4 ${letter.isFavorite ? 'fill-current' : ''}`} />
              )}
              {letter.isFavorite ? 'В избранном' : 'В избранное'}
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-white transition hover:bg-gray-600 sm:w-auto"
              title="Печать"
            >
              <Printer className="h-4 w-4" />
              Печать
            </button>

            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-blue-400 transition hover:bg-blue-500/30 disabled:opacity-50 sm:w-auto"
              title="Дублировать письмо"
            >
              {duplicating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Дублировать
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-red-400 transition hover:bg-red-500/30 disabled:opacity-50 sm:w-auto"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Удалить
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <ActivityFeed
                letterId={letter.id}
                maxItems={3}
                title="\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f"
                compact
              />
            </div>

            {/* Header Card */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  {'\u0422\u0438\u043f \u0437\u0430\u043f\u0440\u043e\u0441\u0430'}
                </label>
                <select
                  value={typeValue}
                  onChange={(e) => updateField('type', e.target.value)}
                  disabled={updating}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
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
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="font-mono text-lg text-emerald-400">№{letter.number}</span>
                    {letter.type && (
                      <span className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-400">
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
                  className={`mb-4 flex items-center gap-2 rounded-lg p-3 ${
                    isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                  {isOverdue
                    ? `\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430 ${Math.abs(daysLeft)} \u0440\u0430\u0431. ${pluralizeDays(Math.abs(daysLeft))}`
                    : `\u0414\u043e \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430 \u043e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${daysLeft} \u0440\u0430\u0431. ${pluralizeDays(daysLeft)}`}
                </div>
              )}

              {/* Done indicator */}
              {isDone && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/20 p-3 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Выполнено
                </div>
              )}
            </div>

            {/* Editable Fields Card */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Информация о письме</h3>

              {canEditIdentity && (
                <>
                  <EditableField
                    label={'\u041d\u043e\u043c\u0435\u0440 \u043f\u0438\u0441\u044c\u043c\u0430'}
                    value={letter.number}
                    field="number"
                    onSave={saveField}
                    placeholder={
                      '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440'
                    }
                  />
                  <EditableField
                    label={
                      '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0438\u0441\u044c\u043c\u0430'
                    }
                    value={letter.org}
                    field="org"
                    onSave={saveField}
                    placeholder={
                      '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435'
                    }
                  />
                </>
              )}

              <EditableField
                label="Содержание"
                value={letter.content}
                field="content"
                onSave={saveField}
                type="textarea"
                placeholder="Добавить содержание..."
                rows={4}
              />

              <EditableField
                label="Контакты"
                value={letter.contacts}
                field="contacts"
                onSave={saveField}
                placeholder="Добавить контакты..."
              />

              <EditableField
                label="Ссылка на Jira"
                value={letter.jiraLink}
                field="jiraLink"
                onSave={saveField}
                type="url"
                placeholder="https://jira.example.com/..."
              />

              <EditableField
                label="Комментарии ZorDoc"
                value={letter.zordoc}
                field="zordoc"
                onSave={saveField}
                type="textarea"
                placeholder="Добавить комментарий ZorDoc..."
                rows={3}
              />

              {/* Ответ с шаблонами */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Ответ</label>
                  <TemplateSelector
                    currentUserId={session.user.id}
                    onSelect={(content) => {
                      const newAnswer = letter.answer ? `${letter.answer}\n\n${content}` : content
                      updateField('answer', newAnswer)
                    }}
                  />
                </div>
                <EditableField
                  label=""
                  value={letter.answer}
                  field="answer"
                  onSave={saveField}
                  type="textarea"
                  placeholder="Добавить ответ..."
                  rows={4}
                />
              </div>

              <EditableField
                label="Статус отправки"
                value={letter.sendStatus}
                field="sendStatus"
                onSave={saveField}
                placeholder="Добавить статус отправки..."
              />
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                {'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'}
              </h3>
              <EditableField
                label=""
                value={letter.comment}
                field="comment"
                onSave={saveField}
                type="textarea"
                placeholder={
                  '\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439...'
                }
                rows={3}
              />
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                {'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438'}
              </h3>

              {comments.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {
                    '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432'
                  }
                </p>
              ) : (
                <div className="space-y-3">{comments.map((comment) => renderComment(comment))}</div>
              )}

              <form onSubmit={handleAddComment} className="mt-4 space-y-3">
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
                  placeholder={
                    '\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439...'
                  }
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isCommentSubmitting || !commentText.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-white transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {isCommentSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    {
                      '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'
                    }
                  </button>
                </div>
              </form>
            </div>

            {/* History */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <ActivityFeed letterId={letter.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Информация</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Дата письма</div>
                    <div className="text-white">{formatDate(letter.date)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Дедлайн</div>
                    <div
                      className={
                        isOverdue ? 'text-red-400' : isDone ? 'text-emerald-400' : 'text-white'
                      }
                    >
                      {formatDate(letter.deadlineDate)}
                    </div>
                  </div>
                </div>

                {/* SLA Indicator */}
                <div className="border-t border-gray-700 pt-2">
                  <SLAIndicator
                    createdAt={letter.date}
                    deadlineDate={letter.deadlineDate}
                    status={letter.status}
                    closedAt={letter.closeDate}
                    size="md"
                  />
                </div>

                {!isDone && (
                  <div className="flex flex-wrap gap-2 border-t border-gray-700 pt-3">
                    <button
                      onClick={handlePostponeDeadline}
                      disabled={updating}
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-600 disabled:opacity-50"
                    >
                      <Clock className="h-4 w-4" />
                      {
                        '\u041f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 \u0434\u0435\u0434\u043b\u0430\u0439\u043d'
                      }
                    </button>
                    <button
                      onClick={handleEscalate}
                      disabled={updating}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {'\u042d\u0441\u043a\u0430\u043b\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-500" />
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
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-white transition hover:bg-gray-600 disabled:opacity-50"
                >
                  {notifyingOwner ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  {
                    '\u0423\u0432\u0435\u0434\u043e\u043c\u0438\u0442\u044c \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f'
                  }
                </button>

                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="mb-1 text-xs text-gray-500">Приоритет</div>
                    <div className={`font-medium ${priorityInfo.color}`}>
                      {priorityInfo.label} ({letter.priority})
                    </div>
                  </div>
                </div>

                {letter.ijroDate && (
                  <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-gray-500" />
                    <div>
                      <div className="text-xs text-gray-500">Дата ответа в IJRO</div>
                      <div className="text-white">{formatDate(letter.ijroDate)}</div>
                    </div>
                  </div>
                )}

                {letter.closeDate && (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <div>
                      <div className="text-xs text-gray-500">Дата закрытия</div>
                      <div className="text-emerald-400">{formatDate(letter.closeDate)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">{'Заявитель'}</h3>

              <EditableField
                label={'Имя'}
                value={letter.applicantName}
                field="applicantName"
                onSave={saveField}
                placeholder={'Имя заявителя'}
              />

              <EditableField
                label="Email"
                value={letter.applicantEmail}
                field="applicantEmail"
                onSave={saveField}
                placeholder="email@example.com"
              />

              <EditableField
                label={'Телефон'}
                value={letter.applicantPhone}
                field="applicantPhone"
                onSave={saveField}
                placeholder="+998901234567"
              />

              <EditableField
                label="Telegram chat id"
                value={letter.applicantTelegramChatId}
                field="applicantTelegramChatId"
                onSave={saveField}
                placeholder="123456789"
              />

              <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                <div className="mb-2 text-sm text-gray-400">{'Ссылка для заявителя'}</div>
                {portalLink ? (
                  <p className="break-all text-sm text-emerald-300">{portalLink}</p>
                ) : (
                  <p className="text-sm italic text-gray-500">{'Ссылка еще не создана'}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleGeneratePortalLink}
                    disabled={portalLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm text-white transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    {'Создать/обновить ссылку'}
                  </button>
                  <button
                    onClick={handleCopyPortalLink}
                    disabled={!portalLink}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Copy className="h-4 w-4" />
                    {'Скопировать'}
                  </button>
                </div>
              </div>
            </div>

            {/* Status Change */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Изменить статус</h3>
              <div className="space-y-2">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateField('status', status)}
                    disabled={updating || letter.status === status}
                    className={`w-full rounded-lg px-4 py-2 text-left transition ${
                      letter.status === status
                        ? 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Files */}
            <FileUpload letterId={letter.id} files={letter.files} onFilesChange={loadLetter} />

            {/* Related Letters */}
            <RelatedLetters currentLetterId={letter.id} organization={letter.org} />
          </div>
        </div>
      </main>

      {Dialog}
    </div>
  )
}
