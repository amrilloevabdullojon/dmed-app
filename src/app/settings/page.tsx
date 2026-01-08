'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { Loader2, Users, Shield, RefreshCw, History, Crown } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { hasPermission } from '@/lib/permissions'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { PermissionsManager } from '@/components/PermissionsManager'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { UsersTab } from '@/components/settings/UsersTab'
import { SyncTab } from '@/components/settings/SyncTab'
import { LoginAuditTab } from '@/components/settings/LoginAuditTab'

type TabType = 'permissions' | 'users' | 'sync' | 'audit'

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [newYearVibe, setNewYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)

  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'

  const handleSuccess = (message: string) => {
    toast.success(message)
  }

  const handleError = (message: string) => {
    toast.error(message)
  }

  if (authStatus === 'loading') {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !hasPermission(session.user.role, 'MANAGE_USERS')) {
    return null
  }

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="animate-pageIn relative mx-auto max-w-[1600px] px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
          Настройки
        </h1>
        <p className="text-muted mb-6 mt-2 text-sm">
          Роли, доступ, уведомления и журнал безопасности.
        </p>

        {/* New Year Vibe Toggle */}
        <div className="panel panel-glass mb-6 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-300">
                <Crown className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Новогодний вайб</div>
                <div className="text-xs text-gray-400">
                  Добавить легкие зимние акценты и нежную подсветку по всему сайту.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={newYearVibe}
              aria-label="Переключить новогодний вайб"
              onClick={() => setNewYearVibe((prev) => !prev)}
              className={`flex items-center gap-3 rounded-full border px-3 py-2 text-xs font-medium transition ${
                newYearVibe
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span
                className={`flex h-5 w-9 items-center rounded-full border transition ${
                  newYearVibe
                    ? 'border-emerald-400/60 bg-emerald-500/40'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition ${
                    newYearVibe ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>{newYearVibe ? 'Включено' : 'Выключено'}</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('permissions')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'permissions'
                  ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Shield className="mr-2 inline-block h-4 w-4" />
              Разрешения
            </button>
          )}
          <button
            onClick={() => setActiveTab('users')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'users'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Users className="mr-2 inline-block h-4 w-4" />
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'sync'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <RefreshCw className="mr-2 inline-block h-4 w-4" />
            Синхронизация
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'audit'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <History className="mr-2 inline-block h-4 w-4" />
            Аудит
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'permissions' && isSuperAdmin && (
          <div className="panel panel-glass mb-8 rounded-2xl p-6">
            <PermissionsManager />
          </div>
        )}

        {activeTab === 'users' && (
          <UsersTab
            session={session}
            isSuperAdmin={isSuperAdmin}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'sync' && <SyncTab onSuccess={handleSuccess} onError={handleError} />}

        {activeTab === 'audit' && <LoginAuditTab onError={handleError} />}
      </main>
    </div>
  )
}
