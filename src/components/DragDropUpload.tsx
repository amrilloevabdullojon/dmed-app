'use client'

import { useState, useRef, DragEvent, ChangeEvent, ReactNode } from 'react'
import { Upload, X, File, Image as ImageIcon, FileText, Video, Music, Archive } from 'lucide-react'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { useUserPreferences } from '@/hooks/useUserPreferences'

export interface UploadedFile {
  id: string
  file: File
  preview?: string
  progress?: number
  error?: string
  status: 'pending' | 'uploading' | 'success' | 'error'
}

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void
  onFileRemove?: (id: string) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // in bytes
  maxFiles?: number
  disabled?: boolean
  className?: string
  showPreview?: boolean
  files?: UploadedFile[]
  children?: ReactNode
}

const FILE_ICONS: Record<string, typeof File> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  pdf: FileText,
  zip: Archive,
  default: File,
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return FILE_ICONS.image
  if (type.startsWith('video/')) return FILE_ICONS.video
  if (type.startsWith('audio/')) return FILE_ICONS.audio
  if (type === 'application/pdf') return FILE_ICONS.pdf
  if (type.includes('zip') || type.includes('rar')) return FILE_ICONS.zip
  return FILE_ICONS.default
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

export function DragDropUpload({
  onFilesSelected,
  onFileRemove,
  accept,
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  disabled = false,
  className = '',
  showPreview = true,
  files = [],
  children,
}: DragDropUploadProps) {
  const { preferences } = useUserPreferences()
  const animationsEnabled = preferences?.animations ?? true

  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `Файл слишком большой. Максимум: ${formatFileSize(maxSize)}`
    }

    if (accept) {
      const acceptedTypes = accept.split(',').map((t) => t.trim())
      const fileExt = `.${file.name.split('.').pop()}`
      const fileType = file.type

      const isAccepted = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return fileExt.toLowerCase() === type.toLowerCase()
        }
        if (type.endsWith('/*')) {
          const category = type.split('/')[0]
          return fileType.startsWith(category)
        }
        return fileType === type
      })

      if (!isAccepted) {
        return `Неподдерживаемый тип файла. Разрешены: ${accept}`
      }
    }

    return null
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return

    const newFiles = Array.from(fileList)

    // Check max files limit
    if (files.length + newFiles.length > maxFiles) {
      hapticMedium()
      alert(`Максимум ${maxFiles} файлов`)
      return
    }

    // Validate files
    const validFiles: File[] = []
    const errors: string[] = []

    newFiles.forEach((file) => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push(file)
      }
    })

    if (errors.length > 0) {
      hapticMedium()
      alert(errors.join('\n'))
    }

    if (validFiles.length > 0) {
      hapticLight()
      onFilesSelected(validFiles)
    }
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    setDragCounter((prev) => prev + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    setDragCounter((prev) => {
      const newCounter = prev - 1
      if (newCounter === 0) {
        setIsDragging(false)
      }
      return newCounter
    })
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    setIsDragging(false)
    setDragCounter(0)

    if (disabled) return

    const { files } = e.dataTransfer
    handleFiles(files)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset input value to allow uploading the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!disabled) {
      hapticLight()
      fileInputRef.current?.click()
    }
  }

  const handleRemove = (id: string) => {
    hapticLight()
    onFileRemove?.(id)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all ${
          isDragging
            ? 'border-teal-400 bg-teal-500/10 scale-[1.02]'
            : disabled
              ? 'border-gray-700/50 bg-gray-800/30 cursor-not-allowed opacity-50'
              : 'border-gray-600/50 bg-gray-800/20 hover:border-gray-500/70 hover:bg-gray-800/30'
        } ${animationsEnabled ? 'duration-200' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-4 p-8 md:p-12">
          <div
            className={`rounded-full bg-gray-800/80 p-4 ${isDragging ? 'scale-110' : 'scale-100'} ${
              animationsEnabled ? 'transition-transform duration-200' : ''
            }`}
          >
            <Upload
              className={`h-8 w-8 ${isDragging ? 'text-teal-400' : 'text-gray-400'} ${
                animationsEnabled && isDragging ? 'animate-bounce' : ''
              }`}
            />
          </div>

          {children || (
            <>
              <div className="text-center">
                <p className="text-base font-medium text-white">
                  {isDragging
                    ? 'Отпустите файлы'
                    : 'Перетащите файлы или нажмите для выбора'}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {accept
                    ? `Поддерживаемые форматы: ${accept}`
                    : 'Любые файлы'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Максимум: {formatFileSize(maxSize)} · До {maxFiles} файлов
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      {showPreview && files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">
            Файлы ({files.length}/{maxFiles})
          </h4>
          <div className="space-y-2">
            {files.map((uploadedFile) => {
              const Icon = getFileIcon(uploadedFile.file.type)
              const isImage = uploadedFile.file.type.startsWith('image/')

              return (
                <div
                  key={uploadedFile.id}
                  className={`group relative flex items-center gap-3 rounded-lg border bg-gray-800/50 p-3 transition ${
                    uploadedFile.status === 'error'
                      ? 'border-red-500/30 bg-red-500/5'
                      : uploadedFile.status === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-gray-700/50'
                  } ${animationsEnabled ? 'animate-fadeIn' : ''}`}
                >
                  {/* Preview or Icon */}
                  <div className="flex-shrink-0">
                    {isImage && uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-700/50">
                        <Icon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(uploadedFile.file.size)}
                      {uploadedFile.status === 'uploading' &&
                        uploadedFile.progress !== undefined &&
                        ` · ${uploadedFile.progress}%`}
                    </p>
                    {uploadedFile.error && (
                      <p className="mt-1 text-xs text-red-400">{uploadedFile.error}</p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {uploadedFile.status === 'uploading' &&
                    uploadedFile.progress !== undefined && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg bg-gray-700/30">
                        <div
                          className="h-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${uploadedFile.progress}%` }}
                        />
                      </div>
                    )}

                  {/* Remove Button */}
                  {onFileRemove && uploadedFile.status !== 'uploading' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(uploadedFile.id)
                      }}
                      className="flex-shrink-0 rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-gray-700/50 hover:text-white group-hover:opacity-100"
                      aria-label="Удалить файл"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
