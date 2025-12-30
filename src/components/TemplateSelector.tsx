'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Plus,
  X,
  Check,
  ChevronDown,
  Search,
  Globe,
  Lock,
  Trash2,
  Edit,
  Loader2,
} from 'lucide-react'

interface Template {
  id: string
  name: string
  content: string
  category: string | null
  isPublic: boolean
  createdBy: {
    id: string
    name: string | null
    email: string | null
  }
}

interface TemplateSelectorProps {
  onSelect: (content: string) => void
  currentUserId: string
}

export function TemplateSelector({ onSelect, currentUserId }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Создание шаблона
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newIsPublic, setNewIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)

      const res = await fetch(`/api/templates?${params}`)
      const data = await res.json()

      setTemplates(data.templates || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, loadTemplates])

  const handleSelect = (template: Template) => {
    onSelect(template.content)
    setIsOpen(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          content: newContent,
          category: newCategory || null,
          isPublic: newIsPublic,
        }),
      })

      if (res.ok) {
        setNewName('')
        setNewContent('')
        setNewCategory('')
        setNewIsPublic(false)
        setShowCreate(false)
        loadTemplates()
      }
    } catch (error) {
      console.error('Failed to create template:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот шаблон?')) return

    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        loadTemplates()
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
      >
        <FileText className="w-4 h-4" />
        Шаблоны
        <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white">Шаблоны ответов</h3>
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="p-1 text-emerald-400 hover:text-emerald-300 transition"
                  title="Создать шаблон"
                >
                  {showCreate ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Поиск..."
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
                    className={`px-2 py-0.5 text-xs rounded ${
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
                      className={`px-2 py-0.5 text-xs rounded ${
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

            {/* Create Form */}
            {showCreate && (
              <div className="p-3 border-b border-gray-700 space-y-2">
                <input
                  type="text"
                  placeholder="Название шаблона"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <textarea
                  placeholder="Содержание шаблона..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Категория (опционально)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={newIsPublic}
                      onChange={(e) => setNewIsPublic(e.target.checked)}
                      className="rounded"
                    />
                    Публичный
                  </label>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={saving || !newName.trim() || !newContent.trim()}
                  className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Сохранить
                </button>
              </div>
            )}

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {templates.length === 0
                    ? 'Нет шаблонов. Создайте первый!'
                    : 'Шаблоны не найдены'}
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-3 hover:bg-gray-700/50 transition group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => handleSelect(template)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white text-sm">
                              {template.name}
                            </span>
                            {template.isPublic ? (
                              <Globe className="w-3 h-3 text-gray-500" />
                            ) : (
                              <Lock className="w-3 h-3 text-gray-500" />
                            )}
                          </div>
                          {template.category && (
                            <span className="text-xs text-emerald-400">
                              {template.category}
                            </span>
                          )}
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {template.content}
                          </p>
                        </button>

                        {template.createdBy.id === currentUserId && (
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
