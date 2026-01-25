'use client'

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
import { useIsMobileOrTablet } from '@/hooks/useMediaQuery'
import dynamic from 'next/dynamic'
import { SettingsToggle } from '@/components/settings/SettingsToggle'
import { ScrollIndicator } from '@/components/mobile/ScrollIndicator'
import { MobileTabs } from '@/components/mobile/MobileTabs'

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
const MobileNotificationsTab = dynamic(
  () =>
    import('@/components/settings/MobileNotificationsTab').then((mod) => ({
      default: mod.MobileNotificationsTab,
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
  const isMobile = useIsMobileOrTablet()

  const [newYearVibe, setNewYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
  const [bannerDismissed, setBannerDismissed] = useLocalStorage<boolean>(
    'new-year-banner-dismissed',
    false
  )

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

  const handleNewYearVibeToggle = (enabled: boolean) => {
    setNewYearVibe(enabled)
    if (enabled && bannerDismissed) {
      setBannerDismissed(false)
    }
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

  // Mobile tabs configuration
  const mobileTabs = [
    ...(isSuperAdmin
      ? [
          {
            value: 'permissions' as TabType,
            label: 'Роли',
            icon: <Shield className="h-5 w-5" />,
          },
        ]
      : []),
    {
      value: 'users' as TabType,
      label: 'Пользователи',
      icon: <Users className="h-5 w-5" />,
    },
    {
      value: 'sync' as TabType,
      label: 'Синхр.',
      icon: <RefreshCw className="h-5 w-5" />,
    },
    {
      value: 'audit' as TabType,
      label: 'Аудит',
      icon: <History className="h-5 w-5" />,
    },
    {
      value: 'notifications' as TabType,
      label: 'Уведомления',
      icon: <Bell className="h-5 w-5" />,
    },
    {
      value: 'personalization' as TabType,
      label: 'Тема',
      icon: <Palette className="h-5 w-5" />,
    },
    {
      value: 'workflow' as TabType,
      label: 'Процесс',
      icon: <Settings className="h-5 w-5" />,
    },
  ]
  const handleMobileTabChange = (tab: string) => {
    handleTabChange(tab as TabType)
  }

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="animate-pageIn relative mx-auto max-w-[1600px] px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        {/* Header with gradient */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 p-6 md:p-8">
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-teal-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3 shadow-lg shadow-purple-500/25">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                  Настройки
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Роли, доступ, уведомления и журнал безопасности
                </p>
              </div>
            </div>

            {/* New Year Vibe Toggle - compact */}
            <div className="flex items-center gap-3 rounded-xl bg-slate-700/40 px-4 py-3">
              <Crown className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-medium text-white">Новогодний вайб</span>
              <button
                onClick={() => handleNewYearVibeToggle(!newYearVibe)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  newYearVibe ? 'bg-amber-500' : 'bg-slate-600'
                }`}
                role="switch"
                aria-checked={newYearVibe}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    newYearVibe ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs - Mobile vs Desktop */}
        {isMobile ? (
          <div className="mb-6">
            <MobileTabs tabs={mobileTabs} activeTab={activeTab} onChange={handleMobileTabChange} />
          </div>
        ) : (
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/60 p-2">
            <ScrollIndicator className="no-scrollbar flex gap-1 md:flex-wrap" showArrows={true}>
              {isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('permissions')}
                  className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === 'permissions'
                      ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 shadow-lg shadow-red-500/10 ring-1 ring-red-500/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div
                    className={`rounded-lg p-1.5 ${activeTab === 'permissions' ? 'bg-red-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                  >
                    <Shield className="h-4 w-4" />
                  </div>
                  Разрешения
                </button>
              )}
              <button
                onClick={() => handleTabChange('users')}
                className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === 'users'
                    ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 ${activeTab === 'users' ? 'bg-blue-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                >
                  <Users className="h-4 w-4" />
                </div>
                Пользователи
              </button>
              <button
                onClick={() => handleTabChange('sync')}
                className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === 'sync'
                    ? 'bg-gradient-to-r from-teal-500/20 to-teal-600/20 text-teal-300 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 ${activeTab === 'sync' ? 'bg-teal-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                >
                  <RefreshCw className="h-4 w-4" />
                </div>
                Синхронизация
              </button>
              <button
                onClick={() => handleTabChange('audit')}
                className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === 'audit'
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 ${activeTab === 'audit' ? 'bg-amber-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                >
                  <History className="h-4 w-4" />
                </div>
                Аудит
              </button>
              <button
                onClick={() => handleTabChange('notifications')}
                className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === 'notifications'
                    ? 'bg-gradient-to-r from-pink-500/20 to-pink-600/20 text-pink-300 shadow-lg shadow-pink-500/10 ring-1 ring-pink-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 ${activeTab === 'notifications' ? 'bg-pink-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                Уведомления
              </button>
              <button
                onClick={() => handleTabChange('personalization')}
                className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === 'personalization'
                    ? 'bg-gradient-to-r from-violet-500/20 to-violet-600/20 text-violet-300 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 ${activeTab === 'personalization' ? 'bg-violet-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                >
                  <Palette className="h-4 w-4" />
                </div>
                Персонализация
              </button>
              <button
                onClick={() => handleTabChange('workflow')}
                className={`tap-highlight touch-target-sm group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === 'workflow'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-300 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 ${activeTab === 'workflow' ? 'bg-emerald-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}
                >
                  <Settings className="h-4 w-4" />
                </div>
                Рабочий процесс
              </button>
            </ScrollIndicator>
          </div>
        )}

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

        {activeTab === 'notifications' &&
          (isMobile ? <MobileNotificationsTab /> : <NotificationsTab />)}

        {activeTab === 'personalization' && <PersonalizationTab />}

        {activeTab === 'workflow' && <WorkflowTab />}
      </main>
    </div>
  )
}
