import { useState, useEffect } from 'react'

interface RequestTag {
  id: string
  name: string
  color: string
  createdAt: string
  _count: {
    requests: number
  }
}

interface CreateTagData {
  name: string
  color?: string
}

interface UpdateTagData {
  name?: string
  color?: string
}

export function useRequestTags() {
  const [tags, setTags] = useState<RequestTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTags = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/requests/tags')
      if (!response.ok) {
        throw new Error('Failed to fetch tags')
      }

      const data = await response.json()
      setTags(data.tags || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  const createTag = async (data: CreateTagData) => {
    try {
      const response = await fetch('/api/requests/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create tag')
      }

      const result = await response.json()
      setTags((prev) => [...prev, result.tag])
      return result.tag
    } catch (err) {
      throw err
    }
  }

  const updateTag = async (id: string, data: UpdateTagData) => {
    try {
      const response = await fetch(`/api/requests/tags?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update tag')
      }

      const result = await response.json()
      setTags((prev) => prev.map((t) => (t.id === id ? result.tag : t)))
      return result.tag
    } catch (err) {
      throw err
    }
  }

  const deleteTag = async (id: string) => {
    try {
      const response = await fetch(`/api/requests/tags?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete tag')
      }

      setTags((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      throw err
    }
  }

  return {
    tags,
    loading,
    error,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  }
}
