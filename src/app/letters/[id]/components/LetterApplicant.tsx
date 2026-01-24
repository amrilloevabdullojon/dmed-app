'use client'

import { memo, useState, useEffect, useCallback } from 'react'
import { Link2, Copy, Loader2 } from 'lucide-react'
import { EditableField } from '@/components/EditableField'
import { useToast } from '@/components/Toast'
import type { Letter } from '../types'

interface LetterApplicantProps {
  letter: Letter
  onSave: (field: string, value: string) => Promise<void>
  onUpdate: () => void
}

export const LetterApplicant = memo(function LetterApplicant({
  letter,
  onSave,
  onUpdate,
}: LetterApplicantProps) {
  const toast = useToast()
  const [portalLink, setPortalLink] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (letter.applicantAccessToken && typeof window !== 'undefined') {
      setPortalLink(`${window.location.origin}/portal/${letter.applicantAccessToken}`)
    } else {
      setPortalLink('')
    }
  }, [letter.applicantAccessToken])

  const handleGeneratePortalLink = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetch(`/api/letters/${letter.id}/portal`, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.link) {
        setPortalLink(data.link)
        onUpdate()
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
  }, [letter.id, onUpdate, toast])

  const handleCopyPortalLink = useCallback(async () => {
    if (!portalLink) return
    try {
      await navigator.clipboard.writeText(portalLink)
      toast.success('Ссылка скопирована')
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error('Не удалось скопировать ссылку')
    }
  }, [portalLink, toast])

  return (
    <div className="panel panel-glass rounded-2xl p-4 md:p-5">
      <h3 className="mb-4 font-semibold text-white">Заявитель</h3>

      <EditableField
        label="Имя"
        value={letter.applicantName}
        field="applicantName"
        onSave={onSave}
        placeholder="Имя заявителя"
      />

      <EditableField
        label="Email"
        value={letter.applicantEmail}
        field="applicantEmail"
        onSave={onSave}
        placeholder="email@example.com"
      />

      <EditableField
        label="Телефон"
        value={letter.applicantPhone}
        field="applicantPhone"
        onSave={onSave}
        placeholder="+998901234567"
      />

      <EditableField
        label="Telegram chat id"
        value={letter.applicantTelegramChatId}
        field="applicantTelegramChatId"
        onSave={onSave}
        placeholder="123456789"
      />

      <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <div className="mb-2 text-sm text-slate-400">Ссылка для заявителя</div>
        {portalLink ? (
          <p className="break-all text-sm text-teal-300">{portalLink}</p>
        ) : (
          <p className="text-sm italic text-slate-500">Ссылка еще не создана</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleGeneratePortalLink}
            disabled={portalLoading}
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition disabled:opacity-50"
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Создать/обновить ссылку
          </button>
          <button
            onClick={handleCopyPortalLink}
            disabled={!portalLink}
            className="btn-secondary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Скопировать
          </button>
        </div>
      </div>
    </div>
  )
})
