'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  Globe2,
  Shield,
  Crown,
  FileText,
  MessageSquare,
  Clock,
  UserCircle,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface ProfileData {
  bio: string | null
  phone: string | null
  position: string | null
  department: string | null
  location: string | null
  timezone: string | null
  skills: string[]
  publicEmail: boolean
  publicPhone: boolean
  visibility: 'INTERNAL' | 'PRIVATE'
}

interface UserSummary {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
  lastLoginAt: string | null
  _count: {
    letters: number
    comments: number
    sessions: number
  }
}

const ROLE_LABELS: Record<UserSummary['role'], string> = {
  SUPERADMIN: '\u0421\u0443\u043f\u0435\u0440\u0430\u0434\u043c\u0438\u043d',
  ADMIN: '\u0410\u0434\u043c\u0438\u043d',
  MANAGER: '\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440',
  AUDITOR: '\u0410\u0443\u0434\u0438\u0442\u043e\u0440',
  EMPLOYEE: '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a',
  VIEWER: '\u041d\u0430\u0431\u043b\u044e\u0434\u0430\u0442\u0435\u043b\u044c',
}

const ROLE_BADGE_CLASSES: Record<UserSummary['role'], string> = {
  SUPERADMIN:
    'bg-gradient-to-r from-yellow-500/30 via-amber-400/30 to-yellow-600/30 text-yellow-100 border border-yellow-400/40 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  ADMIN: 'bg-amber-500/20 text-amber-400',
  MANAGER: 'bg-blue-500/20 text-blue-400',
  AUDITOR: 'bg-purple-500/20 text-purple-400',
  EMPLOYEE: 'bg-emerald-500/20 text-emerald-400',
  VIEWER: 'bg-slate-500/20 text-slate-400',
}

export default function UserProfilePage() {
  const { data: session, status: authStatus } = useSession()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserSummary | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const skills = useMemo(() => profile?.skills || [], [profile])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    const loadProfile = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/users/${params.id}/profile`)
        if (res.status === 403) {
          setError('\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0437\u0430\u043a\u0440\u044b\u0442')
          return
        }
        if (!res.ok) {
          throw new Error('Failed to load profile')
        }
        const data = await res.json()
        setUser(data.user)
        setProfile(data.profile)
      } catch (err) {
        console.error('Failed to load profile:', err)
        setError('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c')
        toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [authStatus, params.id])

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen app-shell">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pageIn">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">
            {'\u041f\u0440\u043e\u0444\u0438\u043b\u044c'}
          </h1>
          <p className="text-muted text-sm mt-2">
            {user?.name || user?.email || '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'}
          </p>
        </div>

        {error ? (
          <div className="panel panel-glass rounded-2xl p-6 flex items-center gap-3 text-gray-300">
            <Info className="w-5 h-5 text-amber-400" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="panel panel-glass rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || user.email || 'User'}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div>
                  <div className="text-lg font-semibold text-white">
                    {user?.name || '\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438'}
                  </div>
                  {user?.email && (
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {user && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${ROLE_BADGE_CLASSES[user.role]}`}
                >
                  {user.role === 'SUPERADMIN' ? (
                    <Crown className="w-3 h-3 text-yellow-200" />
                  ) : (
                    <Shield className="w-3 h-3" />
                  )}
                  {ROLE_LABELS[user.role]}
                </span>
              )}

              {user && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                    <FileText className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                    <div className="text-white">{user._count.letters}</div>
                    <div className="text-gray-500">{'\u041f\u0438\u0441\u044c\u043c\u0430'}</div>
                  </div>
                  <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                    <MessageSquare className="w-4 h-4 text-blue-300 mx-auto mb-1" />
                    <div className="text-white">{user._count.comments}</div>
                    <div className="text-gray-500">{'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u044b'}</div>
                  </div>
                  <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                    <Clock className="w-4 h-4 text-amber-300 mx-auto mb-1" />
                    <div className="text-white">{user._count.sessions}</div>
                    <div className="text-gray-500">{'\u0421\u0435\u0441\u0441\u0438\u0438'}</div>
                  </div>
                </div>
              )}

              {user && (
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434:'} {formatDate(user.lastLoginAt)}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 panel panel-glass rounded-2xl p-6 space-y-6">
              {profile?.bio && (
                <div>
                  <div className="text-sm text-gray-300 mb-2">
                    {'\u041e \u0441\u0435\u0431\u0435'}
                  </div>
                  <div className="panel-soft panel-glass rounded-xl p-4 text-sm text-slate-200 whitespace-pre-wrap">
                    {profile.bio}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {profile?.position && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c'}</div>
                      <div className="text-sm text-white">{profile.position}</div>
                    </div>
                  </div>
                )}
                {profile?.department && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u041e\u0442\u0434\u0435\u043b'}</div>
                      <div className="text-sm text-white">{profile.department}</div>
                    </div>
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u041b\u043e\u043a\u0430\u0446\u0438\u044f'}</div>
                      <div className="text-sm text-white">{profile.location}</div>
                    </div>
                  </div>
                )}
                {profile?.timezone && (
                  <div className="flex items-start gap-3">
                    <Globe2 className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u0427\u0430\u0441\u043e\u0432\u043e\u0439 \u043f\u043e\u044f\u0441'}</div>
                      <div className="text-sm text-white">{profile.timezone}</div>
                    </div>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u0422\u0435\u043b\u0435\u0444\u043e\u043d'}</div>
                      <div className="text-sm text-white">{profile.phone}</div>
                    </div>
                  </div>
                )}
                {user?.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">Email</div>
                      <div className="text-sm text-white">{user.email}</div>
                    </div>
                  </div>
                )}
              </div>

              {skills.length > 0 && (
                <div>
                  <div className="text-sm text-gray-300 mb-2">
                    {'\u041d\u0430\u0432\u044b\u043a\u0438'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 rounded-full text-xs bg-white/10 border border-white/10 text-slate-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
