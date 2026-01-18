'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePWA } from '@/hooks/usePWA'
import { PWAInstallPrompt } from './PWAInstallPrompt'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { hapticMedium } from '@/lib/haptic'

export function PWAProvider({ children }: { children: ReactNode }) {
  const { isUpdateAvailable, isOnline, updateServiceWorker } = usePWA()
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(false)

  useEffect(() => {
    if (isUpdateAvailable) {
      setShowUpdatePrompt(true)
    }
  }, [isUpdateAvailable])

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineIndicator(true)
    } else {
      // Hide after delay when coming back online
      const timer = setTimeout(() => setShowOfflineIndicator(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  const handleUpdate = () => {
    hapticMedium()
    updateServiceWorker()
    setShowUpdatePrompt(false)
  }

  return (
    <>
      {children}

      {/* Install Prompt */}
      <PWAInstallPrompt />

      {/* Update Available Prompt */}
      {showUpdatePrompt && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-teal-500/30 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-md animate-slideUp md:bottom-4 md:left-auto md:right-4 md:w-96">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-teal-500/20 p-2">
              <RefreshCw className="h-6 w-6 text-teal-400" />
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">
                Доступно обновление
              </h3>
              <p className="mt-1 text-xs text-gray-300">
                Новая версия приложения готова к установке
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600"
                >
                  Обновить
                </button>
                <button
                  onClick={() => setShowUpdatePrompt(false)}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
                >
                  Позже
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline/Online Indicator */}
      {showOfflineIndicator && (
        <div
          className={`fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md animate-slideDown ${
            isOnline
              ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
              : 'border border-amber-500/30 bg-amber-500/20 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>Подключение восстановлено</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Нет подключения к сети</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
