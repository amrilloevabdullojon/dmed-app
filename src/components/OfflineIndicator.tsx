'use client'

import { useServiceWorker } from '@/hooks/useServiceWorker'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

export function OfflineIndicator() {
  const { isOffline, hasUpdate, updateServiceWorker } = useServiceWorker()

  if (!isOffline && !hasUpdate) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 mobile-bottom-offset">
      {/* Оффлайн индикатор */}
      {isOffline && (
        <div className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fadeIn">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm">Нет подключения к сети</span>
        </div>
      )}

      {/* Индикатор обновления */}
      {hasUpdate && (
        <button
          onClick={updateServiceWorker}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-lg transition animate-fadeIn"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm">Доступно обновление</span>
        </button>
      )}
    </div>
  )
}
