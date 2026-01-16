'use client'

import { useState, useEffect } from 'react'
import { useRequestTags } from '@/hooks/useRequestTags'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tag, X, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface TagSelectorProps {
  requestId: string
  currentTags: Array<{ id: string; name: string; color: string }>
  onUpdate?: () => void
}

export function TagSelector({ requestId, currentTags, onUpdate }: TagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    currentTags.map((t) => t.id)
  )
  const [saving, setSaving] = useState(false)
  const { tags, loading } = useRequestTags()

  useEffect(() => {
    setSelectedTagIds(currentTags.map((t) => t.id))
  }, [currentTags])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/requests/${requestId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagIds: selectedTagIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update tags')
      }

      toast.success('Теги обновлены')
      setOpen(false)
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        {currentTags.length > 0 ? (
          currentTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: `${tag.color}33`,
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-400">Нет тегов</span>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" type="button">
              <Tag className="mr-2 h-4 w-4" />
              Управление тегами
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Управление тегами</DialogTitle>
              <DialogDescription>
                Выберите теги для этой заявки
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tags.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Теги не найдены. Создайте теги в разделе управления тегами.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                  {tags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
                        style={{
                          backgroundColor: isSelected ? `${tag.color}33` : 'transparent',
                          borderColor: tag.color,
                          color: isSelected ? tag.color : 'inherit',
                        }}
                      >
                        {isSelected && <Check className="h-4 w-4" />}
                        {tag.name}
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    Отмена
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
