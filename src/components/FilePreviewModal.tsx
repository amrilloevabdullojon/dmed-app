'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react'

interface FilePreviewModalProps {
  file: {
    id: string
    name: string
    url: string
    mimeType?: string | null
  } | null
  files?: Array<{
    id: string
    name: string
    url: string
    mimeType?: string | null
  }>
  onClose: () => void
  onNavigate?: (file: { id: string; name: string; url: string; mimeType?: string | null }) => void
}

const isImageType = (mimeType?: string | null) => {
  if (!mimeType) return false
  return mimeType.startsWith('image/')
}

const isPdfType = (mimeType?: string | null, name?: string) => {
  if (mimeType === 'application/pdf') return true
  if (name?.toLowerCase().endsWith('.pdf')) return true
  return false
}

export function FilePreviewModal({ file, files, onClose, onNavigate }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const currentIndex = files?.findIndex((f) => f.id === file?.id) ?? -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < (files?.length ?? 0) - 1

  const handlePrev = useCallback(() => {
    if (hasPrev && files && onNavigate) {
      onNavigate(files[currentIndex - 1])
      setZoom(1)
      setRotation(0)
      setLoading(true)
      setError(false)
    }
  }, [currentIndex, files, hasPrev, onNavigate])

  const handleNext = useCallback(() => {
    if (hasNext && files && onNavigate) {
      onNavigate(files[currentIndex + 1])
      setZoom(1)
      setRotation(0)
      setLoading(true)
      setError(false)
    }
  }, [currentIndex, files, hasNext, onNavigate])

  useEffect(() => {
    if (!file) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 3))
      } else if (e.key === '-') {
        setZoom((z) => Math.max(z - 0.25, 0.5))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [file, onClose, handlePrev, handleNext])

  useEffect(() => {
    if (file) {
      setLoading(true)
      setError(false)
      setZoom(1)
      setRotation(0)
    }
  }, [file])

  if (!file) return null

  const isImage = isImageType(file.mimeType)
  const isPdf = isPdfType(file.mimeType, file.name)
  const canPreview = isImage || isPdf

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const handleRotate = () => setRotation((r) => (r + 90) % 360)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="max-w-md truncate text-sm font-medium text-white">{file.name}</h3>
          {files && files.length > 1 && (
            <span className="text-sm text-gray-400">
              {currentIndex + 1} / {files.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Уменьшить"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="min-w-[4rem] text-center text-sm text-gray-400">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Увеличить"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={handleRotate}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                title="Повернуть"
              >
                <RotateCw className="h-5 w-5" />
              </button>
              <div className="mx-2 h-6 w-px bg-gray-700" />
            </>
          )}

          <button
            onClick={handleDownload}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            title="Скачать"
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            title="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {files && files.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            disabled={!hasPrev}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/70 disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={handleNext}
            disabled={!hasNext}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/70 disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Content */}
      <div className="flex h-full w-full items-center justify-center overflow-auto p-16">
        {loading && canPreview && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <AlertCircle className="h-12 w-12" />
            <p>Не удалось загрузить файл</p>
            <button
              onClick={handleDownload}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-white transition hover:bg-emerald-600"
            >
              <Download className="h-4 w-4" />
              Скачать файл
            </button>
          </div>
        )}

        {!canPreview && !error && (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <FileText className="h-16 w-16" />
            <div className="text-center">
              <p className="text-lg font-medium text-white">{file.name}</p>
              <p className="mt-1 text-sm">Предпросмотр недоступен для этого типа файла</p>
            </div>
            <button
              onClick={handleDownload}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-white transition hover:bg-emerald-600"
            >
              <Download className="h-4 w-4" />
              Скачать файл
            </button>
          </div>
        )}

        {isImage && !error && (
          <div
            className="transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <Image
              src={file.url}
              alt={file.name}
              width={1200}
              height={800}
              className={`max-h-[80vh] w-auto object-contain ${loading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false)
                setError(true)
              }}
              unoptimized
            />
          </div>
        )}

        {isPdf && !error && (
          <iframe
            src={`${file.url}#toolbar=0`}
            className={`h-[85vh] w-full max-w-4xl rounded-lg bg-white ${loading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
            title={file.name}
          />
        )}
      </div>

      {/* Keyboard hints */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-4 py-2 text-xs text-gray-400">
        <span className="mr-4">
          <kbd className="rounded bg-gray-700 px-1.5 py-0.5">←</kbd>
          <kbd className="ml-1 rounded bg-gray-700 px-1.5 py-0.5">→</kbd> навигация
        </span>
        {isImage && (
          <span className="mr-4">
            <kbd className="rounded bg-gray-700 px-1.5 py-0.5">+</kbd>
            <kbd className="ml-1 rounded bg-gray-700 px-1.5 py-0.5">-</kbd> масштаб
          </span>
        )}
        <span>
          <kbd className="rounded bg-gray-700 px-1.5 py-0.5">Esc</kbd> закрыть
        </span>
      </div>
    </div>
  )
}
