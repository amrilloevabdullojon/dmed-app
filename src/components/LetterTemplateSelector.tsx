'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  X,
  ChevronDown,
  Search,
  Globe,
  Lock,
  Loader2,
  Eye,
  Sparkles,
} from 'lucide-react'
import { substituteLetterVariables } from '@/lib/letter-template-variables'

// Используем минимальный тип для совместимости с разными источниками данных
type LetterForTemplate = {
  number?: string | null
  org?: string | null
  date?: Date | string | null
  deadlineDate?: Date | string | null
  status?: string
  type?: string | null
  content?: string | null
  zordoc?: string | null
  jiraLink?: string | null
  applicantName?: string | null
  applicantEmail?: string | null
  applicantPhone?: string | null
  contacts?: string | null
  owner?: {
    name?: string | null
    email?: string | null
  } | null
  [key: string]: any // Разрешаем дополнительные поля
}

interface LetterTemplate {
  id: string
  name: string
  subject: string | null
  body: string
  signature: string | null
  category: string | null
  variables: string[]
  isPublic: boolean
  usageCount: number
  createdBy: {
    id: string
    name: string | null
    email: string | null
  }
}

interface LetterTemplateSelectorProps {
  onSelect: (content: string) => void
  currentUserId: string
  letter: LetterForTemplate
  field?: 'answer' | 'content'
}

export function LetterTemplateSelector({
  onSelect,
  currentUserId,
  letter,
  field = 'answer',
}: LetterTemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<LetterTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<LetterTemplate | null>(null)
  const [previewContent, setPreviewContent] = useState('')

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)

      const res = await fetch(`/api/letters/templates?${params}`)
      const data = await res.json()

      const loadedTemplates = data.templates || []
      setTemplates(loadedTemplates)

      // Extract unique categories
      const cats: string[] = Array.from(
        new Set(
          loadedTemplates
            .map((t: LetterTemplate) => t.category)
            .filter((c: string | null): c is string => !!c)
        )
      )
      setCategories(cats)
    } catch (error) {
      console.error('Failed to load letter templates:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, loadTemplates])

  const handleSelect = async (template: LetterTemplate) => {
    // Создаём полный текст из шаблона
    const parts: string[] = []

    if (template.subject && field === 'content') {
      parts.push(`Тема: ${template.subject}`)
      parts.push('')
    }

    parts.push(template.body)

    if (template.signature) {
      parts.push('')
      parts.push(template.signature)
    }

    const fullText = parts.join('\n')

    // Заменяем переменные
    const substituted = substituteLetterVariables(fullText, letter)

    // Отправляем в родительский компонент
    onSelect(substituted)

    // Увеличиваем счётчик использований
    try {
      await fetch(`/api/letters/templates/${template.id}/use`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('Failed to increment template usage:', err)
    }

    setIsOpen(false)
  }

  const handlePreview = (template: LetterTemplate) => {
    const parts: string[] = []

    if (template.subject) {
      parts.push(`Тема: ${template.subject}`)
      parts.push('')
    }

    parts.push(template.body)

    if (template.signature) {
      parts.push('')
      parts.push(template.signature)
    }

    const fullText = parts.join('\n')
    const substituted = substituteLetterVariables(fullText, letter)

    setPreviewTemplate(template)
    setPreviewContent(substituted)
  }

  const filteredTemplates = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (selectedCategory && t.category !== selectedCategory) {
      return false
    }
    return true
  })

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
        >
          <FileText className="w-4 h-4" />
          Использовать шаблон
          <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            {/* Overlay */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-[450px] max-h-[600px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col">
              {/* Header */}
              <div className="p-3 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-medium text-white">Шаблоны писем</h3>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Поиск шаблонов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-2 py-0.5 text-xs rounded transition ${
                        !selectedCategory
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      Все
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-0.5 text-xs rounded transition ${
                          selectedCategory === cat
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Templates List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {templates.length === 0 ? (
                      <div>
                        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                        <p>Нет шаблонов.</p>
                        <a
                          href="/letters/templates"
                          className="text-emerald-400 hover:text-emerald-300 mt-2 inline-block"
                        >
                          Создайте первый шаблон
                        </a>
                      </div>
                    ) : (
                      'Шаблоны не найдены'
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="p-3 hover:bg-gray-700/50 transition group"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => handleSelect(template)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white text-sm">
                                {template.name}
                              </span>
                              {template.isPublic ? (
                                <Globe className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Lock className="w-3 h-3 text-gray-500" />
                              )}
                            </div>

                            {template.category && (
                              <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-700 text-emerald-400 rounded mb-1">
                                {template.category}
                              </span>
                            )}

                            {template.subject && (
                              <p className="text-xs text-gray-400 mb-1">
                                <span className="text-gray-500">Тема:</span> {template.subject}
                              </p>
                            )}

                            <p className="text-xs text-gray-400 line-clamp-2">
                              {template.body}
                            </p>

                            {template.variables.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {template.variables.slice(0, 3).map((v) => (
                                  <code
                                    key={v}
                                    className="px-1 py-0.5 text-xs bg-gray-900 text-blue-400 rounded"
                                  >
                                    {'{{'}{v}{'}}'}
                                  </code>
                                ))}
                                {template.variables.length > 3 && (
                                  <span className="text-xs text-gray-500">
                                    +{template.variables.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>{template.usageCount} исп.</span>
                              <span>•</span>
                              <span>{template.createdBy.name || template.createdBy.email}</span>
                            </div>
                          </button>

                          <button
                            onClick={() => handlePreview(template)}
                            className="p-1.5 text-gray-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition"
                            title="Предпросмотр"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-700">
                <a
                  href="/letters/templates"
                  target="_blank"
                  className="block text-center text-sm text-emerald-400 hover:text-emerald-300 transition"
                >
                  Управление шаблонами →
                </a>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {previewTemplate.name}
                  </h2>
                  {previewTemplate.category && (
                    <span className="inline-block px-2 py-1 text-xs bg-gray-700 text-emerald-400 rounded">
                      {previewTemplate.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setPreviewTemplate(null)
                    setPreviewContent('')
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-4">
                <div className="whitespace-pre-wrap font-mono text-sm text-gray-300">
                  {previewContent}
                </div>
              </div>

              {previewTemplate.variables.length > 0 && (
                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-sm font-medium text-blue-300 mb-2">
                    Используемые переменные:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.variables.map((v) => (
                      <code
                        key={v}
                        className="px-2 py-1 bg-gray-900 text-blue-400 rounded text-xs"
                      >
                        {'{{'}{v}{'}}'}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleSelect(previewTemplate)
                    setPreviewTemplate(null)
                    setPreviewContent('')
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  Использовать шаблон
                </button>
                <button
                  onClick={() => {
                    setPreviewTemplate(null)
                    setPreviewContent('')
                  }}
                  className="px-4 py-2 border border-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
