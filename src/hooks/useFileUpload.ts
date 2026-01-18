'use client'

import { useState, useCallback, useRef } from 'react'
import type { UploadedFile } from '@/components/DragDropUpload'

interface UseFileUploadOptions {
  endpoint: string
  onSuccess?: (file: File, response: any) => void
  onError?: (file: File, error: Error) => void
  onProgress?: (file: File, progress: number) => void
  maxConcurrent?: number
  autoUpload?: boolean
}

interface UploadQueueItem {
  file: File
  id: string
  abortController: AbortController
}

export function useFileUpload(options: UseFileUploadOptions) {
  const {
    endpoint,
    onSuccess,
    onError,
    onProgress,
    maxConcurrent = 3,
    autoUpload = true,
  } = options

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const queueRef = useRef<UploadQueueItem[]>([])
  const activeUploadsRef = useRef(0)

  const generateId = () => {
    return `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  const createPreview = async (file: File): Promise<string | undefined> => {
    if (!file.type.startsWith('image/')) return undefined

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(file)
    })
  }

  const uploadFile = async (uploadedFile: UploadedFile, abortController: AbortController) => {
    const formData = new FormData()
    formData.append('file', uploadedFile.file)

    try {
      const xhr = new XMLHttpRequest()

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, progress, status: 'uploading' }
                : f
            )
          )
          onProgress?.(uploadedFile.file, progress)
        }
      })

      // Success handler
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, status: 'success', progress: 100 }
                : f
            )
          )
          onSuccess?.(uploadedFile.file, response)
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`)
        }
      })

      // Error handler
      xhr.addEventListener('error', () => {
        throw new Error('Network error occurred')
      })

      // Abort handler
      xhr.addEventListener('abort', () => {
        throw new Error('Upload cancelled')
      })

      // Setup abort
      abortController.signal.addEventListener('abort', () => {
        xhr.abort()
      })

      // Send request
      xhr.open('POST', endpoint)
      xhr.send(formData)

      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? { ...f, status: 'error', error: err.message }
            : f
        )
      )
      onError?.(uploadedFile.file, err)
      throw err
    } finally {
      activeUploadsRef.current -= 1
      processQueue()
    }
  }

  const processQueue = useCallback(() => {
    if (activeUploadsRef.current >= maxConcurrent || queueRef.current.length === 0) {
      if (activeUploadsRef.current === 0 && queueRef.current.length === 0) {
        setIsUploading(false)
      }
      return
    }

    const item = queueRef.current.shift()
    if (!item) return

    activeUploadsRef.current += 1
    setIsUploading(true)

    const uploadedFile = files.find((f) => f.id === item.id)
    if (uploadedFile) {
      uploadFile(uploadedFile, item.abortController).catch(() => {
        // Error already handled in uploadFile
      })
    }

    // Process next item
    processQueue()
  }, [files, maxConcurrent])

  const addFiles = useCallback(
    async (newFiles: File[]) => {
      const uploadedFiles: UploadedFile[] = await Promise.all(
        newFiles.map(async (file) => {
          const id = generateId()
          const preview = await createPreview(file)
          return {
            id,
            file,
            preview,
            progress: 0,
            status: 'pending' as const,
          }
        })
      )

      setFiles((prev) => [...prev, ...uploadedFiles])

      if (autoUpload) {
        uploadedFiles.forEach((uploadedFile) => {
          const abortController = new AbortController()
          queueRef.current.push({
            file: uploadedFile.file,
            id: uploadedFile.id,
            abortController,
          })
        })
        processQueue()
      }

      return uploadedFiles
    },
    [autoUpload, processQueue]
  )

  const removeFile = useCallback((id: string) => {
    // Cancel upload if in progress
    const queueItem = queueRef.current.find((item) => item.id === id)
    if (queueItem) {
      queueItem.abortController.abort()
      queueRef.current = queueRef.current.filter((item) => item.id !== id)
    }

    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const removeAllFiles = useCallback(() => {
    // Cancel all uploads
    queueRef.current.forEach((item) => item.abortController.abort())
    queueRef.current = []
    activeUploadsRef.current = 0
    setFiles([])
    setIsUploading(false)
  }, [])

  const retryFile = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id)
      if (!file || file.status !== 'error') return

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'pending', error: undefined, progress: 0 } : f
        )
      )

      const abortController = new AbortController()
      queueRef.current.push({
        file: file.file,
        id: file.id,
        abortController,
      })

      processQueue()
    },
    [files, processQueue]
  )

  const uploadAll = useCallback(() => {
    const pendingFiles = files.filter((f) => f.status === 'pending')

    pendingFiles.forEach((file) => {
      const abortController = new AbortController()
      queueRef.current.push({
        file: file.file,
        id: file.id,
        abortController,
      })
    })

    processQueue()
  }, [files, processQueue])

  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === 'pending').length,
    uploading: files.filter((f) => f.status === 'uploading').length,
    success: files.filter((f) => f.status === 'success').length,
    error: files.filter((f) => f.status === 'error').length,
  }

  return {
    files,
    addFiles,
    removeFile,
    removeAllFiles,
    retryFile,
    uploadAll,
    isUploading,
    stats,
  }
}
