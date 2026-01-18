'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Eye,
  Globe,
  Lock,
  TrendingUp,
  Search,
  X,
} from 'lucide-react'
import { useLetterTemplates } from '@/hooks/use-letter-templates'

type LetterTemplate = {
  id: string
  name: string
  subject: string | null
  body: string
  signature: string | null
  category: string | null
  variables: string[]
  isPublic: boolean
  usageCount: number
  createdById: string
  createdBy: {
    id: string
    name: string | null
    email: string | null
  }
  createdAt: string
  updatedAt: string
}

export default function LetterTemplatesPage() {
  const { data: session, status } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const { templates, loading, error, refetch } = useLetterTemplates()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    redirect('/auth/signin')
  }

  const filteredTemplates = templates.filter((t) => {
    const query = searchQuery.toLowerCase()
    return (
      t.name.toLowerCase().includes(query) ||
      t.body.toLowerCase().includes(query) ||
      (t.category && t.category.toLowerCase().includes(query)) ||
      (t.subject && t.subject.toLowerCase().includes(query))
    )
  })

  const handleCreateOrEdit = () => {
    setShowCreateModal(true)
  }

  const handlePreview = (template: LetterTemplate) => {
    setSelectedTemplate(template)
    setShowPreviewModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return

    try {
      const res = await fetch(`/api/letters/templates?id=${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
        },
      })

      if (res.ok) {
        refetch()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка удаления')
      }
    } catch (err) {
      console.error(err)
      alert('Ошибка удаления шаблона')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Шаблоны писем
            </h1>
            <p className="text-gray-600 mt-2">
              Создавайте шаблоны ответов с автоматической подстановкой данных
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedTemplate(null)
              handleCreateOrEdit()
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Создать шаблон
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, содержанию, категории..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading/Error States */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка шаблонов...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Ошибка загрузки шаблонов: {error}
        </div>
      )}

      {/* Templates Grid */}
      {!loading && !error && (
        <>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">
                {searchQuery ? 'Шаблоны не найдены' : 'Нет шаблонов'}
              </p>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? 'Попробуйте изменить запрос'
                  : 'Создайте первый шаблон для быстрых ответов'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    setSelectedTemplate(null)
                    handleCreateOrEdit()
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5" />
                  Создать шаблон
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  currentUserId={session.user.id}
                  onEdit={() => {
                    setSelectedTemplate(template)
                    handleCreateOrEdit()
                  }}
                  onPreview={() => handlePreview(template)}
                  onDelete={() => handleDelete(template.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <TemplateEditorModal
          template={selectedTemplate}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedTemplate(null)
          }}
          onSuccess={() => {
            setShowCreateModal(false)
            setSelectedTemplate(null)
            refetch()
          }}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => {
            setShowPreviewModal(false)
            setSelectedTemplate(null)
          }}
        />
      )}
    </div>
  )
}

function TemplateCard({
  template,
  currentUserId,
  onEdit,
  onPreview,
  onDelete,
}: {
  template: LetterTemplate
  currentUserId: string
  onEdit: () => void
  onPreview: () => void
  onDelete: () => void
}) {
  const isOwner = template.createdById === currentUserId

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg mb-1">{template.name}</h3>
          {template.category && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
              {template.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          {template.isPublic ? (
            <span title="Публичный">
              <Globe className="w-4 h-4 text-green-600" />
            </span>
          ) : (
            <span title="Личный">
              <Lock className="w-4 h-4 text-gray-400" />
            </span>
          )}
        </div>
      </div>

      {/* Subject */}
      {template.subject && (
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Тема:</span> {template.subject}
        </p>
      )}

      {/* Body Preview */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-3">{template.body}</p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          <span>{template.usageCount} исп.</span>
        </div>
        {template.variables.length > 0 && (
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            <span>{template.variables.length} пер.</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onPreview}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
        >
          <Eye className="w-4 h-4" />
          Просмотр
        </button>
        {isOwner && (
          <>
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded transition-colors"
            >
              <Edit className="w-4 h-4" />
              Изменить
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Creator */}
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        Автор: {template.createdBy.name || template.createdBy.email}
      </div>
    </div>
  )
}

function TemplateEditorModal({
  template,
  onClose,
  onSuccess,
}: {
  template: LetterTemplate | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    signature: template?.signature || '',
    category: template?.category || '',
    isPublic: template?.isPublic || false,
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = template
        ? `/api/letters/templates?id=${template.id}`
        : '/api/letters/templates'
      const method = template ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({
          ...formData,
          subject: formData.subject || null,
          signature: formData.signature || null,
          category: formData.category || null,
        }),
      })

      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка сохранения')
      }
    } catch (err) {
      console.error(err)
      alert('Ошибка сохранения шаблона')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-2xl font-bold mb-6">
            {template ? 'Редактировать шаблон' : 'Создать шаблон'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ответ на запрос о регистрации"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Регистрация"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тема письма
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ответ на письмо {{'{{'}}letter.number{{'}}'}}"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тело письма *
              </label>
              <textarea
                required
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Уважаемый(-ая) {{'{{'}}applicant.name{{'}}'}},&#10;&#10;По вашему письму {{'{{'}}letter.number{{'}}'}} от {{'{{'}}letter.date{{'}}'}}..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Используйте переменные: {'{{letter.number}}'}, {'{{applicant.name}}'}, {'{{owner.name}}'} и др.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Подпись
              </label>
              <textarea
                value={formData.signature}
                onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="С уважением,&#10;{{'{{'}}owner.name{{'}}'}}"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="isPublic" className="text-sm text-gray-700">
                Публичный шаблон (доступен всем пользователям)
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {submitting ? 'Сохранение...' : template ? 'Сохранить' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TemplatePreviewModal({
  template,
  onClose,
}: {
  template: LetterTemplate
  onClose: () => void
}) {
  const [preview, setPreview] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useState(() => {
    // Import preview function dynamically
    import('@/lib/letter-template-variables').then(({ previewTemplate }) => {
      const fullText = [
        template.subject && `Тема: ${template.subject}`,
        '',
        template.body,
        '',
        template.signature,
      ]
        .filter(Boolean)
        .join('\n')

      setPreview(previewTemplate(fullText))
      setLoading(false)
    })
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Предпросмотр: {template.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Генерация предпросмотра...</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 whitespace-pre-wrap font-mono text-sm">
              {preview}
            </div>
          )}

          {template.variables.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Используемые переменные:</p>
              <div className="flex flex-wrap gap-2">
                {template.variables.map((v) => (
                  <code key={v} className="px-2 py-1 bg-white text-blue-700 rounded text-xs">
                    {'{{'}{v}{'}}'}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
