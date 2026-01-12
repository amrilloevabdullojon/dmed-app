'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface MobileOptimizedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const MobileOptimizedInput = forwardRef<HTMLInputElement, MobileOptimizedInputProps>(
  function MobileOptimizedInput({ label, error, helperText, className, ...props }, ref) {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className="mb-2 block text-sm font-medium text-white md:text-base"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            // Base styles
            'w-full rounded-xl border bg-white/5 px-4 text-white transition',
            'focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20',
            // Mobile optimizations
            'h-12 text-base md:h-10 md:text-sm', // 48px on mobile, 40px on desktop
            'placeholder:text-slate-400',
            // Error state
            error
              ? 'border-red-400/50 focus:border-red-400/50 focus:ring-red-400/20'
              : 'border-white/10',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-gray-400">{helperText}</p>}
      </div>
    )
  }
)

interface MobileOptimizedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const MobileOptimizedTextarea = forwardRef<
  HTMLTextAreaElement,
  MobileOptimizedTextareaProps
>(function MobileOptimizedTextarea({ label, error, helperText, className, ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={props.id}
          className="mb-2 block text-sm font-medium text-white md:text-base"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          // Base styles
          'w-full rounded-xl border bg-white/5 px-4 py-3 text-white transition',
          'focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20',
          // Mobile optimizations
          'min-h-[120px] text-base md:text-sm',
          'placeholder:text-slate-400',
          // Error state
          error
            ? 'border-red-400/50 focus:border-red-400/50 focus:ring-red-400/20'
            : 'border-white/10',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-gray-400">{helperText}</p>}
    </div>
  )
})

interface MobileOptimizedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string }>
}

export const MobileOptimizedSelect = forwardRef<HTMLSelectElement, MobileOptimizedSelectProps>(
  function MobileOptimizedSelect({ label, error, helperText, options, className, ...props }, ref) {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className="mb-2 block text-sm font-medium text-white md:text-base"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            // Base styles
            'w-full rounded-xl border bg-white/5 px-4 text-white transition',
            'focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20',
            // Mobile optimizations
            'h-12 text-base md:h-10 md:text-sm',
            // Error state
            error
              ? 'border-red-400/50 focus:border-red-400/50 focus:ring-red-400/20'
              : 'border-white/10',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-gray-400">{helperText}</p>}
      </div>
    )
  }
)
