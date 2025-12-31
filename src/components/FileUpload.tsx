'use client'

import { useEffect, useState, useRef } from 'react'
import { Upload, X, Loader2, FileText, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from '@/lib/constants'

interface FileInfo {
  id: string
  name: string
  url: string
  size?: number | null
  mimeType?: string | null
  status?: string | null
  uploadError?: string | null
}

interface FileUploadProps {
  letterId: string
  files: FileInfo[]
  onFilesChange: () => void
}

export function FileUpload({ letterId, files, onFilesChange }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasPendingFiles = files.some(
    (file) => file.status && file.status !== 'READY'
  )

  useEffect(() => {
    if (!hasPendingFiles) return
    const timer = setTimeout(() => {
      onFilesChange()
    }, 5000)
    return () => clearTimeout(timer)
  }, [hasPendingFiles, onFilesChange])

  const handleUpload = async (file: File) => {
    // Проверка размера файла на клиенте
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_LABEL}`)
      return
    }

    setUploading(true)
    const toastId = toast.loading('Загрузка файла...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('letterId', letterId)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 413) {
        toast.error('DDøD1D¯ ¥?D¯D,¥^D§D_D¬ DñD_D¯¥O¥^D_D1 (413)')
        return
      }

      const data = await res.json()

      if (data.success) {
        toast.success('Файл загружен', { id: toastId })
        onFilesChange()
      } else {
        toast.error(data.error || 'Ошибка загрузки', { id: toastId })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Ошибка загрузки файла', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('Удалить этот файл?')) return

    setDeleting(fileId)

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Файл удалён')
        onFilesChange()
      } else {
        toast.error('Ошибка удаления')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Ошибка удаления файла')
    } finally {
      setDeleting(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Файлы</h3>

      {/* Upload zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
          dragOver
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <span className="text-gray-400">Загрузка...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-500" />
            <p className="text-gray-400">
              Перетащите файл сюда или{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                выберите
              </button>
            </p>
            <p className="text-xs text-gray-500">
              PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG (макс. 10 MB)
            </p>
          </div>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <a
                    href={`/api/files/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-emerald-400 transition truncate block"
                  >
                    {file.name}
                  </a>
                  {file.status && file.status !== 'READY' && (
                    <span
                      className={`text-xs ${
                        file.status === 'FAILED' ? 'text-red-300' : 'text-amber-300'
                      }`}
                      title={file.uploadError || undefined}
                    >
                      {file.status === 'PENDING_SYNC'
                        ? 'D¥?D_D¬D_Dñ¥?DøD«D«¥<¥.'
                        : file.status === 'UPLOADING'
                          ? 'D-DøD3¥?¥ŸDúD§Dø...'
                          : 'D?¥?D8D1D,D1 D?D_D¬D_Dñ¥?DøD«D«¥<¥.'}
                    </span>
                  )}
                  {file.size && (
                    <span className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/api/files/${file.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-white transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deleting === file.id}
                  className="p-2 text-gray-400 hover:text-red-400 transition disabled:opacity-50"
                >
                  {deleting === file.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !uploading && (
        <p className="text-center text-gray-500 mt-4">Нет прикреплённых файлов</p>
      )}
    </div>
  )
}
