import { useState, useEffect } from 'react'
import type { RequestCategory } from '@/types/prisma'

interface RequestTemplate {
  id: string
  name: string
  content: string
  category: RequestCategory | null
  isPublic: boolean
  createdById: string
  createdBy: {
    id: string
    name: string | null
    email: string | null
  }
  createdAt: string
  updatedAt: string
}

interface CreateTemplateData {
  name: string
  content: string
  category?: RequestCategory | null
  isPublic?: boolean
}

interface UpdateTemplateData {
  name?: string
  content?: string
  category?: RequestCategory | null
  isPublic?: boolean
}

export function useRequestTemplates(category?: RequestCategory | null) {
  const [templates, setTemplates] = useState<RequestTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (category) {
        params.set('category', category)
      }

      const response = await fetch(`/api/requests/templates?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [category])

  const createTemplate = async (data: CreateTemplateData) => {
    try {
      const response = await fetch('/api/requests/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create template')
      }

      const result = await response.json()
      setTemplates((prev) => [...prev, result.template])
      return result.template
    } catch (err) {
      throw err
    }
  }

  const updateTemplate = async (id: string, data: UpdateTemplateData) => {
    try {
      const response = await fetch(`/api/requests/templates?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update template')
      }

      const result = await response.json()
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? result.template : t))
      )
      return result.template
    } catch (err) {
      throw err
    }
  }

  const deleteTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/requests/templates?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      throw err
    }
  }

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  }
}


