'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
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
  UserCheck,
  MessageSquarePlus,
  ExternalLink,
  Search,
  X,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

interface ProfileData {
  bio: string | null
  phone: string | null
  position: string | null
  department: string | null
  location: string | null
  timezone: string | null
  skills: string[]
  avatarUrl: string | null
  coverUrl: string | null
  publicEmail: boolean
  publicPhone: boolean
  publicBio: boolean
  publicPosition: boolean
  publicDepartment: boolean
  publicLocation: boolean
  publicTimezone: boolean
  publicSkills: boolean
  publicLastLogin: boolean
  publicProfileEnabled: boolean
  publicProfileToken: string | null
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

interface ActivityLetter {
  id: string
  number: string
  org: string
  status: string
  updatedAt: string
}

interface ActivityComment {
  id: string
  text: string
  createdAt: string
  letter: { id: string; number: string; org: string }
}

interface ActivityAssignment {
  id: string
  createdAt: string
  user: { id: string; name: string | null; email: string | null } | null
  letter: { id: string; number: string; org: string }
}

interface ActivityData {
  letters: ActivityLetter[]
  comments: ActivityComment[]
  assignments: ActivityAssignment[]
}

interface LetterOption {
  id: string
  number: string
  org: string
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
  useAuthRedirect(authStatus)
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserSummary | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionOpen, setActionOpen] = useState<'assign' | 'comment' | null>(null)
  const [actionSearch, setActionSearch] = useState('')
  const [actionLetters, setActionLetters] = useState<LetterOption[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [selectedLetterId, setSelectedLetterId] = useState('')
  const [commentText, setCommentText] = useState('')
  const actionPanelRef = useRef<HTMLDivElement | null>(null)

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
        setActivity(data.activity || null)
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

  useEffect(() => {
    if (!actionOpen) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setActionLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', '10')
        if (actionSearch.trim()) {
          params.set('search', actionSearch.trim())
        }
        const res = await fetch(`/api/letters?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load letters')
        const data = await res.json()
        setActionLetters(data.letters || [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to load letters:', err)
        }
      } finally {
        setActionLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [actionOpen, actionSearch])

  useEffect(() => {
    if (!actionOpen) {
      setActionSearch('')
      setActionLetters([])
      setSelectedLetterId('')
      setCommentText('')
      setActionSubmitting(false)
    }
  }, [actionOpen])

  useEffect(() => {
    if (!actionOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!actionPanelRef.current) return
      const target = event.target as Node
      if (!actionPanelRef.current.contains(target)) {
        setActionOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [actionOpen])

  const handleAssign = async () => {
    if (!selectedLetterId || !user) return
    setActionSubmitting(true)
    try {
      const res = await fetch(`/api/letters/${selectedLetterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'owner', value: user.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign letter')
      }
      toast.success('\u041f\u0438\u0441\u044c\u043c\u043e \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043e')
      setActionOpen(null)
    } catch (error) {
      console.error('Failed to assign letter:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e')
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleComment = async () => {
    if (!selectedLetterId || !commentText.trim()) return
    setActionSubmitting(true)
    try {
      const res = await fetch(`/api/letters/${selectedLetterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send comment')
      }
      toast.success('\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d')
      setActionOpen(null)
    } catch (error) {
      console.error('Failed to send comment:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439')
    } finally {
      setActionSubmitting(false)
    }
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const displayAvatar = profile?.avatarUrl || user?.image
  const coverUrl = profile?.coverUrl

  return (
    <div className="min-h-screen app-shell">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-pageIn">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">
            {'\u041f\u0440\u043e\u0444\u0438\u043b\u044c'}
          </h1>
          <p className="text-muted text-sm mt-2">
            {user?.name || user?.email || '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'}
          </p>
        </div>

        {!error && user && (
          <div
            ref={actionPanelRef}
            className="panel panel-glass rounded-2xl p-4 mb-6 relative z-40 isolate"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/letters?owner=${user.id}`}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition text-sm w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4" />
                {'\u041f\u0438\u0441\u044c\u043c\u0430 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f'}
              </Link>
              <button
                onClick={() =>
                  setActionOpen(actionOpen === 'assign' ? null : 'assign')
                }
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition text-sm w-full sm:w-auto"
              >
                <UserCheck className="w-4 h-4" />
                {'\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e'}
              </button>
              <button
                onClick={() =>
                  setActionOpen(actionOpen === 'comment' ? null : 'comment')
                }
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition text-sm w-full sm:w-auto"
              >
                <MessageSquarePlus className="w-4 h-4" />
                {'\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'}
              </button>
            </div>

            {actionOpen && (
              <div className="absolute left-0 right-0 mt-3 z-[70] md:left-auto md:right-0 md:w-[520px]">
                <div className="panel panel-glass rounded-2xl p-5 border border-white/10 shadow-xl animate-scaleIn origin-top">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold text-white">
                      {actionOpen === 'assign'
                        ? '\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e'
                        : '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'}
                    </div>
                    <button
                      onClick={() => setActionOpen(null)}
                      className="p-2 text-gray-400 hover:text-white transition"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={actionSearch}
                        onChange={(e) => setActionSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
                        placeholder={'\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043d\u043e\u043c\u0435\u0440\u0443 \u0438\u043b\u0438 \u043e\u0440\u0433\u0430\u043d\u0443'}
                        aria-label="Search letters"
                      />
                    </div>
                    <select
                      value={selectedLetterId}
                      onChange={(e) => setSelectedLetterId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
                      aria-label="Select letter"
                    >
                      <option value="">
                        {'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0438\u0441\u044c\u043c\u043e'}
                      </option>
                      {actionLetters.map((letter) => (
                        <option key={letter.id} value={letter.id}>
                          {`#${letter.number} \u2014 ${letter.org}`}
                        </option>
                      ))}
                    </select>
                    {actionLoading && (
                      <div className="text-xs text-gray-500">
                        {'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043f\u0438\u0441\u0435\u043c...'}
                      </div>
                    )}
                    {actionOpen === 'comment' && (
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="w-full min-h-[120px] px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
                        placeholder={'\u0422\u0435\u043a\u0441\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u044f'}
                        aria-label="Comment"
                      />
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setActionOpen(null)}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition text-sm"
                    >
                      {'\u041e\u0442\u043c\u0435\u043d\u0430'}
                    </button>
                    <button
                      onClick={actionOpen === 'assign' ? handleAssign : handleComment}
                      disabled={
                        actionSubmitting ||
                        !selectedLetterId ||
                        (actionOpen === 'comment' && !commentText.trim())
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-white disabled:opacity-60 text-sm"
                    >
                      {actionSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {actionOpen === 'assign'
                        ? '\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c'
                        : '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error ? (
          <div className="panel panel-glass rounded-2xl p-6 flex items-center gap-3 text-gray-300">
            <Info className="w-5 h-5 text-amber-400" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="panel panel-glass rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                {displayAvatar ? (
                  <Image
                    src={displayAvatar}
                    alt={user?.name || user?.email || 'User'}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover"
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

              {user?.lastLoginAt && (
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434:'} {formatDate(user.lastLoginAt)}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs text-gray-400">{'\u041e\u0431\u043b\u043e\u0436\u043a\u0430'}</div>
                <div className="rounded-xl overflow-hidden h-20 bg-white/10 border border-white/10">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt="Cover"
                      width={600}
                      height={160}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                      {'\u041d\u0435\u0442 \u043e\u0431\u043b\u043e\u0436\u043a\u0438'}
                    </div>
                  )}
                </div>
              </div>
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

              <div className="panel-soft panel-glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  {'\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c'}
                </div>
                {activity ? (
                  <div className="grid gap-4 md:grid-cols-3 text-xs">
                    <div className="space-y-2">
                      <div className="text-gray-400">{'\u041f\u0438\u0441\u044c\u043c\u0430'}</div>
                      {activity.letters.length > 0 ? (
                        activity.letters.map((item) => (
                          <Link
                            key={item.id}
                            href={`/letters/${item.id}`}
                            className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10 transition"
                          >
                            <div className="font-medium">#{item.number}</div>
                            <div className="text-gray-500 truncate">{item.org}</div>
                          </Link>
                        ))
                      ) : (
                        <div className="text-gray-500">{'\u041d\u0435\u0442 \u043f\u0438\u0441\u0435\u043c'}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-gray-400">{'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438'}</div>
                      {activity.comments.length > 0 ? (
                        activity.comments.map((item) => (
                          <Link
                            key={item.id}
                            href={`/letters/${item.letter.id}`}
                            className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10 transition"
                          >
                            <div className="font-medium">#{item.letter.number}</div>
                            <div className="text-gray-500 truncate">{item.text}</div>
                          </Link>
                        ))
                      ) : (
                        <div className="text-gray-500">{'\u041d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432'}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-gray-400">{'\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f'}</div>
                      {activity.assignments.length > 0 ? (
                        activity.assignments.map((item) => (
                          <Link
                            key={item.id}
                            href={`/letters/${item.letter.id}`}
                            className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10 transition"
                          >
                            <div className="font-medium">#{item.letter.number}</div>
                            <div className="text-gray-500 truncate">{item.letter.org}</div>
                          </Link>
                        ))
                      ) : (
                        <div className="text-gray-500">{'\u041d\u0435\u0442 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439'}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...'}</div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
