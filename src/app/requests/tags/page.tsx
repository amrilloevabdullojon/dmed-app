'use client'

import { useState } from 'react'
import { useRequestTags } from '@/hooks/useRequestTags'
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
import { Loader2, Plus, Trash2, Edit, Tag as TagIcon } from 'lucide-react'
import { toast } from 'sonner'

interface TagFormData {
  name: string
  color: string
}

const PRESET_COLORS = [
  '#6B7280', // gray
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
]

export default function RequestTagsPage() {
  const { tags, loading, createTag, updateTag, deleteTag } = useRequestTags()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    color: '#6B7280',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editingId) {
        await updateTag(editingId, formData)
        toast.success('Тег обновлен')
      } else {
        await createTag(formData)
        toast.success('Тег создан')
      }

      setDialogOpen(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (tag: (typeof tags)[0]) => {
    setEditingId(tag.id)
    setFormData({
      name: tag.name,
      color: tag.color,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот тег?')) return

    try {
      await deleteTag(id)
      toast.success('Тег удален')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      name: '',
      color: '#6B7280',
    })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Теги для заявок</h1>
          <p className="text-muted-foreground mt-2">
            Управление тегами для организации заявок
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
              Создать тег
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Редактировать тег' : 'Создать тег'}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Обновите информацию о теге'
                  : 'Создайте новый тег для заявок'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Название тега</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Например: VIP, Срочная, Требует эскалации"
                  required
                  maxLength={50}
                />
              </div>

              <div>
                <Label>Цвет</Label>
                <div className="grid grid-cols-8 gap-2 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className="w-8 h-8 rounded border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          formData.color === color ? '#ffffff' : 'transparent',
                      }}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="mt-2 h-10"
                />
              </div>

              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: `${formData.color}33`,
                  borderColor: formData.color,
                }}
              >
                <p className="text-sm font-medium" style={{ color: formData.color }}>
                  Предпросмотр: {formData.name || 'Название тега'}
                </p>
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
      ) : tags.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <TagIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">У вас еще нет тегов</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Создать первый тег
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow"
              style={{
                backgroundColor: `${tag.color}11`,
                borderColor: `${tag.color}44`,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded font-medium"
                  style={{
                    backgroundColor: `${tag.color}33`,
                    color: tag.color,
                  }}
                >
                  <TagIcon className="h-4 w-4" />
                  {tag.name}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Использований: {tag._count.requests}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(tag)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(tag.id)}
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
