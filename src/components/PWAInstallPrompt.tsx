'use client'

import { useState, useEffect } from 'react'
import { X, Download, Smartphone } from 'lucide-react'
import { hapticMedium } from '@/lib/haptic'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  // Animations are always enabled for PWA prompts
  const animationsEnabled = true

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running as PWA
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')
      setIsStandalone(standalone)
    }

    checkStandalone()

    // Check if iOS
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
      setIsIOS(isIOSDevice)
    }

    checkIOS()

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)

      // Check if user dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      const dismissedDate = dismissed ? new Date(dismissed) : null
      const daysSinceDismissed = dismissedDate
        ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        : 999

      // Show prompt if not dismissed recently (7 days cooldown)
      if (!dismissed || daysSinceDismissed > 7) {
        setTimeout(() => setShowPrompt(true), 3000) // Delay 3 seconds
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully')
      setShowPrompt(false)
      setDeferredPrompt(null)
      localStorage.removeItem('pwa-install-dismissed')
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    hapticMedium()

    if (!deferredPrompt) {
      // Show iOS instructions
      if (isIOS) {
        setShowPrompt(true)
      }
      return
    }

    setShowPrompt(false)

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice

      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install')
      } else {
        console.log('[PWA] User dismissed install')
      }

      setDeferredPrompt(null)
    } catch (error) {
      console.error('[PWA] Install error:', error)
    }
  }

  const handleDismiss = () => {
    hapticMedium()
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  // Don't show if already installed or no prompt available
  if (isStandalone || (!showPrompt && !isIOS)) {
    return null
  }

  // iOS Installation Instructions
  if (isIOS && showPrompt && !deferredPrompt) {
    return (
      <div
        className={`fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-teal-500/30 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-md md:bottom-4 md:left-auto md:right-4 md:w-96 ${
          animationsEnabled ? 'animate-slideUp' : ''
        }`}
      >
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-gray-400 transition hover:bg-gray-800 hover:text-white"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-lg bg-teal-500/20 p-2">
            <Smartphone className="h-6 w-6 text-teal-400" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Установите DMED Letters
            </h3>
            <p className="mt-1 text-xs text-gray-300">
              Используйте приложение как нативное:
            </p>
            <ol className="mt-2 space-y-1 text-xs text-gray-400">
              <li className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/20 text-[10px] text-teal-400">
                  1
                </span>
                Нажмите на кнопку "Поделиться"
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/20 text-[10px] text-teal-400">
                  2
                </span>
                Выберите "На экран Домой"
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/20 text-[10px] text-teal-400">
                  3
                </span>
                Нажмите "Добавить"
              </li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  // Android/Desktop Install Prompt
  if (showPrompt && deferredPrompt) {
    return (
      <div
        className={`fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-teal-500/30 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-md md:bottom-4 md:left-auto md:right-4 md:w-96 ${
          animationsEnabled ? 'animate-slideUp' : ''
        }`}
      >
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-gray-400 transition hover:bg-gray-800 hover:text-white"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-lg bg-teal-500/20 p-2">
            <Download className="h-6 w-6 text-teal-400" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Установите DMED Letters
            </h3>
            <p className="mt-1 text-xs text-gray-300">
              Быстрый доступ, офлайн режим и push уведомления
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600"
              >
                Установить
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
