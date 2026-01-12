'use client'

import { memo, ReactNode } from 'react'

interface SettingsToggleProps {
  label: string
  description: string
  icon?: ReactNode
  enabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
}

export const SettingsToggle = memo(function SettingsToggle({
  label,
  description,
  icon,
  enabled,
  onToggle,
  disabled = false,
}: SettingsToggleProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-300">
            {icon}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Переключить ${label}`}
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={`flex items-center gap-3 rounded-full border px-3 py-2 text-xs font-medium transition ${
          enabled
            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <span
          className={`flex h-5 w-9 items-center rounded-full border transition ${
            enabled ? 'border-emerald-400/60 bg-emerald-500/40' : 'border-white/10 bg-white/5'
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white transition ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </span>
        <span>{enabled ? 'Включено' : 'Выключено'}</span>
      </button>
    </div>
  )
})
