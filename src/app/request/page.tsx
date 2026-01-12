'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Script from 'next/script'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Header } from '@/components/Header'
import { useToast } from '@/components/Toast'
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  REQUEST_ALLOWED_FILE_EXTENSIONS,
  REQUEST_MAX_FILES,
} from '@/lib/constants'
import { publicRequestSchema, type PublicRequestInput } from '@/lib/schemas'
import {
  Paperclip,
  Send,
  Trash2,
  Building2,
  User,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void
    onTurnstileExpired?: () => void
    onTurnstileError?: () => void
    turnstile?: {
      reset: (widgetId?: string) => void
      render?: (container: HTMLElement, options: Record<string, unknown>) => string
    }
  }
}

const REQUEST_TYPES = [
  { value: 'consultation', label: 'Консультация', icon: MessageCircle, color: 'text-blue-400' },
  { value: 'support', label: 'Техподдержка', icon: FileText, color: 'text-amber-400' },
  { value: 'partnership', label: 'Сотрудничество', icon: Building2, color: 'text-emerald-400' },
  { value: 'other', label: 'Другое', icon: Sparkles, color: 'text-purple-400' },
]

const DRAFT_KEY = 'request_form_draft'

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `+${digits}`
  if (digits.length <= 5) return `+${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length <= 8) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`
  if (digits.length <= 10)
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`
}

const isImageFile = (file: File) => file.type.startsWith('image/')

export default function RequestPage() {
  const toast = useToast()

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<PublicRequestInput>({
    resolver: zodResolver(publicRequestSchema),
    mode: 'onChange',
    defaultValues: {
      requestType: '',
      organization: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      contactTelegram: '',
      description: '',
    },
  })

  const formValues = watch()

  // Other state
  const [files, setFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [step, setStep] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const TOTAL_STEPS = 4

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const draft = JSON.parse(saved)
        if (draft.form) {
          // Load saved data into React Hook Form
          Object.entries(draft.form).forEach(([key, value]) => {
            setValue(key as keyof PublicRequestInput, value as string)
          })
          setDraftRestored(true)
          setTimeout(() => setDraftRestored(false), 3000)
        }
      } catch {
        // Ignore invalid JSON
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save draft to localStorage
  useEffect(() => {
    const hasData = Object.values(formValues).some((v) => v && v.trim() !== '')
    if (hasData && !submitted) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: formValues, savedAt: Date.now() }))
    }
  }, [formValues, submitted])

  // Clear draft on successful submit
  useEffect(() => {
    if (submitted) {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [submitted])

  // Generate image previews
  useEffect(() => {
    const newPreviews: Record<number, string> = {}
    files.forEach((file, index) => {
      if (isImageFile(file)) {
        const url = URL.createObjectURL(file)
        newPreviews[index] = url
      }
    })
    setFilePreviews(newPreviews)

    return () => {
      Object.values(newPreviews).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  useEffect(() => {
    if (!turnstileSiteKey) return

    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token)
    window.onTurnstileExpired = () => setTurnstileToken('')
    window.onTurnstileError = () => setTurnstileToken('')

    return () => {
      delete window.onTurnstileSuccess
      delete window.onTurnstileExpired
      delete window.onTurnstileError
    }
  }, [turnstileSiteKey])

  useEffect(() => {
    if (step !== 4) {
      turnstileWidgetId.current = null
    }
  }, [step])

  useEffect(() => {
    if (step !== 4 || !turnstileSiteKey) return
    if (!turnstileRef.current || turnstileWidgetId.current) return

    const renderWidget = () => {
      if (!window.turnstile?.render || !turnstileRef.current) return false
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
        theme: 'dark',
      })
      return true
    }

    if (renderWidget()) return

    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (renderWidget() || attempts > 20) {
        clearInterval(timer)
      }
    }, 200)

    return () => clearInterval(timer)
  }, [step, turnstileSiteKey])

  // Phone formatting helper
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setValue('contactPhone', formatted)
  }

  // Telegram formatting helper
  const handleTelegramChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted =
      value.startsWith('@') || value.startsWith('+') || value === '' ? value : `@${value}`
    setValue('contactTelegram', formatted)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    addFiles(selected)
    event.target.value = ''
  }

  const addFiles = useCallback(
    (selected: File[]) => {
      if (selected.length === 0) return

      const nextFiles: File[] = []
      for (const file of selected) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`Файл "${file.name}" слишком большой. Максимум ${MAX_FILE_SIZE_LABEL}.`)
          continue
        }
        nextFiles.push(file)
      }

      const combined = [...files, ...nextFiles]
      if (combined.length > REQUEST_MAX_FILES) {
        toast.warning(`Максимум ${REQUEST_MAX_FILES} файлов. Лишние файлы не будут добавлены.`)
      }

      setFiles(combined.slice(0, REQUEST_MAX_FILES))
    },
    [files, toast]
  )

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
    },
    [addFiles]
  )

  const resetForm = () => {
    setValue('requestType', '')
    setValue('organization', '')
    setValue('contactName', '')
    setValue('contactEmail', '')
    setValue('contactPhone', '')
    setValue('contactTelegram', '')
    setValue('description', '')
    setFiles([])
    setSubmitted(false)
    setSubmittedId('')
    setTurnstileToken('')
    setStep(1)
    localStorage.removeItem(DRAFT_KEY)
    if (typeof window !== 'undefined' && window.turnstile?.reset) {
      try {
        window.turnstile.reset()
      } catch {
        // Ignore Turnstile reset errors in the UI.
      }
    }
  }

  const nextStep = async () => {
    // Validate current step fields
    let fieldsToValidate: (keyof PublicRequestInput)[] = []

    if (step === 1) {
      fieldsToValidate = ['requestType', 'organization']
    } else if (step === 2) {
      fieldsToValidate = ['contactName', 'contactEmail', 'contactPhone', 'contactTelegram']
    } else if (step === 3) {
      fieldsToValidate = ['description']
    }

    const isValid = await trigger(fieldsToValidate)

    if (isValid && step < TOTAL_STEPS) {
      setStep(step + 1)
    }
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const onSubmit = async (data: PublicRequestInput) => {
    if (submitting) return

    if (!turnstileSiteKey) {
      toast.error('Captcha is not configured.')
      return
    }

    if (!turnstileToken) {
      toast.error('Пожалуйста, пройдите проверку captcha.')
      return
    }

    setSubmitting(true)
    const toastId = toast.loading('Отправка заявки...')

    try {
      const formData = new FormData()
      formData.append('requestType', data.requestType)
      formData.append('organization', data.organization)
      formData.append('contactName', data.contactName)
      formData.append('contactEmail', data.contactEmail)
      formData.append('contactPhone', data.contactPhone)
      formData.append('contactTelegram', data.contactTelegram)
      formData.append('description', data.description)
      formData.append('website', honeypot)
      formData.append('cf-turnstile-response', turnstileToken)

      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Request failed')
      }

      if (Array.isArray(result.filesFailed) && result.filesFailed.length > 0) {
        toast.warning('Часть файлов не загрузилась. Заявка все равно создана.')
      }

      toast.success('Заявка отправлена!', { id: toastId })
      setSubmittedId(typeof result.requestId === 'string' ? result.requestId : '')
      setSubmitted(true)
    } catch (error) {
      console.error('Request submit failed:', error)
      toast.error('Не удалось отправить заявку. Попробуйте еще раз.', { id: toastId })
    } finally {
      setSubmitting(false)
      setTurnstileToken('')
      if (typeof window !== 'undefined' && window.turnstile?.reset) {
        try {
          window.turnstile.reset()
        } catch {
          // Ignore Turnstile reset errors in the UI.
        }
      }
    }
  }

  const copyRequestId = async () => {
    if (!submittedId) return
    try {
      await navigator.clipboard.writeText(submittedId)
    } catch {
      // Ignore clipboard errors
    }
  }

  const renderStepIndicator = () => (
    <div className="mb-8 flex items-center justify-center gap-2">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center">
          <button
            type="button"
            onClick={() => s < step && setStep(s)}
            disabled={s > step}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all ${
              s === step
                ? 'scale-110 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : s < step
                  ? 'cursor-pointer bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-gray-700 text-gray-500'
            }`}
          >
            {s < step ? <Check className="h-5 w-5" /> : s}
          </button>
          {s < 4 && (
            <div
              className={`mx-1 h-0.5 w-8 sm:w-12 ${s < step ? 'bg-emerald-500/50' : 'bg-gray-700'}`}
            />
          )}
        </div>
      ))}
    </div>
  )

  const renderStepTitle = () => {
    const titles = ['Тип заявки', 'Контакты', 'Описание', 'Файлы и отправка']
    return (
      <div className="mb-6 text-center">
        <h2 className="text-lg font-medium text-white">{titles[step - 1]}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Шаг {step} из {TOTAL_STEPS}
        </p>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-gray-900">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          async
          defer
          strategy="afterInteractive"
        />
      )}
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="panel panel-glass rounded-2xl p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">{'Подать заявку'}</h1>
            <p className="mt-2 text-sm text-slate-300/80">
              {'Заполните форму, и мы свяжемся с вами'}
            </p>
            {draftRestored && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm text-blue-300">
                <Check className="h-4 w-4" />
                Черновик восстановлен
              </div>
            )}
          </div>

          {submitted ? (
            <div className="py-8 text-center">
              <div className="animate-scaleIn mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-10 w-10 text-emerald-400" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-white">Заявка отправлена!</h2>
              <p className="mb-6 text-slate-300">Спасибо! Мы свяжемся с вами в ближайшее время.</p>
              {submittedId && (
                <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
                  <div className="text-xs text-slate-400">
                    {'\u041d\u043e\u043c\u0435\u0440 \u0437\u0430\u044f\u0432\u043a\u0438'}
                  </div>
                  <div className="mt-1 break-all text-sm text-emerald-200">{submittedId}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copyRequestId}
                      className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/20"
                    >
                      {'\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}
                    </button>
                    <Link
                      href="/portal/request"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-500/30"
                    >
                      {
                        '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443'
                      }
                    </Link>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {
                      '\u0414\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0438 \u0432\u0430\u0448 \u043a\u043e\u043d\u0442\u0430\u043a\u0442.'
                    }
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm text-white transition hover:bg-white/20"
              >
                Отправить еще одну заявку
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              {renderStepIndicator()}
              {renderStepTitle()}

              {/* Step 1: Request Type */}
              {step === 1 && (
                <div className="animate-fadeIn space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-300">
                      Тип обращения *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {REQUEST_TYPES.map((type) => {
                        const Icon = type.icon
                        const isSelected = formValues.requestType === type.value
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => {
                              setValue('requestType', type.value)
                              trigger('requestType')
                            }}
                            className={`rounded-xl border-2 p-4 text-left transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                            }`}
                          >
                            <Icon
                              className={`mb-2 h-6 w-6 ${isSelected ? 'text-emerald-400' : type.color}`}
                            />
                            <p
                              className={`font-medium ${isSelected ? 'text-emerald-300' : 'text-white'}`}
                            >
                              {type.label}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                    {errors.requestType && (
                      <p className="mt-2 text-sm text-red-400">{errors.requestType.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Организация *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <input
                        {...register('organization')}
                        type="text"
                        placeholder="Наименование организации"
                        className={`w-full rounded-lg border bg-gray-700 py-2.5 pl-10 pr-4 text-white placeholder-gray-400 transition focus:outline-none ${
                          errors.organization
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-600 focus:border-emerald-500'
                        }`}
                      />
                      {errors.organization && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    {errors.organization && (
                      <p className="mt-1.5 text-sm text-red-400">{errors.organization.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Contacts */}
              {step === 2 && (
                <div className="animate-fadeIn space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Контактное лицо *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        {...register('contactName')}
                        type="text"
                        placeholder="Ваше имя"
                        className={`w-full rounded-lg border bg-gray-700 py-2.5 pl-10 pr-4 text-white placeholder-gray-400 transition focus:outline-none ${
                          errors.contactName
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-600 focus:border-emerald-500'
                        }`}
                      />
                      {errors.contactName && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    {errors.contactName && (
                      <p className="mt-1.5 text-sm text-red-400">{errors.contactName.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">
                        Телефон *
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <Phone className="h-4 w-4" />
                        </div>
                        <input
                          {...register('contactPhone')}
                          type="tel"
                          placeholder="+998 90 000 00 00"
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value)
                            setValue('contactPhone', formatted)
                          }}
                          className={`w-full rounded-lg border bg-gray-700 py-2.5 pl-10 pr-4 text-white placeholder-gray-400 transition focus:outline-none ${
                            errors.contactPhone
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-600 focus:border-emerald-500'
                          }`}
                        />
                        {errors.contactPhone && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      {errors.contactPhone && (
                        <p className="mt-1.5 text-sm text-red-400">{errors.contactPhone.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">
                        Email *
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <Mail className="h-4 w-4" />
                        </div>
                        <input
                          {...register('contactEmail')}
                          type="email"
                          placeholder="name@example.com"
                          className={`w-full rounded-lg border bg-gray-700 py-2.5 pl-10 pr-4 text-white placeholder-gray-400 transition focus:outline-none ${
                            errors.contactEmail
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-600 focus:border-emerald-500'
                          }`}
                        />
                        {errors.contactEmail && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      {errors.contactEmail && (
                        <p className="mt-1.5 text-sm text-red-400">{errors.contactEmail.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Telegram *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <input
                        {...register('contactTelegram')}
                        type="text"
                        placeholder="@username"
                        onChange={(e) => {
                          const value = e.target.value
                          const formatted =
                            value.startsWith('@') || value.startsWith('+') || value === ''
                              ? value
                              : `@${value}`
                          setValue('contactTelegram', formatted)
                        }}
                        className={`w-full rounded-lg border bg-gray-700 py-2.5 pl-10 pr-4 text-white placeholder-gray-400 transition focus:outline-none ${
                          errors.contactTelegram
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-600 focus:border-emerald-500'
                        }`}
                      />
                      {errors.contactTelegram && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    {errors.contactTelegram && (
                      <p className="mt-1.5 text-sm text-red-400">
                        {errors.contactTelegram.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Description */}
              {step === 3 && (
                <div className="animate-fadeIn space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Содержание проблемы *
                    </label>
                    <div className="relative">
                      <textarea
                        {...register('description')}
                        rows={6}
                        className={`w-full resize-none rounded-lg border bg-gray-700 px-4 py-3 text-white placeholder-gray-400 transition focus:outline-none ${
                          errors.description
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-600 focus:border-emerald-500'
                        }`}
                        placeholder="Опишите подробно, что нужно сделать и какой результат ожидается..."
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                        {formValues.description.length} / 20 мин.
                      </div>
                    </div>
                    {errors.description && (
                      <p className="mt-1.5 text-sm text-red-400">{errors.description.message}</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-sm text-blue-300">
                      <strong>Совет:</strong> Чем подробнее описание, тем быстрее мы сможем помочь.
                      Укажите контекст, ожидаемый результат и сроки если есть.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Files & Submit */}
              {step === 4 && (
                <div className="animate-fadeIn space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-300">
                      Вложения (необязательно)
                    </label>

                    <div
                      ref={dropZoneRef}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                        isDragging
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        accept={REQUEST_ALLOWED_FILE_EXTENSIONS}
                        onChange={handleFileChange}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      <Upload
                        className={`mx-auto mb-3 h-10 w-10 ${isDragging ? 'text-emerald-400' : 'text-gray-500'}`}
                      />
                      <p className="mb-1 font-medium text-white">
                        {isDragging ? 'Отпустите файлы' : 'Перетащите файлы сюда'}
                      </p>
                      <p className="text-sm text-gray-400">
                        или <span className="text-emerald-400">выберите</span> на компьютере
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        До {REQUEST_MAX_FILES} файлов, до {MAX_FILE_SIZE_LABEL} каждый
                      </p>
                    </div>

                    {files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="group flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2"
                          >
                            {filePreviews[index] ? (
                              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700">
                                <Image
                                  src={filePreviews[index]}
                                  alt={file.name}
                                  width={40}
                                  height={40}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-700">
                                <Paperclip className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white">{file.name}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                              aria-label="Удалить файл"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(event) => setHoneypot(event.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {turnstileSiteKey ? (
                    <div className="flex justify-center">
                      <div ref={turnstileRef} className="cf-turnstile" />
                    </div>
                  ) : (
                    <p className="text-center text-xs text-amber-300">
                      Turnstile is not configured.
                    </p>
                  )}
                  <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
                </div>
              )}

              {/* Navigation buttons */}
              <div className="mt-8 flex items-center justify-between border-t border-gray-700 pt-6">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-300 transition hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Назад
                  </button>
                ) : (
                  <div />
                )}

                {step < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Далее
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Send className={`h-4 w-4 ${submitting ? 'animate-pulse' : ''}`} />
                    {submitting ? 'Отправка...' : 'Отправить заявку'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
