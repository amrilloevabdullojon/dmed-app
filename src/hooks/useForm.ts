'use client'

import { useState, useCallback, useMemo, useRef, ChangeEvent, FormEvent } from 'react'
import { z, ZodSchema, ZodError } from 'zod'

/**
 * Field state
 */
interface FieldState<T> {
  value: T
  error: string | null
  touched: boolean
  dirty: boolean
}

/**
 * Form state
 */
interface FormState<T extends Record<string, unknown>> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

/**
 * Form options
 */
interface UseFormOptions<T extends Record<string, unknown>> {
  /** Initial form values */
  initialValues: T

  /** Zod schema for validation */
  schema?: ZodSchema<T>

  /** Validate on change */
  validateOnChange?: boolean

  /** Validate on blur */
  validateOnBlur?: boolean

  /** Submit handler */
  onSubmit?: (values: T) => Promise<void> | void

  /** Error handler */
  onError?: (errors: Partial<Record<keyof T, string>>) => void
}

/**
 * Hook for form management with Zod validation.
 *
 * @example
 * ```tsx
 * const loginSchema = z.object({
 *   email: z.string().email('Invalid email'),
 *   password: z.string().min(8, 'Password must be at least 8 characters')
 * })
 *
 * function LoginForm() {
 *   const form = useForm({
 *     initialValues: { email: '', password: '' },
 *     schema: loginSchema,
 *     onSubmit: async (values) => {
 *       await login(values)
 *     }
 *   })
 *
 *   return (
 *     <form onSubmit={form.handleSubmit}>
 *       <input {...form.register('email')} />
 *       {form.errors.email && <span>{form.errors.email}</span>}
 *
 *       <input {...form.register('password')} type="password" />
 *       {form.errors.password && <span>{form.errors.password}</span>}
 *
 *       <button type="submit" disabled={!form.isValid || form.isSubmitting}>
 *         {form.isSubmitting ? 'Loading...' : 'Login'}
 *       </button>
 *     </form>
 *   )
 * }
 * ```
 */
export function useForm<T extends Record<string, unknown>>(options: UseFormOptions<T>) {
  const {
    initialValues,
    schema,
    validateOnChange = true,
    validateOnBlur = true,
    onSubmit,
    onError,
  } = options

  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const initialValuesRef = useRef(initialValues)

  /**
   * Validate single field
   */
  const validateField = useCallback(
    (name: keyof T, value: unknown): string | null => {
      if (!schema) return null

      try {
        // Validate entire form with updated field value
        const testValues = { ...values, [name]: value }
        schema.parse(testValues)
        return null
      } catch (error) {
        if (error instanceof ZodError) {
          // Find error for this specific field
          const fieldError = error.errors.find((e) => e.path[0] === name)
          return fieldError?.message || null
        }
        return null
      }
    },
    [schema, values]
  )

  /**
   * Validate entire form
   */
  const validateForm = useCallback((): Partial<Record<keyof T, string>> => {
    if (!schema) return {}

    try {
      schema.parse(values)
      return {}
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Partial<Record<keyof T, string>> = {}
        error.errors.forEach((err) => {
          const field = err.path[0] as keyof T
          if (!fieldErrors[field]) {
            fieldErrors[field] = err.message
          }
        })
        return fieldErrors
      }
      return {}
    }
  }, [schema, values])

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    if (!schema) return true
    try {
      schema.parse(values)
      return true
    } catch {
      return false
    }
  }, [schema, values])

  /**
   * Check if form is dirty
   */
  const isDirty = useMemo(() => {
    return Object.keys(values).some(
      (key) => values[key as keyof T] !== initialValuesRef.current[key as keyof T]
    )
  }, [values])

  /**
   * Set field value
   */
  const setValue = useCallback(
    <K extends keyof T>(name: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [name]: value }))

      if (validateOnChange) {
        const error = validateField(name, value)
        setErrors((prev) => ({ ...prev, [name]: error || undefined }))
      }
    },
    [validateOnChange, validateField]
  )

  /**
   * Set multiple values
   */
  const setMultipleValues = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...newValues }))
  }, [])

  /**
   * Set field error
   */
  const setError = useCallback(<K extends keyof T>(name: K, error: string | null) => {
    setErrors((prev) => ({ ...prev, [name]: error || undefined }))
  }, [])

  /**
   * Mark field as touched
   */
  const setFieldTouched = useCallback(
    <K extends keyof T>(name: K, isTouched: boolean = true) => {
      setTouched((prev) => ({ ...prev, [name]: isTouched }))

      if (validateOnBlur && isTouched) {
        const error = validateField(name, values[name])
        setErrors((prev) => ({ ...prev, [name]: error || undefined }))
      }
    },
    [validateOnBlur, validateField, values]
  )

  /**
   * Register field (returns props for input)
   */
  const register = useCallback(
    <K extends keyof T>(name: K) => ({
      name: name as string,
      value: values[name] as string,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValue(name, e.target.value as T[K])
      },
      onBlur: () => setFieldTouched(name, true),
    }),
    [values, setValue, setFieldTouched]
  )

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Record<keyof T, boolean>
      )
      setTouched(allTouched)

      // Validate form
      const formErrors = validateForm()

      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors)
        onError?.(formErrors)
        return
      }

      if (!onSubmit) return

      setIsSubmitting(true)
      try {
        await onSubmit(values)
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, validateForm, onSubmit, onError]
  )

  /**
   * Reset form to initial values
   */
  const reset = useCallback((newValues?: T) => {
    const resetValues = newValues || initialValuesRef.current
    setValues(resetValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
    if (newValues) {
      initialValuesRef.current = newValues
    }
  }, [])

  /**
   * Get field state
   */
  const getFieldState = useCallback(
    <K extends keyof T>(name: K): FieldState<T[K]> => ({
      value: values[name],
      error: errors[name] || null,
      touched: touched[name] || false,
      dirty: values[name] !== initialValuesRef.current[name],
    }),
    [values, errors, touched]
  )

  return {
    // State
    values,
    errors,
    touched,
    isValid,
    isDirty,
    isSubmitting,

    // Actions
    setValue,
    setMultipleValues,
    setError,
    setFieldTouched,
    register,
    handleSubmit,
    reset,
    getFieldState,
    validateForm,
    validateField,
  }
}

/**
 * Hook for controlled input with validation
 */
export function useField<T>(
  initialValue: T,
  options: {
    validate?: (value: T) => string | null
    validateOnChange?: boolean
    validateOnBlur?: boolean
  } = {}
): {
  value: T
  error: string | null
  touched: boolean
  onChange: (value: T) => void
  onBlur: () => void
  reset: () => void
  setError: (error: string | null) => void
} {
  const { validate, validateOnChange = true, validateOnBlur = true } = options

  const [value, setValue] = useState<T>(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const onChange = useCallback(
    (newValue: T) => {
      setValue(newValue)
      if (validateOnChange && validate) {
        setError(validate(newValue))
      }
    },
    [validate, validateOnChange]
  )

  const onBlur = useCallback(() => {
    setTouched(true)
    if (validateOnBlur && validate) {
      setError(validate(value))
    }
  }, [validate, validateOnBlur, value])

  const reset = useCallback(() => {
    setValue(initialValue)
    setError(null)
    setTouched(false)
  }, [initialValue])

  return {
    value,
    error,
    touched,
    onChange,
    onBlur,
    reset,
    setError,
  }
}
