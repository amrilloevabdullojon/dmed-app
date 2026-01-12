'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import {
  Loader2,
  Users,
  Shield,
  RefreshCw,
  History,
  Crown,
  Bell,
  Palette,
  Settings,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { hasPermission } from '@/lib/permissions'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import dynamic from 'next/dynamic'
import { SettingsToggle } from '@/components/settings/SettingsToggle'

// Lazy load tab components for better performance
const PermissionsManager = dynamic(
  () =>
    import('@/components/PermissionsManager').then((mod) => ({ default: mod.PermissionsManager })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)
const UsersTab = dynamic(
  () => import('@/components/settings/UsersTab').then((mod) => ({ default: mod.UsersTab })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)
const SyncTab = dynamic(
  () => import('@/components/settings/SyncTab').then((mod) => ({ default: mod.SyncTab })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)
const LoginAuditTab = dynamic(
  () =>
    import('@/components/settings/LoginAuditTab').then((mod) => ({ default: mod.LoginAuditTab })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)
const NotificationsTab = dynamic(
  () =>
    import('@/components/settings/NotificationsTab').then((mod) => ({
      default: mod.NotificationsTab,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)
const PersonalizationTab = dynamic(
  () =>
    import('@/components/settings/PersonalizationTab').then((mod) => ({
      default: mod.PersonalizationTab,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)
const WorkflowTab = dynamic(
  () => import('@/components/settings/WorkflowTab').then((mod) => ({ default: mod.WorkflowTab })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ),
  }
)

type TabType =
  | 'permissions'
  | 'users'
  | 'sync'
  | 'audit'
  | 'notifications'
  | 'personalization'
  | 'workflow'

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const toast = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [newYearVibe, setNewYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)

  // Get active tab from URL, defaulting to 'users'
  const activeTab = (searchParams.get('tab') as TabType) || 'users'

  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'

  // Handle tab changes - update URL when tab is changed
  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

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
        <p className="mb-6 mt-2 text-sm text-muted">
          Роли, доступ, уведомления и журнал безопасности.
        </p>

        {/* New Year Vibe Toggle */}
        <div className="panel panel-glass mb-6 rounded-2xl p-4 sm:p-6">
          <SettingsToggle
            label="Новогодний вайб"
            description="Добавить легкие зимние акценты и нежную подсветку по всему сайту."
            icon={<Crown className="h-4 w-4" />}
            enabled={newYearVibe}
            onToggle={setNewYearVibe}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {isSuperAdmin && (
            <button
              onClick={() => handleTabChange('permissions')}
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
            onClick={() => handleTabChange('users')}
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
            onClick={() => handleTabChange('sync')}
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
            onClick={() => handleTabChange('audit')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'audit'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <History className="mr-2 inline-block h-4 w-4" />
            Аудит
          </button>
          <button
            onClick={() => handleTabChange('notifications')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'notifications'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Bell className="mr-2 inline-block h-4 w-4" />
            Уведомления
          </button>
          <button
            onClick={() => handleTabChange('personalization')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'personalization'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Palette className="mr-2 inline-block h-4 w-4" />
            Персонализация
          </button>
          <button
            onClick={() => handleTabChange('workflow')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'workflow'
                ? 'border border-teal-400/30 bg-teal-500/20 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings className="mr-2 inline-block h-4 w-4" />
            Рабочий процесс
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

        {activeTab === 'notifications' && <NotificationsTab />}

        {activeTab === 'personalization' && <PersonalizationTab />}

        {activeTab === 'workflow' && <WorkflowTab />}
      </main>
    </div>
  )
}
