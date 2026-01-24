'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import {
  FileText,
  Link as LinkIcon,
  MessageSquareText,
  Send,
  Tag,
  Hash,
  Building2,
  Phone,
  FileEdit,
} from 'lucide-react'
import { EditableField } from '@/components/EditableField'
import { LETTER_TYPES } from '@/lib/constants'
import type { Letter } from '../types'

const TemplateSelector = dynamic(
  () => import('@/components/TemplateSelector').then((mod) => ({ default: mod.TemplateSelector })),
  { ssr: false }
)

interface LetterDetailsProps {
  letter: Letter
  currentUserId: string
  canEditIdentity: boolean
  updating: boolean
  onSave: (field: string, value: string) => Promise<void>
  onUpdate: (field: string, value: string) => Promise<void>
}

export const LetterDetails = memo(function LetterDetails({
  letter,
  currentUserId,
  canEditIdentity,
  updating,
  onSave,
  onUpdate,
}: LetterDetailsProps) {
  const letterTypeOptions = LETTER_TYPES.filter((type) => type.value !== 'all')
  const typeValue = letter.type || ''
  const hasCustomType = !!typeValue && !letterTypeOptions.some((opt) => opt.value === typeValue)

  return (
    <div className="space-y-4">
      {/* Type Selector Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/15 p-2.5">
            <Tag className="h-5 w-5 text-teal-400" />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Тип запроса</label>
            <select
              value={typeValue}
              onChange={(e) => onUpdate('type', e.target.value)}
              disabled={updating}
              className="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-3 py-2 text-sm text-white transition focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/50 disabled:opacity-50"
            >
              <option value="">Не указан</option>
              {hasCustomType && <option value={typeValue}>{typeValue}</option>}
              {letterTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Info Section */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-white">Информация о письме</h3>
        </div>

        <div className="space-y-1">
          {canEditIdentity && (
            <>
              <FieldWrapper icon={Hash} label="Номер">
                <EditableField
                  label=""
                  value={letter.number}
                  field="number"
                  onSave={onSave}
                  placeholder="Введите номер"
                />
              </FieldWrapper>
              <FieldWrapper icon={Building2} label="Название">
                <EditableField
                  label=""
                  value={letter.org}
                  field="org"
                  onSave={onSave}
                  placeholder="Введите название"
                />
              </FieldWrapper>
            </>
          )}

          <FieldWrapper icon={FileText} label="Содержание" fullWidth>
            <EditableField
              label=""
              value={letter.content}
              field="content"
              onSave={onSave}
              type="textarea"
              placeholder="Добавить содержание..."
              rows={4}
              collapsible
              maxPreviewChars={320}
            />
          </FieldWrapper>

          <FieldWrapper icon={Phone} label="Контакты">
            <EditableField
              label=""
              value={letter.contacts}
              field="contacts"
              onSave={onSave}
              placeholder="Добавить контакты..."
            />
          </FieldWrapper>

          <FieldWrapper icon={LinkIcon} label="Jira">
            <EditableField
              label=""
              value={letter.jiraLink}
              field="jiraLink"
              onSave={onSave}
              type="url"
              placeholder="https://jira.example.com/..."
            />
          </FieldWrapper>

          <FieldWrapper icon={FileEdit} label="ZorDoc" fullWidth>
            <EditableField
              label=""
              value={letter.zordoc}
              field="zordoc"
              onSave={onSave}
              type="textarea"
              placeholder="Добавить комментарий ZorDoc..."
              rows={3}
              collapsible
              maxPreviewChars={240}
            />
          </FieldWrapper>
        </div>
      </div>

      {/* Answer Section */}
      <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-teal-500/15 p-2">
              <Send className="h-4 w-4 text-teal-400" />
            </div>
            <h3 className="font-semibold text-white">Ответ</h3>
          </div>
          <TemplateSelector
            currentUserId={currentUserId}
            onSelect={(content) => {
              const newAnswer = letter.answer ? `${letter.answer}\n\n${content}` : content
              onUpdate('answer', newAnswer)
            }}
          />
        </div>

        <div className="space-y-3">
          <EditableField
            label=""
            value={letter.answer}
            field="answer"
            onSave={onSave}
            type="textarea"
            placeholder="Добавить ответ..."
            rows={4}
            collapsible
            maxPreviewChars={320}
          />

          <div className="rounded-xl bg-slate-800/50 p-3">
            <div className="mb-1.5 text-xs font-medium text-slate-400">Статус отправки</div>
            <EditableField
              label=""
              value={letter.sendStatus}
              field="sendStatus"
              onSave={onSave}
              placeholder="Добавить статус отправки..."
            />
          </div>
        </div>
      </div>

      {/* Internal Comment */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-white">Внутренний комментарий</h3>
        </div>
        <EditableField
          label=""
          value={letter.comment}
          field="comment"
          onSave={onSave}
          type="textarea"
          placeholder="Добавьте комментарий..."
          rows={3}
        />
      </div>
    </div>
  )
})

interface FieldWrapperProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  fullWidth?: boolean
}

function FieldWrapper({ icon: Icon, label, children, fullWidth }: FieldWrapperProps) {
  if (fullWidth) {
    return (
      <div className="rounded-xl bg-slate-700/20 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">{label}</span>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-700/20 p-3">
      <div className="flex items-center gap-2 pt-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="w-20 shrink-0 text-xs font-medium text-slate-400">{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
