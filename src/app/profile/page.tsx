'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  Save,
  ListChecks,
  UserCircle,
  Eye,
  EyeOff,
  Upload,
  Link2,
  Copy,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
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

const fieldBase =
  'rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40'
const fieldCompact =
  'rounded-lg border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40'
const controlBase = 'rounded border-white/20 bg-white/5'

const emptyProfile: ProfileData = {
  bio: null,
  phone: null,
  position: null,
  department: null,
  location: null,
  timezone: null,
  skills: [],
  avatarUrl: null,
  coverUrl: null,
  publicEmail: false,
  publicPhone: false,
  publicBio: true,
  publicPosition: true,
  publicDepartment: true,
  publicLocation: true,
  publicTimezone: true,
  publicSkills: true,
  publicLastLogin: false,
  publicProfileEnabled: false,
  publicProfileToken: null,
  visibility: 'INTERNAL',
}

export default function ProfilePage() {
  const toast = useToast()
  const { data: session, status: authStatus, update: updateSession } = useSession()
  useAuthRedirect(authStatus)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [origin, setOrigin] = useState('')
  const [user, setUser] = useState<UserSummary | null>(null)
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [skillsInput, setSkillsInput] = useState('')
  const [activity, setActivity] = useState<ActivityData | null>(null)

  const parsedSkills = useMemo(
    () =>
      skillsInput
        .split(',')
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0),
    [skillsInput]
  )

  const fetchedRef = useRef(false)

  useEffect(() => {
    if (authStatus === 'authenticated' && !fetchedRef.current) {
      fetchedRef.current = true
      setLoading(true)
      fetch('/api/profile')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load profile')
          return res.json()
        })
        .then((data) => {
          setUser(data.user)
          const nextProfile: ProfileData = data.profile || emptyProfile
          setProfile(nextProfile)
          setSkillsInput((nextProfile.skills || []).join(', '))
          setActivity(data.activity || null)
        })
        .catch((error) => {
          console.error('Failed to load profile:', error)
          toast.error('Не удалось загрузить профиль')
        })
        .finally(() => {
          setLoading(false)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const payload: ProfileData = {
        ...profile,
        skills: parsedSkills,
      }
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile')
      }
      const data = await res.json()
      setProfile(data.profile || payload)
      setSkillsInput((data.profile?.skills || payload.skills).join(', '))
      toast.success('\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d')
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c')
    } finally {
      setSaving(false)
    }
  }

  const handleAssetUpload = async (type: 'avatar' | 'cover', file: File) => {
    const setUploading = type === 'avatar' ? setAvatarUploading : setCoverUploading
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      const res = await fetch('/api/profile/assets', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to upload file')
      }
      const data = await res.json()
      setProfile((prev) => ({ ...prev, ...data.profile }))
      if (type === 'avatar' && updateSession) {
        await updateSession({ image: data.profile?.avatarUrl || null })
      }
      toast.success(
        type === 'avatar'
          ? '\u0410\u0432\u0430\u0442\u0430\u0440 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d'
          : '\u041e\u0431\u043b\u043e\u0436\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430'
      )
    } catch (error) {
      console.error('Failed to upload asset:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0444\u0430\u0439\u043b')
    } finally {
      setUploading(false)
    }
  }

  const handleRotateToken = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotatePublicToken: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to rotate token')
      }
      const data = await res.json()
      setProfile((prev) => ({ ...prev, ...data.profile }))
      toast.success('\u0421\u0441\u044b\u043b\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430')
    } catch (error) {
      console.error('Failed to rotate token:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443')
    }
  }

  const handleCopyLink = async () => {
    if (!publicProfileUrl) return
    try {
      await navigator.clipboard.writeText(publicProfileUrl)
      toast.success('\u0421\u0441\u044b\u043b\u043a\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430')
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c')
    }
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !user) {
    return null
  }

  const displayAvatar = profile.avatarUrl || user.image
  const coverUrl = profile.coverUrl
  const publicProfileUrl =
    origin && profile.publicProfileEnabled && profile.publicProfileToken
      ? `${origin}/u/${profile.publicProfileToken}`
      : ''

  return (
    <div className="min-h-screen app-shell">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-pageIn">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">
              {'\u041f\u0440\u043e\u0444\u0438\u043b\u044c'}
            </h1>
            <p className="text-muted text-sm mt-2">
              {'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0438 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u044c \u0434\u043b\u044f \u043a\u043e\u043b\u043b\u0435\u0433.'}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg btn-primary text-white disabled:opacity-60 w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="panel panel-glass rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              {displayAvatar ? (
                <Image
                  src={displayAvatar}
                  alt={user.name || user.email || 'User'}
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
                  {user.name || '\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438'}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{user.email || '-'}</span>
                </div>
              </div>
            </div>

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

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                {'\u041e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0435'}
              </div>
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
              <div className="flex flex-wrap gap-2 text-xs">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition cursor-pointer">
                  {avatarUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {'\u0410\u0432\u0430\u0442\u0430\u0440'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAssetUpload('avatar', file)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition cursor-pointer">
                  {coverUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {'\u041e\u0431\u043b\u043e\u0436\u043a\u0430'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAssetUpload('cover', file)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="text-xs text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434:'} {formatDate(user.lastLoginAt)}
            </div>
          </div>

          <div className="lg:col-span-2 panel panel-glass rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <UserCircle className="w-4 h-4 text-emerald-400" />
              {'\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435'}
            </div>
            <textarea
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className={`${fieldBase} w-full px-3 py-2 min-h-[120px]`}
              placeholder={'\u041a\u043e\u0440\u043e\u0442\u043a\u043e \u043e \u0441\u0435\u0431\u0435'}
              aria-label="Bio"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  {'\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c'}
                </div>
                <input
                  value={profile.position || ''}
                  onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder={'\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c'}
                  aria-label="Position"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  {'\u041e\u0442\u0434\u0435\u043b'}
                </div>
                <input
                  value={profile.department || ''}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder={'\u041e\u0442\u0434\u0435\u043b'}
                  aria-label="Department"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  {'\u041b\u043e\u043a\u0430\u0446\u0438\u044f'}
                </div>
                <input
                  value={profile.location || ''}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder={'\u0413\u043e\u0440\u043e\u0434, \u0441\u0442\u0440\u0430\u043d\u0430'}
                  aria-label="Location"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-emerald-400" />
                  {'\u0427\u0430\u0441\u043e\u0432\u043e\u0439 \u043f\u043e\u044f\u0441'}
                </div>
                <input
                  value={profile.timezone || ''}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder="UTC+5"
                  aria-label="Timezone"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  {'\u0422\u0435\u043b\u0435\u0444\u043e\u043d'}
                </div>
                <input
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder="+998 90 000 00 00"
                  aria-label="Phone"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  {'\u041e\u0442\u043a\u0440\u044b\u0442\u044b\u0439 email'}
                </div>
                <input
                  value={user.email || ''}
                  disabled
                  className={`${fieldBase} w-full px-3 py-2 opacity-70`}
                  aria-label="Email"
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-400" />
                {'\u041d\u0430\u0432\u044b\u043a\u0438'}
              </div>
              <input
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className={`${fieldBase} w-full px-3 py-2`}
                placeholder={'\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0437\u0430\u043f\u044f\u0442\u044b\u0435 \u0434\u043b\u044f \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f'}
                aria-label="Skills"
              />
              {parsedSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {parsedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-1 rounded-full text-xs bg-white/10 border border-white/10 text-slate-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-soft panel-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                <Eye className="w-4 h-4 text-emerald-400" />
                {'\u0412\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044f'}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 block">
                    {'\u0423\u0440\u043e\u0432\u0435\u043d\u044c'}
                  </label>
                  <select
                    value={profile.visibility}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        visibility: e.target.value as ProfileData['visibility'],
                      })
                    }
                    className={`${fieldCompact} w-full px-3 py-2`}
                    aria-label="Profile visibility"
                  >
                    <option value="INTERNAL">{'\u0412\u0438\u0434\u043d\u043e \u0432\u043d\u0443\u0442\u0440\u0438 \u0441\u0438\u0441\u0442\u0435\u043c\u044b'}</option>
                    <option value="PRIVATE">{'\u0422\u043e\u043b\u044c\u043a\u043e \u044f'}</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={profile.publicProfileEnabled}
                      onChange={(e) =>
                        setProfile({ ...profile, publicProfileEnabled: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public profile link"
                    />
                    <Link2 className="w-3.5 h-3.5" />
                    {'\u041f\u0443\u0431\u043b\u0438\u0447\u043d\u0430\u044f \u0441\u0441\u044b\u043b\u043a\u0430'}
                  </label>
                  <p className="text-[11px] text-gray-500">
                    {'\u0421\u0441\u044b\u043b\u043a\u0443 \u043c\u043e\u0436\u043d\u043e \u0440\u0430\u0441\u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u044f\u0442\u044c \u0432\u043d\u0435 \u0441\u0438\u0441\u0442\u0435\u043c\u044b.'}
                  </p>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicBio}
                      onChange={(e) =>
                        setProfile({ ...profile, publicBio: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public bio"
                    />
                    {'\u041e \u0441\u0435\u0431\u0435'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicPosition}
                      onChange={(e) =>
                        setProfile({ ...profile, publicPosition: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public position"
                    />
                    {'\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicDepartment}
                      onChange={(e) =>
                        setProfile({ ...profile, publicDepartment: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public department"
                    />
                    {'\u041e\u0442\u0434\u0435\u043b'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicLocation}
                      onChange={(e) =>
                        setProfile({ ...profile, publicLocation: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public location"
                    />
                    {'\u041b\u043e\u043a\u0430\u0446\u0438\u044f'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicTimezone}
                      onChange={(e) =>
                        setProfile({ ...profile, publicTimezone: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public timezone"
                    />
                    {'\u0427\u0430\u0441\u043e\u0432\u043e\u0439 \u043f\u043e\u044f\u0441'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicSkills}
                      onChange={(e) =>
                        setProfile({ ...profile, publicSkills: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public skills"
                    />
                    {'\u041d\u0430\u0432\u044b\u043a\u0438'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicLastLogin}
                      onChange={(e) =>
                        setProfile({ ...profile, publicLastLogin: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public last login"
                    />
                    {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicEmail}
                      onChange={(e) =>
                        setProfile({ ...profile, publicEmail: e.target.checked })
                      }
                      className={controlBase}
                      disabled={!user.email}
                      aria-label="Public email"
                    />
                    {'\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c email'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicPhone}
                      onChange={(e) =>
                        setProfile({ ...profile, publicPhone: e.target.checked })
                      }
                      className={controlBase}
                      aria-label="Public phone"
                    />
                    {'\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u0442\u0435\u043b\u0435\u0444\u043e\u043d'}
                  </label>
                </div>
              </div>
              {profile.publicProfileEnabled && (
                <div className="mt-4 panel-soft panel-glass rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                    <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                    {'\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430'}
                  </div>
                  {publicProfileUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={publicProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-300 hover:text-emerald-200 transition truncate max-w-full"
                      >
                        {publicProfileUrl}
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10 transition"
                      >
                        <Copy className="w-3 h-3" />
                        {'\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}
                      </button>
                      <button
                        onClick={handleRotateToken}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c'}
                      </button>
                      <a
                        href={publicProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {'\u041e\u0442\u043a\u0440\u044b\u0442\u044c'}
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      {'\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043f\u043e\u0441\u043b\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f.'}
                    </div>
                  )}
                </div>
              )}
              {profile.visibility === 'PRIVATE' && (
                <div className="mt-3 text-xs text-amber-400 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" />
                  {'\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0432\u0438\u0434\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0432\u0430\u043c \u0438 \u0430\u0434\u043c\u0438\u043d\u0430\u043c.'}
                </div>
              )}
            </div>

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
      </main>
    </div>
  )
}
