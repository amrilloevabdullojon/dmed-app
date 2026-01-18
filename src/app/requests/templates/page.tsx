'use client'

import { useState } from 'react'
import { useRequestTemplates } from '@/hooks/useRequestTemplates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RequestCategory } from '@/types/prisma'
import { Loader2, Plus, Trash2, Edit, Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'

const categoryLabels: Record<RequestCategory, string> = {
  CONSULTATION: 'Консультация',
  TECHNICAL: 'Техническая поддержка',
  DOCUMENTATION: 'Документация',
  COMPLAINT: 'Жалоба',
  SUGGESTION: 'Предложение',
  OTHER: 'Другое',
}

interface TemplateFormData {
  name: string
  content: string
  category: RequestCategory | ''
  isPublic: boolean
}

export default function RequestTemplatesPage() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } =
    useRequestTemplates()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    content: '',
    category: '',
    isPublic: false,
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const data = {
        name: formData.name,
        content: formData.content,
        category: formData.category || null,
        isPublic: formData.isPublic,
      }

      if (editingId) {
        await updateTemplate(editingId, data)
        toast.success('Шаблон обновлен')
      } else {
        await createTemplate(data)
        toast.success('Шаблон создан')
      }

      setDialogOpen(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (template: (typeof templates)[0]) => {
    setEditingId(template.id)
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category || '',
      isPublic: template.isPublic,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот шаблон?')) return

    try {
      await deleteTemplate(id)
      toast.success('Шаблон удален')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      name: '',
      content: '',
      category: '',
      isPublic: false,
    })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Шаблоны ответов</h1>
          <p className="text-muted-foreground mt-2">
            Управление шаблонами ответов для заявок
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Создать шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Редактировать шаблон' : 'Создать шаблон'}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Обновите информацию о шаблоне'
                  : 'Создайте новый шаблон ответа для заявок'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Название шаблона</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Например: Стандартный ответ на консультацию"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="content">Содержание</Label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Текст шаблона. Поддерживаются переменные: {{contactName}}, {{organization}}"
                  required
                  rows={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <Label htmlFor="category">Категория (опционально)</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      category: value as RequestCategory | '',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Без категории</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) =>
                    setFormData({ ...formData, isPublic: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isPublic" className="font-normal">
                  Публичный шаблон (доступен всем пользователям)
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">
            У вас еще нет шаблонов ответов
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Создать первый шаблон
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-lg">{template.name}</h3>
                <div className="flex items-center gap-1">
                  {template.isPublic ? (
                    <Globe className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {template.content}
              </p>

              {template.category && (
                <div className="mb-4">
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                    {categoryLabels[template.category]}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {template.isPublic ? 'Публичный' : 'Личный'}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


