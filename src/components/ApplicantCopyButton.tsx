'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

type ApplicantCopyButtonProps = {
  value: string
  language?: 'ru' | 'uz'
}

export function ApplicantCopyButton({ value, language = 'ru' }: ApplicantCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const label =
    language === 'uz'
      ? 'Nusxa olish'
      : '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c'
  const successLabel =
    language === 'uz'
      ? 'Nusxa olindi'
      : '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="app-pill text-xs"
      title={copied ? successLabel : label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? successLabel : label}
    </button>
  )
}
