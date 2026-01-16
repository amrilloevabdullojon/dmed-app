import { useState, useEffect, useCallback } from 'react'

export type LetterTemplate = {
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

export function useLetterTemplates(category?: string | null) {
  const [templates, setTemplates] = useState<LetterTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (category) {
        params.append('category', category)
      }

      const url = `/api/letters/templates${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        throw new Error('Не удалось загрузить шаблоны')
      }

      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
  }
}
