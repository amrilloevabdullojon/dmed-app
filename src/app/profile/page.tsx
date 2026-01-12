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
  SUPERADMIN: 'Суперадмин',
  ADMIN: 'Админ',
  MANAGER: 'Менеджер',
  AUDITOR: 'Аудитор',
  EMPLOYEE: 'Сотрудник',
  VIEWER: 'Наблюдатель',
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
      toast.success('Профиль обновлен')
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('Не удалось сохранить профиль')
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
      toast.success(type === 'avatar' ? 'Аватар обновлён' : 'Обложка обновлена')
    } catch (error) {
      console.error('Failed to upload asset:', error)
      toast.error('Не удалось загрузить файл')
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
      toast.success('Ссылка обновлена')
    } catch (error) {
      console.error('Failed to rotate token:', error)
      toast.error('Не удалось обновить ссылку')
    }
  }

  const handleCopyLink = async () => {
    if (!publicProfileUrl) return
    try {
      await navigator.clipboard.writeText(publicProfileUrl)
      toast.success('Ссылка скопирована')
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error('Не удалось скопировать')
    }
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
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
    <div className="app-shell min-h-screen">
      <Header />

      <main className="animate-pageIn mx-auto max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 sm:pb-8 sm:pt-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">
              {'\Ð\Ñ\Ð¾\Ñ\Ð¸\Ð»\Ñ'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {'Обновите данные и настройте видимость для коллег.'}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary hidden items-center justify-center gap-2 rounded-lg px-4 py-2 text-white disabled:opacity-60 sm:inline-flex"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {'\Ð¡\Ð¾\Ñ\Ñ\Ð°\Ð½\Ð¸\Ñ\Ñ'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="panel panel-glass space-y-6 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              {displayAvatar ? (
                <Image
                  src={displayAvatar}
                  alt={user.name || user.email || 'User'}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <UserCircle className="h-8 w-8 text-slate-300" />
                </div>
              )}
              <div>
                <div className="text-lg font-semibold text-white">{user.name || 'Без имени'}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{user.email || '-'}</span>
                </div>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${ROLE_BADGE_CLASSES[user.role]}`}
            >
              {user.role === 'SUPERADMIN' ? (
                <Crown className="h-3 w-3 text-yellow-200" />
              ) : (
                <Shield className="h-3 w-3" />
              )}
              {ROLE_LABELS[user.role]}
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                <FileText className="mx-auto mb-1 h-4 w-4 text-emerald-300" />
                <div className="text-white">{user._count.letters}</div>
                <div className="text-gray-500">{'\Ð\Ð¸\Ñ\Ñ\Ð¼\Ð°'}</div>
              </div>
              <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                <MessageSquare className="mx-auto mb-1 h-4 w-4 text-blue-300" />
                <div className="text-white">{user._count.comments}</div>
                <div className="text-gray-500">{'\Ð\Ð¾\Ð¼\Ð¼\Ðµ\Ð½\Ñ\Ñ'}</div>
              </div>
              <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                <Clock className="mx-auto mb-1 h-4 w-4 text-amber-300" />
                <div className="text-white">{user._count.sessions}</div>
                <div className="text-gray-500">{'\Ð¡\Ðµ\Ñ\Ñ\Ð¸\Ð¸'}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                {'\Ð\Ñ\Ð¾\Ñ\Ð¼\Ð»\Ðµ\Ð½\Ð¸\Ðµ'}
              </div>
              <div className="h-20 overflow-hidden rounded-xl border border-white/10 bg-white/10">
                {coverUrl ? (
                  <Image
                    src={coverUrl}
                    alt="Cover"
                    width={600}
                    height={160}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                    {'\Ð\Ðµ\Ñ \Ð¾\Ð±\Ð»\Ð¾\Ð¶\Ðº\Ð¸'}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 transition hover:bg-white/10">
                  {avatarUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {'\Ð\Ð²\Ð°\Ñ\Ð°\Ñ'}
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
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 transition hover:bg-white/10">
                  {coverUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {'\Ð\Ð±\Ð»\Ð¾\Ð¶\Ðº\Ð°'}
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

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-4 w-4" />
              {'\Ð\Ð¾\Ñ\Ð»\Ðµ\Ð´\Ð½\Ð¸\Ð¹ \Ð²\Ñ\Ð¾\Ð´:'} {formatDate(user.lastLoginAt)}
            </div>
          </div>

          <div className="panel panel-glass space-y-6 rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <UserCircle className="h-4 w-4 text-emerald-400" />
              {'\Ð\Ñ\Ð½\Ð¾\Ð²\Ð½\Ð¾\Ðµ'}
            </div>
            <textarea
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className={`${fieldBase} min-h-[120px] w-full px-3 py-2`}
              placeholder={'\Ð\Ð¾\Ñ\Ð¾\Ñ\Ðº\Ð¾ \Ð¾ \Ñ\Ðµ\Ð±\Ðµ'}
              aria-label="Bio"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                  <Briefcase className="h-4 w-4 text-emerald-400" />
                  {'\Ð\Ð¾\Ð»\Ð¶\Ð½\Ð¾\Ñ\Ñ\Ñ'}
                </div>
                <input
                  value={profile.position || ''}
                  onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder={'\Ð\Ð¾\Ð»\Ð¶\Ð½\Ð¾\Ñ\Ñ\Ñ'}
                  aria-label="Position"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  {'\Ð\Ñ\Ð´\Ðµ\Ð»'}
                </div>
                <input
                  value={profile.department || ''}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder={'\Ð\Ñ\Ð´\Ðµ\Ð»'}
                  aria-label="Department"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  {'\Ð\Ð¾\Ðº\Ð°\Ñ\Ð¸\Ñ'}
                </div>
                <input
                  value={profile.location || ''}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className={`${fieldBase} w-full px-3 py-2`}
                  placeholder={'\Ð\Ð¾\Ñ\Ð¾\Ð´, \Ñ\Ñ\Ñ\Ð°\Ð½\Ð°'}
                  aria-label="Location"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                  <Globe2 className="h-4 w-4 text-emerald-400" />
                  {'\Ð§\Ð°\Ñ\Ð¾\Ð²\Ð¾\Ð¹ \Ð¿\Ð¾\Ñ\Ñ'}
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
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                  <Phone className="h-4 w-4 text-emerald-400" />
                  {'\Ð¢\Ðµ\Ð»\Ðµ\Ñ\Ð¾\Ð½'}
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
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                  <Mail className="h-4 w-4 text-emerald-400" />
                  {'\Ð\Ñ\Ðº\Ñ\Ñ\Ñ\Ñ\Ð¹ email'}
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
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                <ListChecks className="h-4 w-4 text-emerald-400" />
                {'\Ð\Ð°\Ð²\Ñ\Ðº\Ð¸'}
              </div>
              <input
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className={`${fieldBase} w-full px-3 py-2`}
                placeholder={
                  '\Ð\Ñ\Ð¿\Ð¾\Ð»\Ñ\Ð·\Ñ\Ð¹\Ñ\Ðµ \Ð·\Ð°\Ð¿\Ñ\Ñ\Ñ\Ðµ \Ð´\Ð»\Ñ \Ñ\Ð°\Ð·\Ð´\Ðµ\Ð»\Ðµ\Ð½\Ð¸\Ñ'
                }
                aria-label="Skills"
              />
              {parsedSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-slate-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-soft panel-glass rounded-2xl p-4">
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-300">
                <Eye className="h-4 w-4 text-emerald-400" />
                {'\Ð\Ð¸\Ð´\Ð¸\Ð¼\Ð¾\Ñ\Ñ\Ñ \Ð¿\Ñ\Ð¾\Ñ\Ð¸\Ð»\Ñ'}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <label className="block text-xs text-gray-400">{'\Ð£\Ñ\Ð¾\Ð²\Ðµ\Ð½\Ñ'}</label>
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
                    <option value="INTERNAL">
                      {'\Ð\Ð¸\Ð´\Ð½\Ð¾ \Ð²\Ð½\Ñ\Ñ\Ñ\Ð¸ \Ñ\Ð¸\Ñ\Ñ\Ðµ\Ð¼\Ñ'}
                    </option>
                    <option value="PRIVATE">{'\Ð¢\Ð¾\Ð»\Ñ\Ðº\Ð¾ \Ñ'}</option>
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
                    <Link2 className="h-3.5 w-3.5" />
                    {'\Ð\Ñ\Ð±\Ð»\Ð¸\Ñ\Ð½\Ð°\Ñ \Ñ\Ñ\Ñ\Ð»\Ðº\Ð°'}
                  </label>
                  <p className="text-[11px] text-gray-500">
                    {
                      '\Ð¡\Ñ\Ñ\Ð»\Ðº\Ñ \Ð¼\Ð¾\Ð¶\Ð½\Ð¾ \Ñ\Ð°\Ñ\Ð¿\Ñ\Ð¾\Ñ\Ñ\Ñ\Ð°\Ð½\Ñ\Ñ\Ñ \Ð²\Ð½\Ðµ \Ñ\Ð¸\Ñ\Ñ\Ðµ\Ð¼\Ñ.'
                    }
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-300 sm:grid-cols-2 lg:col-span-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicBio}
                      onChange={(e) => setProfile({ ...profile, publicBio: e.target.checked })}
                      className={controlBase}
                      aria-label="Public bio"
                    />
                    {'\Ð \Ñ\Ðµ\Ð±\Ðµ'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicPosition}
                      onChange={(e) => setProfile({ ...profile, publicPosition: e.target.checked })}
                      className={controlBase}
                      aria-label="Public position"
                    />
                    {'\Ð\Ð¾\Ð»\Ð¶\Ð½\Ð¾\Ñ\Ñ\Ñ'}
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
                    {'\Ð\Ñ\Ð´\Ðµ\Ð»'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicLocation}
                      onChange={(e) => setProfile({ ...profile, publicLocation: e.target.checked })}
                      className={controlBase}
                      aria-label="Public location"
                    />
                    {'\Ð\Ð¾\Ðº\Ð°\Ñ\Ð¸\Ñ'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicTimezone}
                      onChange={(e) => setProfile({ ...profile, publicTimezone: e.target.checked })}
                      className={controlBase}
                      aria-label="Public timezone"
                    />
                    {'\Ð§\Ð°\Ñ\Ð¾\Ð²\Ð¾\Ð¹ \Ð¿\Ð¾\Ñ\Ñ'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicSkills}
                      onChange={(e) => setProfile({ ...profile, publicSkills: e.target.checked })}
                      className={controlBase}
                      aria-label="Public skills"
                    />
                    {'\Ð\Ð°\Ð²\Ñ\Ðº\Ð¸'}
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
                    {'\Ð\Ð¾\Ñ\Ð»\Ðµ\Ð´\Ð½\Ð¸\Ð¹ \Ð²\Ñ\Ð¾\Ð´'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicEmail}
                      onChange={(e) => setProfile({ ...profile, publicEmail: e.target.checked })}
                      className={controlBase}
                      disabled={!user.email}
                      aria-label="Public email"
                    />
                    {'\Ð\Ð¾\Ðº\Ð°\Ð·\Ñ\Ð²\Ð°\Ñ\Ñ email'}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.publicPhone}
                      onChange={(e) => setProfile({ ...profile, publicPhone: e.target.checked })}
                      className={controlBase}
                      aria-label="Public phone"
                    />
                    {'\Ð\Ð¾\Ðº\Ð°\Ð·\Ñ\Ð²\Ð°\Ñ\Ñ \Ñ\Ðµ\Ð»\Ðµ\Ñ\Ð¾\Ð½'}
                  </label>
                </div>
              </div>
              {profile.publicProfileEnabled && (
                <div className="panel-soft panel-glass mt-4 rounded-xl p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                    <Link2 className="h-3.5 w-3.5 text-emerald-400" />
                    {'\Ð¡\Ñ\Ñ\Ð»\Ðº\Ð° \Ð´\Ð»\Ñ \Ð¿\Ñ\Ð¾\Ñ\Ð¼\Ð¾\Ñ\Ñ\Ð°'}
                  </div>
                  {publicProfileUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={publicProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-full truncate text-xs text-emerald-300 transition hover:text-emerald-200"
                      >
                        {publicProfileUrl}
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        <Copy className="h-3 w-3" />
                        {'\Ð\Ð¾\Ð¿\Ð¸\Ñ\Ð¾\Ð²\Ð°\Ñ\Ñ'}
                      </button>
                      <button
                        onClick={handleRotateToken}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {'\Ð\Ð±\Ð½\Ð¾\Ð²\Ð¸\Ñ\Ñ'}
                      </button>
                      <a
                        href={publicProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {'\Ð\Ñ\Ðº\Ñ\Ñ\Ñ\Ñ'}
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      {'\Ð\Ð¾\Ñ\Ñ\Ñ\Ð¿\Ð½\Ð¾ \Ð¿\Ð¾\Ñ\Ð»\Ðµ \Ñ\Ð¾\Ñ\Ñ\Ð°\Ð½\Ðµ\Ð½\Ð¸\Ñ.'}
                    </div>
                  )}
                </div>
              )}
              {profile.visibility === 'PRIVATE' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                  <EyeOff className="h-4 w-4" />
                  {
                    '\Ð\Ñ\Ð¾\Ñ\Ð¸\Ð»\Ñ \Ð²\Ð¸\Ð´\Ðµ\Ð½ \Ñ\Ð¾\Ð»\Ñ\Ðº\Ð¾ \Ð²\Ð°\Ð¼ \Ð¸ \Ð°\Ð´\Ð¼\Ð¸\Ð½\Ð°\Ð¼.'
                  }
                </div>
              )}
            </div>

            <div className="panel-soft panel-glass rounded-2xl p-4">
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-300">
                <Clock className="h-4 w-4 text-emerald-400" />
                {'\Ð\Ðº\Ñ\Ð¸\Ð²\Ð½\Ð¾\Ñ\Ñ\Ñ'}
              </div>
              {activity ? (
                <div className="grid gap-4 text-xs md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-gray-400">{'\Ð\Ð¸\Ñ\Ñ\Ð¼\Ð°'}</div>
                    {activity.letters.length > 0 ? (
                      activity.letters.map((item) => (
                        <Link
                          key={item.id}
                          href={`/letters/${item.id}`}
                          className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 transition hover:bg-white/10"
                        >
                          <div className="font-medium">#{item.number}</div>
                          <div className="truncate text-gray-500">{item.org}</div>
                        </Link>
                      ))
                    ) : (
                      <div className="text-gray-500">{'\Ð\Ðµ\Ñ \Ð¿\Ð¸\Ñ\Ðµ\Ð¼'}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-gray-400">{'\Ð\Ð¾\Ð¼\Ð¼\Ðµ\Ð½\Ñ\Ð°\Ñ\Ð¸\Ð¸'}</div>
                    {activity.comments.length > 0 ? (
                      activity.comments.map((item) => (
                        <Link
                          key={item.id}
                          href={`/letters/${item.letter.id}`}
                          className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 transition hover:bg-white/10"
                        >
                          <div className="font-medium">#{item.letter.number}</div>
                          <div className="truncate text-gray-500">{item.text}</div>
                        </Link>
                      ))
                    ) : (
                      <div className="text-gray-500">
                        {'\Ð\Ðµ\Ñ \Ðº\Ð¾\Ð¼\Ð¼\Ðµ\Ð½\Ñ\Ð°\Ñ\Ð¸\Ðµ\Ð²'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-gray-400">{'\Ð\Ð°\Ð·\Ð½\Ð°\Ñ\Ðµ\Ð½\Ð¸\Ñ'}</div>
                    {activity.assignments.length > 0 ? (
                      activity.assignments.map((item) => (
                        <Link
                          key={item.id}
                          href={`/letters/${item.letter.id}`}
                          className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 transition hover:bg-white/10"
                        >
                          <div className="font-medium">#{item.letter.number}</div>
                          <div className="truncate text-gray-500">{item.letter.org}</div>
                        </Link>
                      ))
                    ) : (
                      <div className="text-gray-500">{'\Ð\Ðµ\Ñ \Ð½\Ð°\Ð·\Ð½\Ð°\Ñ\Ðµ\Ð½\Ð¸\Ð¹'}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">{'\Ð\Ð°\Ð³\Ñ\Ñ\Ð·\Ðº\Ð°...'}</div>
              )}
            </div>
          </div>
        </div>
      </main>
      <div
        className="fixed left-0 right-0 z-[120] border-t border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur sm:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {'\DÂ­\D_\Ä½.\Ä½?\DÅ\DÅ¤\D,\Ä½,\Ä½O'}
        </button>
      </div>
    </div>
  )
}
