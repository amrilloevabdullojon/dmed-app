'use client'

import { useState } from 'react'
import type { RequestCategory } from '@/types/prisma'
import { useRequestTemplates } from '@/hooks/useRequestTemplates'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TemplateSelectorProps {
  category?: RequestCategory | null
  onSelect: (content: string) => void
}

export function TemplateSelector({ category, onSelect }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const { templates, loading } = useRequestTemplates(category)

  const handleSelect = (content: string) => {
    onSelect(content)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <FileText className="mr-2 h-4 w-4" />
          Использовать шаблон
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Выберите шаблон ответа</DialogTitle>
          <DialogDescription>
            Доступные шаблоны для этой категории заявок
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Шаблоны не найдены
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template.content)}
                  className="w-full rounded-lg border p-4 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{template.name}</h4>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {template.content}
                      </p>
                    </div>
                    {template.isPublic && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded whitespace-nowrap">
                        Публичный
                      </span>
                    )}
                  </div>
                  {template.category && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Категория: {getCategoryLabel(template.category)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

function getCategoryLabel(category: RequestCategory): string {
  const labels: Record<RequestCategory, string> = {
    CONSULTATION: 'Консультация',
    TECHNICAL: 'Техническая поддержка',
    DOCUMENTATION: 'Документация',
    COMPLAINT: 'Жалоба',
    SUGGESTION: 'Предложение',
    OTHER: 'Другое',
  }
  return labels[category] || category
}


