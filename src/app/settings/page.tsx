'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Loader2,
  Users,
  Shield,
  Mail,
  MessageSquare,
  Edit2,
  Trash2,
  Save,
  X,
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Crown,
  ArrowUpFromLine,
  ArrowDownToLine,
  UserPlus,
  Search,
  Bell,
  Lock,
  Unlock,
  ShieldAlert,
  History,
  User as UserIcon,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { hasPermission } from '@/lib/permissions'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
  canLogin: boolean
  telegramChatId: string | null
  notifyEmail: boolean
  notifyTelegram: boolean
  notifySms: boolean
  notifyInApp: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  digestFrequency: 'NONE' | 'DAILY' | 'WEEKLY'
  createdAt: string
  lastLoginAt: string | null
  _count: {
    letters: number
    comments: number
    sessions: number
  }
}

interface SyncLog {
  id: string
  direction: 'TO_SHEETS' | 'FROM_SHEETS'
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  rowsAffected: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

interface UserAuditEntry {
  id: string
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
  actor: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
}

interface AdminApproval {
  id: string
  action: 'DEMOTE_ADMIN' | 'DELETE_ADMIN'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  targetUser: {
    id: string
    name: string | null
    email: string | null
    role: User['role']
  }
  requestedBy: {
    id: string
    name: string | null
    email: string | null
  }
  payload: { newRole?: User['role'] } | null
}

interface LoginAuditEntry {
  id: string
  email: string
  success: boolean
  reason: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string | null
    role: User['role']
  } | null
}

interface LoginAuditDaySummary {
  date: string
  success: number
  failure: number
}

const ROLE_LABELS: Record<User['role'], string> = {
  SUPERADMIN: '\С\у\п\е\р\а\д\м\и\н',
  ADMIN: '\А\д\м\и\н',
  MANAGER: '\М\е\н\е\д\ж\е\р',
  AUDITOR: '\А\у\д\и\т\о\р',
  EMPLOYEE: '\С\о\т\р\у\д\н\и\к',
  VIEWER: '\Н\а\б\л\ю\д\а\т\е\л\ь',
}

const ROLE_BADGE_CLASSES: Record<User['role'], string> = {
  SUPERADMIN:
    'bg-gradient-to-r from-yellow-500/30 via-amber-400/30 to-yellow-600/30 text-yellow-100 border border-yellow-400/40 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  ADMIN: 'bg-amber-500/20 text-amber-400',
  MANAGER: 'bg-blue-500/20 text-blue-400',
  AUDITOR: 'bg-purple-500/20 text-purple-400',
  EMPLOYEE: 'bg-emerald-500/20 text-emerald-400',
  VIEWER: 'bg-slate-500/20 text-slate-400',
}

const ROLE_ORDER: User['role'][] = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']

const ROLE_OPTIONS: Array<{ value: User['role']; label: string }> = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

const DIGEST_LABELS: Record<User['digestFrequency'], string> = {
  NONE: '\Н\е\т',
  DAILY: '\Е\ж\е\д\н\е\в\н\о',
  WEEKLY: '\Е\ж\е\н\е\д\е\л\ь\н\о',
}

const DIGEST_OPTIONS: Array<{ value: User['digestFrequency']; label: string }> = [
  { value: 'NONE', label: DIGEST_LABELS.NONE },
  { value: 'DAILY', label: DIGEST_LABELS.DAILY },
  { value: 'WEEKLY', label: DIGEST_LABELS.WEEKLY },
]

const AUDIT_ACTION_OPTIONS = [
  { value: 'all', label: '\В\с\е \д\е\й\с\т\в\и\я' },
  { value: 'CREATE', label: '\С\о\з\д\а\н\и\е' },
  { value: 'UPDATE', label: '\О\б\н\о\в\л\е\н\и\я' },
  { value: 'ROLE', label: '\Р\о\л\и' },
  { value: 'ACCESS', label: '\Д\о\с\т\у\п' },
  { value: 'DELETE', label: '\У\д\а\л\е\н\и\е' },
]

const AUDIT_FIELD_OPTIONS = [
  { value: 'all', label: '\В\с\е \п\о\л\я' },
  { value: 'name', label: '\И\м\я' },
  { value: 'email', label: 'Email' },
  { value: 'role', label: '\Р\о\л\ь' },
  { value: 'canLogin', label: '\Д\о\с\т\у\п' },
  { value: 'telegramChatId', label: 'Telegram' },
  { value: 'notifyEmail', label: 'Email \у\в\е\д\о\м\л\е\н\и\я' },
  { value: 'notifyTelegram', label: 'Telegram \у\в\е\д\о\м\л\е\н\и\я' },
  { value: 'notifySms', label: 'SMS \у\в\е\д\о\м\л\е\н\и\я' },
  { value: 'notifyInApp', label: '\В\н\у\т\р\и \с\и\с\т\е\м\ы' },
  { value: 'quietHoursStart', label: '\Т\и\х\и\е \ч\а\с\ы (\с)' },
  { value: 'quietHoursEnd', label: '\Т\и\х\и\е \ч\а\с\ы (\д\о)' },
  { value: 'digestFrequency', label: '\Д\а\й\д\ж\е\с\т' },
]

const AUDIT_ACTION_BADGES: Record<string, { label: string; className: string }> = {
  CREATE: { label: '\С\о\з\д\а\н\о', className: 'bg-emerald-500/20 text-emerald-300' },
  UPDATE: { label: '\О\б\н\о\в\л\е\н\о', className: 'bg-blue-500/20 text-blue-300' },
  ROLE: { label: '\Р\о\л\ь', className: 'bg-amber-500/20 text-amber-300' },
  ACCESS: { label: '\Д\о\с\т\у\п', className: 'bg-purple-500/20 text-purple-300' },
  DELETE: { label: '\У\д\а\л\е\н\о', className: 'bg-red-500/20 text-red-300' },
}

const LOGIN_STATUS_OPTIONS = [
  { value: 'all', label: '\В\с\е \п\о\п\ы\т\к\и' },
  { value: 'success', label: '\У\с\п\е\ш\н\ы\е' },
  { value: 'failure', label: '\О\ш\и\б\к\и' },
]

const INACTIVE_WARNING_DAYS = 7
const fieldBase =
  'rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40'
const fieldCompact =
  'rounded-lg border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40'
const controlBase = 'rounded border-white/20 bg-white/5'

export default function SettingsPage() {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const router = useRouter()
  const isSuperAdmin = session?.user.role === 'SUPERADMIN'
  const [users, setUsers] = useState<User[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    name: string
    email: string
    role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
    telegramChatId: string
    canLogin: boolean
    notifyEmail: boolean
    notifyTelegram: boolean
    notifySms: boolean
    notifyInApp: boolean
    quietHoursStart: string
    quietHoursEnd: string
    digestFrequency: 'NONE' | 'DAILY' | 'WEEKLY'
  }>({
    name: '',
    email: '',
    role: 'EMPLOYEE',
    telegramChatId: '',
    canLogin: true,
    notifyEmail: true,
    notifyTelegram: false,
    notifySms: false,
    notifyInApp: true,
    quietHoursStart: '',
    quietHoursEnd: '',
    digestFrequency: 'NONE',
  })
  const [createData, setCreateData] = useState<{
    name: string
    email: string
    role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
    telegramChatId: string
  }>({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editSnapshot, setEditSnapshot] = useState<{
    name: string
    email: string
    role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
    telegramChatId: string
    canLogin: boolean
    notifyEmail: boolean
    notifyTelegram: boolean
    notifySms: boolean
    notifyInApp: boolean
    quietHoursStart: string
    quietHoursEnd: string
    digestFrequency: 'NONE' | 'DAILY' | 'WEEKLY'
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'>('all')
  const [accessFilter, setAccessFilter] = useState<'all' | 'active' | 'invited' | 'blocked'>('all')
  const [telegramFilter, setTelegramFilter] = useState<'all' | 'has' | 'none'>('all')
  const [emailFilter, setEmailFilter] = useState<'all' | 'has' | 'none'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'role' | 'canLogin' | 'delete' | ''>('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [auditOpenId, setAuditOpenId] = useState<string | null>(null)
  const [auditByUser, setAuditByUser] = useState<Record<string, UserAuditEntry[]>>({})
  const [auditLoading, setAuditLoading] = useState<Record<string, boolean>>({})
  const [auditCursorByUser, setAuditCursorByUser] = useState<Record<string, string | null>>({})
  const [auditFilters, setAuditFilters] = useState({
    action: 'all',
    field: 'all',
    query: '',
    actor: '',
  })
  const [auditFiltersDebounced, setAuditFiltersDebounced] = useState(auditFilters)
  const auditRequestCounter = useRef(0)
  const auditRequestByUser = useRef<Record<string, number>>({})
  const [approvals, setApprovals] = useState<AdminApproval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)
  const [loginAudits, setLoginAudits] = useState<LoginAuditEntry[]>([])
  const [loginAuditCursor, setLoginAuditCursor] = useState<string | null>(null)
  const [loginAuditLoading, setLoginAuditLoading] = useState(false)
  const [loginAuditStatus, setLoginAuditStatus] = useState<'all' | 'success' | 'failure'>('all')
  const [loginAuditQuery, setLoginAuditQuery] = useState('')
  const [loginAuditSummary, setLoginAuditSummary] = useState<LoginAuditDaySummary[]>([])

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSyncLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/sync')
      if (res.ok) {
        const data = await res.json()
        setSyncLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to load sync logs:', error)
    }
  }, [])

  const loadApprovals = useCallback(async () => {
    if (!isSuperAdmin) {
      setApprovals([])
      setApprovalsLoading(false)
      return
    }
    setApprovalsLoading(true)
    try {
      const res = await fetch('/api/users/approvals')
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.approvals || [])
      }
    } catch (error) {
      console.error('Failed to load approvals:', error)
    } finally {
      setApprovalsLoading(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAuditFiltersDebounced(auditFilters)
    }, 300)
    return () => clearTimeout(timer)
  }, [auditFilters])

  const handleApproval = useCallback(async (approvalId: string, action: 'approve' | 'reject') => {
    setApprovalActionId(approvalId)
    try {
      const res = await fetch(`/api/users/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '\Н\е \у\д\а\л\о\с\ь \о\б\р\а\б\о\т\а\т\ь \з\а\п\р\о\с')
        return
      }

      toast.success(
        action === 'approve'
          ? '\З\а\п\р\о\с \п\о\д\т\в\е\р\ж\д\е\н'
          : '\З\а\п\р\о\с \о\т\к\л\о\н\е\н'
      )
      await loadApprovals()
      await loadUsers()
    } catch (error) {
      console.error('Failed to update approval:', error)
      toast.error('\О\ш\и\б\к\а \о\б\р\а\б\о\т\к\и \з\а\п\р\о\с\а')
    } finally {
      setApprovalActionId(null)
    }
  }, [loadApprovals, loadUsers, toast])

  const buildLoginAuditUrl = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams()
    if (loginAuditStatus !== 'all') {
      params.set('status', loginAuditStatus)
    }
    if (loginAuditQuery.trim()) {
      params.set('q', loginAuditQuery.trim())
    }
    if (cursor) {
      params.set('cursor', cursor)
    }
    params.set('take', '20')
    return `/api/security/logins?${params.toString()}`
  }, [loginAuditStatus, loginAuditQuery])

  const loadLoginAudits = useCallback(async (mode: 'replace' | 'more' = 'replace') => {
    setLoginAuditLoading(true)
    try {
      const cursor = mode === 'more' ? loginAuditCursor : null
      const res = await fetch(buildLoginAuditUrl(cursor))
      if (res.ok) {
        const data = await res.json()
        setLoginAudits((prev) => mode === 'more' ? [...prev, ...(data.events || [])] : (data.events || []))
        setLoginAuditCursor(data.nextCursor || null)
        setLoginAuditSummary(data.summary || [])
      }
    } catch (error) {
      console.error('Failed to load login audits:', error)
    } finally {
      setLoginAuditLoading(false)
    }
  }, [buildLoginAuditUrl, loginAuditCursor])

  useEffect(() => {
    if (authStatus === 'authenticated') {
      if (!hasPermission(session?.user.role, 'MANAGE_USERS')) {
        router.push('/letters')
      } else {
        loadUsers()
        loadSyncLogs()
        loadApprovals()
        loadLoginAudits()
      }
    }
  }, [authStatus, session, router, loadUsers, loadSyncLogs, loadApprovals, loadLoginAudits])

  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = new Set(users.map((user) => user.id))
      return new Set(Array.from(prev).filter((id) => ids.has(id)))
    })
  }, [users])

  useEffect(() => {
    if (!isSuperAdmin) {
      if (createData.role !== 'EMPLOYEE') {
        setCreateData((prev) => ({ ...prev, role: 'EMPLOYEE' }))
      }
      if (bulkAction === 'role') {
        setBulkAction('')
        setBulkValue('')
      }
    }
  }, [isSuperAdmin, createData.role, bulkAction])

  const startEdit = (user: User) => {
    setEditingId(user.id)
    const snapshot = {
      name: user.name || '',
      email: user.email || '',
      role: user.role,
      telegramChatId: user.telegramChatId || '',
      canLogin: user.canLogin,
      notifyEmail: user.notifyEmail,
      notifyTelegram: user.notifyTelegram,
      notifySms: user.notifySms,
      notifyInApp: user.notifyInApp,
      quietHoursStart: user.quietHoursStart || '',
      quietHoursEnd: user.quietHoursEnd || '',
      digestFrequency: user.digestFrequency,
    }
    setEditData(snapshot)
    setEditSnapshot(snapshot)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({
      name: '',
      email: '',
      role: 'EMPLOYEE',
      telegramChatId: '',
      canLogin: true,
      notifyEmail: true,
      notifyTelegram: false,
      notifySms: false,
      notifyInApp: true,
      quietHoursStart: '',
      quietHoursEnd: '',
      digestFrequency: 'NONE',
    })
    setEditSnapshot(null)
  }

  const getEditPayload = useCallback(() => {
    if (!editSnapshot) return null

    const payload: Partial<{
      name: string
      role: User['role']
      telegramChatId: string | null
      canLogin: boolean
      notifyEmail: boolean
      notifyTelegram: boolean
      notifySms: boolean
      notifyInApp: boolean
      quietHoursStart: string | null
      quietHoursEnd: string | null
      digestFrequency: User['digestFrequency']
    }> = {}

    const normalizedName = editData.name.trim()
    if (editData.name !== editSnapshot.name && normalizedName) {
      payload.name = normalizedName
    }

    if (editData.role !== editSnapshot.role) {
      payload.role = editData.role
    }

    if (editData.telegramChatId !== editSnapshot.telegramChatId) {
      const normalizedTelegram = editData.telegramChatId.trim()
      payload.telegramChatId = normalizedTelegram ? normalizedTelegram : null
    }

    if (editData.canLogin !== editSnapshot.canLogin) {
      payload.canLogin = editData.canLogin
    }

    if (editData.notifyEmail !== editSnapshot.notifyEmail) {
      payload.notifyEmail = editData.notifyEmail
    }

    if (editData.notifyTelegram !== editSnapshot.notifyTelegram) {
      payload.notifyTelegram = editData.notifyTelegram
    }

    if (editData.notifySms !== editSnapshot.notifySms) {
      payload.notifySms = editData.notifySms
    }

    if (editData.notifyInApp !== editSnapshot.notifyInApp) {
      payload.notifyInApp = editData.notifyInApp
    }

    if (editData.quietHoursStart !== editSnapshot.quietHoursStart) {
      const normalizedStart = editData.quietHoursStart.trim()
      payload.quietHoursStart = normalizedStart ? normalizedStart : null
    }

    if (editData.quietHoursEnd !== editSnapshot.quietHoursEnd) {
      const normalizedEnd = editData.quietHoursEnd.trim()
      payload.quietHoursEnd = normalizedEnd ? normalizedEnd : null
    }

    if (editData.digestFrequency !== editSnapshot.digestFrequency) {
      payload.digestFrequency = editData.digestFrequency
    }

    return payload
  }, [editData, editSnapshot])

  const saveUser = useCallback(async (mode: 'auto' | 'manual' = 'manual') => {
    if (!editingId || !editSnapshot) return

    const payload = getEditPayload()
    if (!payload || Object.keys(payload).length === 0) {
      if (mode === 'manual') {
        toastRef.current.error('Проверьте поля перед сохранением')
      }
      return
    }

    const toastId = `user-save-${editingId}`
    if (mode === 'auto') {
      toastRef.current.loading('Сохранение...', { id: toastId })
    }

    setSavingId(editingId)
    try {
      const res = await fetch(`/api/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        const updated = data.user || {}
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingId ? { ...user, ...updated } : user
          )
        )
        const nextSnapshot = {
          name: updated.name ?? editData.name,
          email: updated.email ?? editData.email,
          role: updated.role ?? editData.role,
          telegramChatId: updated.telegramChatId ?? editData.telegramChatId,
          canLogin: updated.canLogin ?? editData.canLogin,
          notifyEmail: updated.notifyEmail ?? editData.notifyEmail,
          notifyTelegram: updated.notifyTelegram ?? editData.notifyTelegram,
          notifySms: updated.notifySms ?? editData.notifySms,
          notifyInApp: updated.notifyInApp ?? editData.notifyInApp,
          quietHoursStart: updated.quietHoursStart ?? editData.quietHoursStart,
          quietHoursEnd: updated.quietHoursEnd ?? editData.quietHoursEnd,
          digestFrequency: updated.digestFrequency ?? editData.digestFrequency,
        }
        if (data.requiresApproval) {
          nextSnapshot.role = editData.role
        }
        setEditSnapshot(nextSnapshot)
        if (data.requiresApproval) {
          toastRef.current.message('Нужно второе подтверждение админа', { id: toastId })
          loadApprovals()
        } else {
          toastRef.current.success(
            mode === 'auto' ? 'Автосохранено' : 'Изменения сохранены',
            { id: toastId }
          )
        }
      } else {
        const data = await res.json().catch(() => ({}))
        toastRef.current.error(data.error || 'Не удалось сохранить', { id: toastId })
      }
    } catch (error) {
      console.error('Failed to save user:', error)
      toastRef.current.error('Ошибка сохранения', { id: toastId })
    } finally {
      setSavingId(null)
    }
  }, [editData, editSnapshot, editingId, getEditPayload, loadApprovals])

  const hasEditChanges =
    !!editingId &&
    !!editSnapshot &&
    (editData.name !== editSnapshot.name ||
      editData.email !== editSnapshot.email ||
      editData.role !== editSnapshot.role ||
      editData.telegramChatId !== editSnapshot.telegramChatId ||
      editData.canLogin !== editSnapshot.canLogin ||
      editData.notifyEmail !== editSnapshot.notifyEmail ||
      editData.notifyTelegram !== editSnapshot.notifyTelegram ||
      editData.notifySms !== editSnapshot.notifySms ||
      editData.notifyInApp !== editSnapshot.notifyInApp ||
      editData.quietHoursStart !== editSnapshot.quietHoursStart ||
      editData.quietHoursEnd !== editSnapshot.quietHoursEnd ||
      editData.digestFrequency !== editSnapshot.digestFrequency)

  useEffect(() => {
    if (!editingId || !editSnapshot || !hasEditChanges) return
    if (savingId === editingId) return
    const payload = getEditPayload()
    if (!payload || Object.keys(payload).length === 0) return
    const timer = setTimeout(() => {
      saveUser('auto')
    }, 700)
    return () => clearTimeout(timer)
  }, [editingId, editSnapshot, hasEditChanges, getEditPayload, saveUser, savingId])

  const createUser = async () => {
    if (!createData.email.trim()) {
      toast.error('\У\к\а\ж\и\т\е email \д\л\я \в\х\о\д\а \ч\е\р\е\з Google')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData),
      })

      if (res.ok) {
        toast.success('\П\о\л\ь\з\о\в\а\т\е\л\ь \д\о\б\а\в\л\е\н')
        setCreateData({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
        await loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || '\Н\е \у\д\а\л\о\с\ь \д\о\б\а\в\и\т\ь \п\о\л\ь\з\о\в\а\т\е\л\я')
      }
    } catch (error) {
      console.error('Failed to create user:', error)
      toast.error('\О\ш\и\б\к\а \п\р\и \д\о\б\а\в\л\е\н\и\и \п\о\л\ь\з\о\в\а\т\е\л\я')
    } finally {
      setCreating(false)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('\У\д\а\л\и\т\ь \п\о\л\ь\з\о\в\а\т\е\л\я? \Э\т\о \д\е\й\с\т\в\и\е \н\е\л\ь\з\я \о\т\м\е\н\и\т\ь.')) {
      return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.requiresApproval) {
          toast.message('\Н\у\ж\н\о \в\т\о\р\о\е \п\о\д\т\в\е\р\ж\д\е\н\и\е \а\д\м\и\н\а')
          await loadApprovals()
          return
        }
        toast.success('\П\о\л\ь\з\о\в\а\т\е\л\ь \у\д\а\л\е\н')
        await loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || '\О\ш\и\б\к\а \у\д\а\л\е\н\и\я')
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.error('\О\ш\и\б\к\а \у\д\а\л\е\н\и\я')
    }
  }

  const toggleUserAccess = async (user: User) => {
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      toast.error('\Н\е\л\ь\з\я \о\т\к\л\ю\ч\и\т\ь \а\д\м\и\н\а')
      return
    }

    const nextAccess = !user.canLogin
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canLogin: nextAccess }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '\Н\е \у\д\а\л\о\с\ь \и\з\м\е\н\и\т\ь \д\о\с\т\у\п')
        return
      }

      if (data.user) {
        setUsers((prev) =>
          prev.map((item) => (item.id === user.id ? { ...item, ...data.user } : item))
        )
      }

      if (data.requiresApproval) {
        toast.message('\Н\у\ж\н\о \в\т\о\р\о\е \п\о\д\т\в\е\р\ж\д\е\н\и\е \а\д\м\и\н\а')
        await loadApprovals()
        return
      }

      toast.success(
        nextAccess
          ? '\Д\о\с\т\у\п \о\т\к\р\ы\т'
          : '\Д\о\с\т\у\п \з\а\к\р\ы\т'
      )
    } catch (error) {
      console.error('Failed to toggle access:', error)
      toast.error('\О\ш\и\б\к\а \о\б\н\о\в\л\е\н\и\я \д\о\с\т\у\п\а')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatRoleLabel = (role: string | null) => {
    if (!role) return '-'
    return ROLE_LABELS[role as User['role']] || role
  }

  const formatBooleanLabel = (value: string | null) => {
    if (value === null) return '-'
    return value === 'true'
      ? '\В\к\л\ю\ч\е\н\о'
      : '\В\ы\к\л\ю\ч\е\н\о'
  }

  const formatAuditValue = (field: string | null, value: string | null) => {
    if (!value) return '-'
    if (field === 'role') return formatRoleLabel(value)
    if (field === 'canLogin') {
      return value === 'true'
        ? '\О\т\к\р\ы\т'
        : '\З\а\к\р\ы\т'
    }
    if (field === 'digestFrequency') {
      return DIGEST_LABELS[value as User['digestFrequency']] || value
    }
    if (
      field === 'notifyEmail' ||
      field === 'notifyTelegram' ||
      field === 'notifySms' ||
      field === 'notifyInApp'
    ) {
      return formatBooleanLabel(value)
    }
    return value
  }

  const getAuditSummary = (entry: UserAuditEntry) => {
    if (entry.action === 'CREATE') {
      return '\С\о\з\д\а\н \п\о\л\ь\з\о\в\а\т\е\л\ь'
    }
    if (entry.action === 'DELETE') {
      return '\П\о\л\ь\з\о\в\а\т\е\л\ь \у\д\а\л\е\н'
    }
    if (entry.action === 'ROLE') {
      return '\С\м\е\н\а \р\о\л\и'
    }
    if (entry.action === 'ACCESS') {
      return '\Д\о\с\т\у\п \к \с\и\с\т\е\м\е'
    }

    const fieldLabels: Record<string, string> = {
      name: '\И\м\я',
      email: 'Email',
      role: '\Р\о\л\ь',
      canLogin: '\Д\о\с\т\у\п',
      telegramChatId: 'Telegram',
      notifyEmail: 'Email \у\в\е\д\о\м\л\е\н\и\я',
      notifyTelegram: 'Telegram \у\в\е\д\о\м\л\е\н\и\я',
      notifySms: 'SMS \у\в\е\д\о\м\л\е\н\и\я',
      notifyInApp: '\В\н\у\т\р\и \с\и\с\т\е\м\ы',
      quietHoursStart: '\Т\и\х\и\е \ч\а\с\ы (\с)',
      quietHoursEnd: '\Т\и\х\и\е \ч\а\с\ы (\д\о)',
      digestFrequency: '\Д\а\й\д\ж\е\с\т',
    }
    const label = entry.field ? fieldLabels[entry.field] || entry.field : '\П\о\л\е'
    return `\О\б\н\о\в\л\е\н\о \п\о\л\е: ${label}`
  }

  const formatLoginReason = (reason: string | null) => {
    if (!reason) return '-'
    const labels: Record<string, string> = {
      RATE_LIMIT: '\С\л\и\ш\к\о\м \м\н\о\г\о \п\о\п\ы\т\о\к',
      USER_NOT_FOUND: '\П\о\л\ь\з\о\в\а\т\е\л\ь \н\е \н\а\й\д\е\н',
      ACCESS_BLOCKED: '\Д\о\с\т\у\п \з\а\к\р\ы\т',
    }
    return labels[reason] || reason
  }

  const getLoginStatusBadge = (success: boolean) => {
    return success ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
        <CheckCircle className="w-3 h-3" />
        {'\У\с\п\е\ш\н\о'}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
        <XCircle className="w-3 h-3" />
        {'\О\ш\и\б\к\а'}
      </span>
    )
  }

  const formatSummaryDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    })
  }

  const getInactiveBadge = (user: User) => {
    if (!user.lastLoginAt) return null
    const days = Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
    if (days < INACTIVE_WARNING_DAYS) return null
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-300">
        <Clock className="w-3 h-3" />
        {days} {'\д\н\е\й \б\е\з \в\х\о\д\а'}
      </span>
    )
  }

  const buildAuditUrl = useCallback((userId: string, cursor?: string | null) => {
    const params = new URLSearchParams()
    if (auditFiltersDebounced.action !== 'all') {
      params.set('action', auditFiltersDebounced.action)
    }
    if (auditFiltersDebounced.field !== 'all') {
      params.set('field', auditFiltersDebounced.field)
    }
    if (auditFiltersDebounced.query.trim()) {
      params.set('q', auditFiltersDebounced.query.trim())
    }
    if (auditFiltersDebounced.actor.trim()) {
      params.set('actor', auditFiltersDebounced.actor.trim())
    }
    if (cursor) {
      params.set('cursor', cursor)
    }
    params.set('take', '10')
    return `/api/users/${userId}/audit?${params.toString()}`
  }, [auditFiltersDebounced])

  const loadAudit = useCallback(async (
    userId: string,
    mode: 'replace' | 'more' = 'replace',
    cursor?: string | null
  ) => {
    const requestId = ++auditRequestCounter.current
    auditRequestByUser.current[userId] = requestId
    setAuditLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      const effectiveCursor = mode === 'more' ? cursor : null
      const res = await fetch(buildAuditUrl(userId, effectiveCursor))
      if (res.ok) {
        const data = await res.json()
        if (auditRequestByUser.current[userId] !== requestId) {
          return
        }
        setAuditByUser((prev) => ({
          ...prev,
          [userId]: mode === 'more' ? [...(prev[userId] || []), ...(data.audits || [])] : (data.audits || []),
        }))
        setAuditCursorByUser((prev) => ({ ...prev, [userId]: data.nextCursor || null }))
      }
    } catch (error) {
      console.error('Failed to load user audit:', error)
    } finally {
      if (auditRequestByUser.current[userId] === requestId) {
        setAuditLoading((prev) => ({ ...prev, [userId]: false }))
      }
    }
  }, [buildAuditUrl])

  const toggleAudit = (userId: string) => {
    setAuditOpenId((prev) => (prev === userId ? null : userId))
  }

  useEffect(() => {
    if (auditOpenId) {
      loadAudit(auditOpenId, 'replace')
    }
  }, [auditFiltersDebounced, auditOpenId, loadAudit])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    const timer = setTimeout(() => {
      loadLoginAudits('replace')
    }, 400)
    return () => clearTimeout(timer)
  }, [authStatus, loginAuditStatus, loginAuditQuery, loadLoginAudits])

  const getUserStatus = (user: User) => {
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return 'active'
    if (!user.canLogin) return 'blocked'
    if (user._count.sessions === 0) return 'invited'
    return 'active'
  }

  const getUserStatusBadge = (user: User) => {
    const status = getUserStatus(user)
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
          <CheckCircle className="w-3 h-3" />
          {'\А\к\т\и\в\е\н'}
        </span>
      )
    }
    if (status === 'invited') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
          <Clock className="w-3 h-3" />
          {'\П\р\и\г\л\а\ш\е\н'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
        <XCircle className="w-3 h-3" />
        {'\Б\л\о\к\и\р\о\в\а\н'}
      </span>
    )
  }

  const adminCount = users.filter((user) => user.role === 'ADMIN').length
  const superAdminCount = users.filter((user) => user.role === 'SUPERADMIN').length

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !normalizedQuery ||
      [user.name, user.email, user.telegramChatId]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery))

    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = accessFilter === 'all' || getUserStatus(user) === accessFilter
    const matchesTelegram =
      telegramFilter === 'all' ||
      (telegramFilter === 'has' ? !!user.telegramChatId : !user.telegramChatId)
    const matchesEmail =
      emailFilter === 'all' ||
      (emailFilter === 'has' ? !!user.email : !user.email)

    return (
      matchesSearch &&
      matchesRole &&
      matchesStatus &&
      matchesTelegram &&
      matchesEmail
    )
  })

  const groupedUsers = useMemo(() => {
    const groups: Record<User['role'], User[]> = {
      SUPERADMIN: [],
      ADMIN: [],
      MANAGER: [],
      AUDITOR: [],
      EMPLOYEE: [],
      VIEWER: [],
    }
    filteredUsers.forEach((user) => {
      groups[user.role].push(user)
    })
    return groups
  }, [filteredUsers])

  const sortedUsers = useMemo(() => {
    return ROLE_ORDER.flatMap((role) => groupedUsers[role])
  }, [groupedUsers])

  const allVisibleSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((user) => selectedIds.has(user.id))

  const selectedAdminCount = users.filter(
    (user) => selectedIds.has(user.id) && user.role === 'ADMIN'
  ).length
  const selectedSuperAdminCount = users.filter(
    (user) => selectedIds.has(user.id) && user.role === 'SUPERADMIN'
  ).length
  const bulkDemoteBlocked =
    bulkAction === 'role' &&
    !!bulkValue &&
    ((bulkValue !== 'ADMIN' && adminCount - selectedAdminCount <= 0) ||
      (bulkValue !== 'SUPERADMIN' && superAdminCount - selectedSuperAdminCount <= 0))

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const ids = filteredUsers.map((user) => user.id)
      const shouldClear = ids.every((id) => next.has(id))
      if (shouldClear) {
        ids.forEach((id) => next.delete(id))
        return next
      }
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [filteredUsers])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const resetFilters = () => {
    setSearchQuery('')
    setRoleFilter('all')
    setAccessFilter('all')
    setTelegramFilter('all')
    setEmailFilter('all')
  }

  const applyBulkAction = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'delete') {
      if (
        !confirm(
          `\У\д\а\л\и\т\ь ${selectedIds.size} \п\о\л\ь\з\о\в\а\т\е\л\е\й? \Э\т\о \д\е\й\с\т\в\и\е \н\е\л\ь\з\я \о\т\м\е\н\и\т\ь.`
        )
      ) {
        return
      }
    }

    if (bulkAction === 'role' && !bulkValue) {
      toast.error('\В\ы\б\е\р\и\т\е \р\о\л\ь')
      return
    }

    if (bulkAction === 'role' && !isSuperAdmin) {
      toast.error('\Т\о\л\ь\к\о \с\у\п\е\р\а\д\м\и\н \м\о\ж\е\т \м\е\н\я\т\ь \р\о\л\и')
      return
    }

    if (bulkAction === 'canLogin' && !bulkValue) {
      toast.error('\В\ы\б\е\р\и\т\е \д\о\с\т\у\п')
      return
    }
    if (bulkAction === 'role') {
      const selectedAdmins = users.filter(
        (user) => selectedIds.has(user.id) && user.role === 'ADMIN'
      ).length
      const selectedSupers = users.filter(
        (user) => selectedIds.has(user.id) && user.role === 'SUPERADMIN'
      ).length
      if (bulkValue !== 'ADMIN' && adminCount - selectedAdmins <= 0) {
        toast.error('Нельзя понизить единственного админа')
        return
      }
      if (bulkValue !== 'SUPERADMIN' && superAdminCount - selectedSupers <= 0) {
        toast.error('Нельзя понизить единственного суперадмина')
        return
      }
    }

    setBulkLoading(true)
    try {
      const payload: {
        ids: string[]
        action: 'role' | 'canLogin' | 'delete'
        value?: string | boolean
      } = {
        ids: Array.from(selectedIds),
        action: bulkAction,
      }

      if (bulkAction === 'role') {
        payload.value = bulkValue
      }

      if (bulkAction === 'canLogin') {
        payload.value = bulkValue
      }

      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '\О\ш\и\б\к\а \м\а\с\с\о\в\о\г\о \д\е\й\с\т\в\и\я')
        return
      }

      toast.success(
        bulkAction === 'delete'
          ? `\У\д\а\л\е\н\о: ${data.deleted ?? 0}`
          : `\О\б\н\о\в\л\е\н\о: ${data.updated ?? 0}`
      )
      if (data.requiresApproval) {
        toast.message(
          `\Н\у\ж\н\о \п\о\д\т\в\е\р\д\и\т\ь: ${data.pendingApprovals ?? 0}`
        )
        await loadApprovals()
      }
      await loadUsers()
      clearSelection()
      setBulkAction('')
      setBulkValue('')
    } catch (error) {
      console.error('Bulk user action failed:', error)
      toast.error('\О\ш\и\б\к\а \м\а\с\с\о\в\о\г\о \д\е\й\с\т\в\и\я')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, selectedIds, users, adminCount, superAdminCount, isSuperAdmin, loadUsers, loadApprovals, clearSelection, toast])

  const getStatusBadge = (status: SyncLog['status']) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
            <CheckCircle className="w-3 h-3" />
            Успешно
          </span>
        )
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
            <XCircle className="w-3 h-3" />
            Ошибка
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            В процессе
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
            <Clock className="w-3 h-3" />
            Ожидание
          </span>
        )
    }
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !hasPermission(session.user.role, 'MANAGE_USERS')) {
    return null
  }

  return (
    <div className="min-h-screen app-shell">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-pageIn relative">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-white">Настройки</h1>
        <p className="text-muted text-sm mt-2 mb-6 sm:mb-8">{'\Р\о\л\и, \д\о\с\т\у\п, \у\в\е\д\о\м\л\е\н\и\я \и \ж\у\р\н\а\л \б\е\з\о\п\а\с\н\о\с\т\и.'}</p>

        {/* Sync Logs */}
        <div className="panel panel-glass rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">Логи синхронизации</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">{'\И\н\т\е\г\р\а\ц\и\и'}</span>
            </div>
            <button
              onClick={loadSyncLogs}
              aria-label="Refresh sync logs"
              className="p-2 text-gray-400 hover:text-white transition"
              title="Обновить"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {syncLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Время</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Направление</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Статус</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Записей</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Длительность</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => {
                    const duration = log.finishedAt
                      ? Math.round(
                          (new Date(log.finishedAt).getTime() -
                            new Date(log.startedAt).getTime()) /
                            1000
                        )
                      : null

                    return (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {formatDate(log.startedAt)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-2 text-sm">
                            {log.direction === 'TO_SHEETS' ? (
                              <>
                                <ArrowUpFromLine className="w-4 h-4 text-blue-400" />
                                <span className="text-blue-400">В Sheets</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownToLine className="w-4 h-4 text-purple-400" />
                                <span className="text-purple-400">Из Sheets</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                        <td className="py-3 px-4 text-white">{log.rowsAffected}</td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {duration !== null ? `${duration} сек` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {log.error && (
                            <span
                              className="text-red-400 text-xs truncate block max-w-xs"
                              title={log.error}
                            >
                              {log.error.substring(0, 50)}
                              {log.error.length > 50 ? '...' : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Нет записей синхронизации
            </div>
          )}
        </div>

        {/* Users Management */}
        <div className="panel panel-glass rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Управление пользователями</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-sky-500/15 text-sky-300 border border-sky-400/20">{'\П\о\л\ь\з\о\в\а\т\е\л\и'}</span>
          </div>

          {isSuperAdmin && (
            <div className="panel-soft panel-glass rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                {'\З\а\п\р\о\с\ы \н\а \п\о\д\т\в\е\р\ж\д\е\н\и\е'}
              </div>
              <button
                onClick={loadApprovals}
                aria-label="Refresh approvals"
                className="p-2 text-gray-400 hover:text-white transition"
                title={'\О\б\н\о\в\и\т\ь'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {approvalsLoading ? (
              <div className="text-xs text-gray-500">{'\З\а\г\р\у\з\к\а...'}</div>
            ) : approvals.length > 0 ? (
              <div className="space-y-3">
                {approvals.map((approval) => {
                  const approvalTitle =
                    approval.action === 'DEMOTE_ADMIN'
                      ? '\П\о\н\и\ж\е\н\и\е \р\о\л\и \а\д\м\и\н\а'
                      : '\У\д\а\л\е\н\и\е \а\д\м\и\н\а'
                  const requester =
                    approval.requestedBy.name ||
                    approval.requestedBy.email ||
                    '\Н\е\и\з\в\е\с\т\н\ы\й'
                  const targetLabel =
                    approval.targetUser.name || approval.targetUser.email || '\Б\е\з \и\м\е\н\и'
                  const needsSecondAdmin = approval.requestedBy.id === session.user.id
                  return (
                    <div
                      key={approval.id}
                      className="panel-soft panel-glass rounded-xl p-3 flex flex-col gap-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm text-white">{approvalTitle}</div>
                          <div className="text-xs text-gray-400">
                            {targetLabel} · {formatRoleLabel(approval.targetUser.role)}
                          </div>
                          {approval.action === 'DEMOTE_ADMIN' && approval.payload?.newRole && (
                            <div className="text-xs text-emerald-400">
                              {'\Н\о\в\а\я \р\о\л\ь:'} {formatRoleLabel(approval.payload.newRole)}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {requester} · {formatDate(approval.createdAt)}
                          {needsSecondAdmin && (
                            <div className="text-xs text-amber-400">
                              {'\Н\у\ж\е\н \в\т\о\р\о\й \а\д\м\и\н'}
                            </div>
                          )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproval(approval.id, 'approve')}
                            disabled={approvalActionId === approval.id || needsSecondAdmin}
                            title={needsSecondAdmin ? '\Н\у\ж\е\н \в\т\о\р\о\й \а\д\м\и\н' : undefined}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition disabled:opacity-50"
                          >
                            {approvalActionId === approval.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {'\П\о\д\т\в\е\р\д\и\т\ь'}
                          </button>
                          <button
                            onClick={() => handleApproval(approval.id, 'reject')}
                            disabled={approvalActionId === approval.id || needsSecondAdmin}
                            title={needsSecondAdmin ? '\Н\у\ж\е\н \в\т\о\р\о\й \а\д\м\и\н' : undefined}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs btn-secondary rounded transition disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            {'\О\т\к\л\о\н\и\т\ь'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500">{'\Н\е\т \з\а\п\р\о\с\о\в \н\а \п\о\д\т\в\е\р\ж\д\е\н\и\е'}</div>
            )}
            </div>
          )}

          <div className="panel-soft panel-glass rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              {'\Д\о\б\а\в\и\т\ь \п\о\л\ь\з\о\в\а\т\е\л\я'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                value={createData.name}
                onChange={(e) =>
                  setCreateData({ ...createData, name: e.target.value })
                }
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Name"
                placeholder={'\И\м\я'}
              />
              <input
                type="email"
                value={createData.email}
                onChange={(e) =>
                  setCreateData({ ...createData, email: e.target.value })
                }
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Email"
                placeholder="email@example.com"
              />
              <select
                value={createData.role}
                onChange={(e) =>
                  setCreateData({
                    ...createData,
                    role: e.target.value as User['role'],
                  })
                }
                disabled={!isSuperAdmin}
                className={`${fieldBase} w-full px-3 py-2 disabled:opacity-60`}
                aria-label="Role"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={createData.telegramChatId}
                onChange={(e) =>
                  setCreateData({ ...createData, telegramChatId: e.target.value })
                }
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Telegram chat ID"
                placeholder="Telegram Chat ID"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <div className="space-y-1 text-xs text-gray-500">
                <p>
                  {'\Д\л\я \в\х\о\д\а \ч\е\р\е\з Google \т\р\е\б\у\е\т\с\я email.'}
                </p>
                {!isSuperAdmin && (
                  <p className="text-amber-400">
                    {'\Р\о\л\и \н\а\з\н\а\ч\а\е\т \т\о\л\ь\к\о \с\у\п\е\р\а\д\м\и\н.'}
                  </p>
                )}
              </div>
              <button
                onClick={createUser}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {'\Д\о\б\а\в\и\т\ь'}
              </button>
            </div>
          </div>

          <div className="panel-soft panel-glass rounded-2xl p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${fieldBase} w-full pl-9 pr-3 py-2`}
                  placeholder={'\П\о\и\с\к \п\о \и\м\е\н\и, email, Telegram'}
                  aria-label="Search users"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | User['role'])}
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Filter by role"
              >
                <option value="all">{'\В\с\е \р\о\л\и'}</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value as 'all' | 'active' | 'invited' | 'blocked')}
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Filter by status"
              >
                <option value="all">{'\В\с\е \с\т\а\т\у\с\ы'}</option>
                <option value="active">{'\А\к\т\и\в\н\ы\е'}</option>
                <option value="invited">{'\П\р\и\г\л\а\ш\е\н\ы'}</option>
                <option value="blocked">{'\Б\л\о\к\и\р\о\в\а\н\ы'}</option>
              </select>
              <select
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value as 'all' | 'has' | 'none')}
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Filter by email"
              >
                <option value="all">{'\В\с\е email'}</option>
                <option value="has">{'\С email'}</option>
                <option value="none">{'\Б\е\з email'}</option>
              </select>
              <select
                value={telegramFilter}
                onChange={(e) => setTelegramFilter(e.target.value as 'all' | 'has' | 'none')}
                className={`${fieldBase} w-full px-3 py-2`}
                aria-label="Filter by Telegram"
              >
                <option value="all">{'\В\с\е Telegram'}</option>
                <option value="has">{'\С Telegram'}</option>
                <option value="none">{'\Б\е\з Telegram'}</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-xs text-gray-400">
              <span>
                {'\П\о\к\а\з\а\н\о'} {filteredUsers.length} {'\и\з'} {users.length}
              </span>
              {(searchQuery ||
                roleFilter !== 'all' ||
                accessFilter !== 'all' ||
                telegramFilter !== 'all' ||
                emailFilter !== 'all') && (
                <button
                  onClick={resetFilters}
                  className="text-emerald-400 hover:text-emerald-300 transition"
                >
                  {'\С\б\р\о\с\и\т\ь \ф\и\л\ь\т\р\ы'}
                </button>
              )}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="panel-soft panel-glass rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
              <span className="text-sm text-white">
                {'\В\ы\б\р\а\н\о'}: {selectedIds.size}
              </span>
              <select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value as 'role' | 'canLogin' | 'delete' | '')
                  setBulkValue('')
                }}
                className={`${fieldBase} px-3 py-2`}
                aria-label="Bulk action"
              >
                <option value="">{'\Д\е\й\с\т\в\и\е'}</option>
                {isSuperAdmin && (
                  <option value="role">{'\С\м\е\н\и\т\ь \р\о\л\ь'}</option>
                )}
                <option value="canLogin">{'\Д\о\с\т\у\п'}</option>
                <option value="delete">{'\У\д\а\л\и\т\ь'}</option>
              </select>
              {bulkAction === 'role' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className={`${fieldBase} px-3 py-2`}
                  aria-label="Bulk role"
                >
                  <option value="">{'\В\ы\б\е\р\и\т\е \р\о\л\ь'}</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              )}
              {bulkAction === 'canLogin' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className={`${fieldBase} px-3 py-2`}
                  aria-label="Bulk access"
                >
                  <option value="">{'\В\ы\б\е\р\и\т\е \д\о\с\т\у\п'}</option>
                  <option value="enable">{'\О\т\к\р\ы\т\ь \д\о\с\т\у\п'}</option>
                  <option value="disable">{'\З\а\к\р\ы\т\ь \д\о\с\т\у\п'}</option>
                </select>
              )}
              <button
                onClick={applyBulkAction}
                disabled={!bulkAction || bulkLoading || selectedIds.size === 0 || bulkDemoteBlocked}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
              >
                {bulkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {'\П\р\и\м\е\н\и\т\ь'}
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-2 text-gray-400 hover:text-white transition"
              >
                {'\С\б\р\о\с\и\т\ь'}
              </button>
              {bulkDemoteBlocked && (
                <span className="text-xs text-amber-400">
                  {'\Н\е\л\ь\з\я \п\о\н\и\з\и\т\ь \п\о\с\л\е\д\н\е\г\о \а\д\м\и\н\а \и\л\и \с\у\п\е\р\а\д\м\и\н\а'}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className={controlBase}
                aria-label="Select all users"
              />
              {'\В\ы\б\р\а\т\ь \в\с\е\х'}
            </label>
            <span className="text-xs text-gray-500">
              {'\В\ы\б\р\а\н\о:'} {selectedIds.size}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedUsers.flatMap((user, index) => {
              const prevRole = index > 0 ? sortedUsers[index - 1]?.role : null
              const showHeading = user.role !== prevRole
              const roleCount = groupedUsers[user.role]?.length ?? 0
              const isEditing = editingId === user.id
              const isSaving = savingId === user.id
              const isDirty = isEditing && hasEditChanges
              const isSelected = selectedIds.has(user.id)
              const isLastAdmin = user.role === 'ADMIN' && adminCount <= 1
              const isLastSuperAdmin = user.role === 'SUPERADMIN' && superAdminCount <= 1
              const roleChangeLocked = !isSuperAdmin || isLastAdmin || isLastSuperAdmin
              const isRoyal = user.role === 'SUPERADMIN'
              const deleteLocked =
                (user.role === 'ADMIN' && (!isSuperAdmin || isLastAdmin)) ||
                (user.role === 'SUPERADMIN' && (!isSuperAdmin || isLastSuperAdmin))
              const auditEntries = auditByUser[user.id] || []
              const hasAuditEntries = auditEntries.length > 0

              const items: JSX.Element[] = []
              if (showHeading) {
                items.push(
                  <div key={`${user.role}-heading`} className="md:col-span-2 xl:col-span-3 flex items-center justify-between text-sm text-gray-400">
                    <span>{formatRoleLabel(user.role)}</span>
                    <span className="text-xs text-gray-500">{roleCount}</span>
                  </div>
                )
              }

              items.push(
                <div
                  key={user.id}
                  className={`rounded-2xl panel-soft panel-glass p-4 transition ${
                    isSelected ? 'ring-2 ring-emerald-400/40' : ''
                  } ${isRoyal ? 'border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 via-white/5 to-transparent' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <Image
                          src={user.image}
                          alt={user.name || user.email || 'User'}
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded-full"
                          unoptimized
                        />
                      ) : (
                        <div className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center">
                          <span className="text-gray-300 text-sm font-semibold">
                            {(user.name || user.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">
                            {user.name || '\Б\е\з \и\м\е\н\и'}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${ROLE_BADGE_CLASSES[user.role]}`}
                          >
                            {user.role === 'SUPERADMIN' ? (
                              <Crown className="w-3 h-3 text-yellow-200" />
                            ) : (
                              <Shield className="w-3 h-3" />
                            )}
                            {formatRoleLabel(user.role)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{user.email || '-'}</span>
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(user.id)}
                      className={`${controlBase} mt-1`}
                      aria-label={`Select ${user.name || user.email || 'user'}`}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {getUserStatusBadge(user)}
                    {getInactiveBadge(user)}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-gray-300">
                      <FileText className="w-3 h-3" />
                      {user._count.letters} {'\п\и\с\е\м'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-gray-400">
                      <MessageSquare className="w-3 h-3" />
                      {user._count.comments}
                    </span>
                  </div>

                  {!isEditing ? (
                    <div className="mt-4 grid gap-2 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        {user.telegramChatId || '-'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDate(user.lastLoginAt)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">{'\И\м\я'}</span>
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className={`${fieldCompact} w-full px-3 py-1.5`}
                          aria-label="Name"
                          placeholder={'\И\м\я'}
                        />
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">Email</span>
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) =>
                            setEditData({ ...editData, email: e.target.value })
                          }
                          className={`${fieldCompact} w-full px-3 py-1.5`}
                          aria-label="Email"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">{'\Р\о\л\ь'}</span>
                        <select
                          value={editData.role}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              role: e.target.value as User['role'],
                            })
                          }
                          disabled={roleChangeLocked}
                          className={`${fieldCompact} px-3 py-1.5 disabled:opacity-60`}
                          aria-label="User role"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                        {!isSuperAdmin && (
                          <span className="text-xs text-amber-400">
                            {'\Р\о\л\и \м\е\н\я\е\т \т\о\л\ь\к\о \с\у\п\е\р\а\д\м\и\н'}
                          </span>
                        )}
                        {isSuperAdmin && isLastAdmin && (
                          <span className="text-xs text-amber-400">
                            {'\Е\д\и\н\с\т\в\е\н\н\ы\й \а\д\м\и\н \н\е \м\о\ж\е\т \б\ы\т\ь \п\о\н\и\ж\е\н'}
                          </span>
                        )}
                        {isSuperAdmin && isLastSuperAdmin && (
                          <span className="text-xs text-amber-400">
                            {'\Е\д\и\н\с\т\в\е\н\н\ы\й \с\у\п\е\р\а\д\м\и\н \н\е \м\о\ж\е\т \б\ы\т\ь \п\о\н\и\ж\е\н'}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">{'\Д\о\с\т\у\п'}</span>
                        <select
                          value={editData.canLogin ? 'open' : 'closed'}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              canLogin: e.target.value === 'open',
                            })
                          }
                          disabled={user.role === 'ADMIN' || user.role === 'SUPERADMIN'}
                          className={`${fieldCompact} px-3 py-1.5 disabled:opacity-60`}
                          aria-label="Access"
                        >
                          <option value="open">{'\О\т\к\р\ы\т'}</option>
                          <option value="closed">{'\З\а\к\р\ы\т'}</option>
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">Telegram</span>
                        <input
                          type="text"
                          value={editData.telegramChatId}
                          onChange={(e) =>
                            setEditData({ ...editData, telegramChatId: e.target.value })
                          }
                          className={`${fieldCompact} w-full px-3 py-1.5`}
                          aria-label="Telegram chat ID"
                          placeholder="Chat ID"
                        />
                      </div>
                      <div className="border-t border-white/10 pt-3 grid gap-3 text-xs">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Bell className="w-3.5 h-3.5" />
                          {'\К\а\н\а\л\ы \у\в\е\д\о\м\л\е\н\и\й'}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-300">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.notifyEmail}
                              onChange={(e) =>
                                setEditData({ ...editData, notifyEmail: e.target.checked })
                              }
                              className={controlBase}
                              aria-label="Notify by email"
                            />
                            Email
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.notifyTelegram}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  notifyTelegram: e.target.checked,
                                })
                              }
                              className={controlBase}
                              aria-label="Notify by Telegram"
                            />
                            Telegram
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.notifySms}
                              onChange={(e) =>
                                setEditData({ ...editData, notifySms: e.target.checked })
                              }
                              className={controlBase}
                              aria-label="Notify by SMS"
                            />
                            SMS
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.notifyInApp}
                              onChange={(e) =>
                                setEditData({ ...editData, notifyInApp: e.target.checked })
                              }
                              className={controlBase}
                              aria-label="Notify in app"
                            />
                            {'\В\н\у\т\р\и \с\и\с\т\е\м\ы'}
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <span className="text-gray-400">
                              {'\Т\и\х\и\е \ч\а\с\ы (\с)'}
                            </span>
                            <input
                              type="time"
                              value={editData.quietHoursStart}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  quietHoursStart: e.target.value,
                                })
                              }
                              className={`${fieldCompact} w-full px-3 py-1.5`}
                              aria-label="Quiet hours start"
                            />
                          </div>
                          <div className="grid gap-1">
                            <span className="text-gray-400">
                              {'\Т\и\х\и\е \ч\а\с\ы (\д\о)'}
                            </span>
                            <input
                              type="time"
                              value={editData.quietHoursEnd}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  quietHoursEnd: e.target.value,
                                })
                              }
                              className={`${fieldCompact} w-full px-3 py-1.5`}
                              aria-label="Quiet hours end"
                            />
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-gray-400">{'\Д\а\й\д\ж\е\с\т'}</span>
                          <select
                            value={editData.digestFrequency}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                digestFrequency: e.target.value as User['digestFrequency'],
                              })
                            }
                            className={`${fieldCompact} px-3 py-1.5`}
                            aria-label="Digest frequency"
                          >
                            {DIGEST_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    {isEditing ? (
                      <span className="text-xs text-gray-500">
                        {isSaving
                          ? '\С\о\х\р\а\н\е\н\и\е...'
                          : isDirty
                            ? '\А\в\т\о\с\о\х\р\а\н\е\н\и\е'
                            : '\С\о\х\р\а\н\е\н\о'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {'\П\о\с\л\е\д\н\и\й \в\х\о\д:'} {formatDate(user.lastLoginAt)}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={cancelEdit}
                            aria-label="Cancel edit"
                            disabled={isSaving}
                            className="p-2 text-gray-400 hover:text-white transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => saveUser('manual')}
                            aria-label="Save user"
                            disabled={!isDirty || isSaving}
                            className="p-2 text-emerald-400 hover:text-emerald-300 transition"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/users/${user.id}`}
                            aria-label="View profile"
                            className="p-2 text-gray-400 hover:text-white transition"
                            title={'\П\р\о\ф\и\л\ь'}
                          >
                            <UserIcon className="w-4 h-4" />
                          </Link>
                          {user.id !== session.user.id && (
                            <button
                              onClick={() => toggleUserAccess(user)}
                              aria-label={user.canLogin ? 'Disable access' : 'Enable access'}
                              disabled={user.role === 'ADMIN' || user.role === 'SUPERADMIN'}
                              title={
                                user.role === 'SUPERADMIN'
                                  ? '\Н\е\л\ь\з\я \о\т\к\л\ю\ч\и\т\ь \с\у\п\е\р\а\д\м\и\н\а'
                                  : user.role === 'ADMIN'
                                    ? '\Н\е\л\ь\з\я \о\т\к\л\ю\ч\и\т\ь \а\д\м\и\н\а'
                                    : user.canLogin
                                      ? '\З\а\к\р\ы\т\ь \д\о\с\т\у\п'
                                      : '\О\т\к\р\ы\т\ь \д\о\с\т\у\п'
                              }
                              className="p-2 text-gray-400 hover:text-emerald-300 transition disabled:opacity-60"
                            >
                              {user.canLogin ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                <Unlock className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(user)}
                            aria-label="Edit user"
                            className="p-2 text-gray-400 hover:text-white transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.id !== session.user.id && (
                            <button
                              onClick={() => deleteUser(user.id)}
                              aria-label="Delete user"
                              disabled={deleteLocked}
                              title={
                                !isSuperAdmin && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')
                                  ? '\У\д\а\л\я\т\ь \а\д\м\и\н\о\в \м\о\ж\е\т \т\о\л\ь\к\о \с\у\п\е\р\а\д\м\и\н'
                                  : isLastSuperAdmin
                                    ? '\Н\е\л\ь\з\я \у\д\а\л\и\т\ь \е\д\и\н\с\т\в\е\н\н\о\г\о \с\у\п\е\р\а\д\м\и\н\а'
                                    : isLastAdmin
                                      ? '\Н\е\л\ь\з\я \у\д\а\л\и\т\ь \е\д\и\н\с\т\в\е\н\н\о\г\о \а\д\м\и\н\а'
                                      : undefined
                              }
                              className="p-2 text-gray-400 hover:text-red-400 transition disabled:opacity-60"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => toggleAudit(user.id)}
                        aria-label="Toggle audit history"
                        className="px-2 py-1 text-xs text-gray-400 hover:text-white transition border border-white/10 rounded"
                      >
                        {auditOpenId === user.id
                          ? '\С\к\р\ы\т\ь \и\с\т\о\р\и\ю'
                          : '\И\с\т\о\р\и\я'}
                      </button>
                    </div>
                  </div>

                  {auditOpenId === user.id && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-200">
                          <History className="w-4 h-4 text-emerald-400" />
                          {'\И\с\т\о\р\и\я \и\з\м\е\н\е\н\и\й'}
                          <span className="text-xs text-gray-500">{auditEntries.length}</span>
                        </div>
                        <button
                          onClick={() => loadAudit(user.id, 'replace')}
                          className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white transition"
                          aria-label="Refresh audit history"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {'\О\б\н\о\в\и\т\ь'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mb-3 text-xs panel-soft panel-glass rounded-xl p-3">
                        <select
                          value={auditFilters.action}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({ ...prev, action: e.target.value }))
                          }
                          className={`${fieldCompact} px-3 py-1.5`}
                          aria-label="Audit action filter"
                        >
                          {AUDIT_ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={auditFilters.field}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({ ...prev, field: e.target.value }))
                          }
                          className={`${fieldCompact} px-3 py-1.5`}
                          aria-label="Audit field filter"
                        >
                          {AUDIT_FIELD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={auditFilters.actor}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({ ...prev, actor: e.target.value }))
                          }
                          className={`${fieldCompact} px-3 py-1.5`}
                          placeholder={'\А\в\т\о\р'}
                          aria-label="Audit actor search"
                        />
                        <input
                          type="text"
                          value={auditFilters.query}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({ ...prev, query: e.target.value }))
                          }
                          className={`${fieldCompact} px-3 py-1.5`}
                          placeholder={'\П\о\и\с\к \п\о \и\з\м\е\н\е\н\и\я\м'}
                          aria-label="Audit search"
                        />
                      </div>
                      <div
                        className={`min-h-[140px] transition-opacity ${
                          auditLoading[user.id] ? 'opacity-90' : 'opacity-100'
                        }`}
                        aria-busy={auditLoading[user.id] ? 'true' : 'false'}
                      >
                        {auditLoading[user.id] && !hasAuditEntries ? (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-12 rounded-xl bg-white/5 border border-white/5" />
                            <div className="h-12 rounded-xl bg-white/5 border border-white/5" />
                            <div className="h-12 rounded-xl bg-white/5 border border-white/5" />
                          </div>
                        ) : hasAuditEntries ? (
                          <div className="space-y-4">
                            {auditEntries.map((entry) => {
                              const actorName =
                                entry.actor?.name ||
                                entry.actor?.email ||
                                '\Н\е\и\з\в\е\с\т\н\ы\й \а\в\т\о\р'
                              const actorInitial = (actorName || '?').trim().charAt(0).toUpperCase()
                              const showValues = entry.action !== 'CREATE' && entry.action !== 'DELETE'
                              const badge = AUDIT_ACTION_BADGES[entry.action] || {
                                label: entry.action,
                                className: 'bg-slate-500/20 text-slate-300',
                              }
                              return (
                                <div key={entry.id} className="relative pl-4">
                                  <span className="absolute left-0 top-3 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                                  <div className="panel-soft panel-glass rounded-xl p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm text-white font-medium">
                                        {getAuditSummary(entry)}
                                      </div>
                                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${badge.className}`}>
                                        {badge.label}
                                      </span>
                                    </div>
                                    {showValues && (
                                      <div className="text-xs text-gray-300 mt-2 flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-1 rounded bg-white/10 border border-white/10">
                                          {formatAuditValue(entry.field, entry.oldValue)}
                                        </span>
                                        <span className="text-gray-500">{'\→'}</span>
                                        <span className="px-2 py-1 rounded bg-white/10 border border-white/10">
                                          {formatAuditValue(entry.field, entry.newValue)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-3 flex items-center gap-2">
                                      {entry.actor?.image ? (
                                        <Image
                                          src={entry.actor.image}
                                          alt={actorName}
                                          width={20}
                                          height={20}
                                          className="w-5 h-5 rounded-full"
                                          unoptimized
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-white/10 text-[10px] text-gray-200 flex items-center justify-center">
                                          {actorInitial}
                                        </div>
                                      )}
                                      <span className="truncate">{actorName}</span>
                                      <span className="text-gray-600">\·</span>
                                      <span>{formatDate(entry.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {auditCursorByUser[user.id] && (
                              <button
                                onClick={() => loadAudit(user.id, 'more', auditCursorByUser[user.id])}
                                className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                {'\П\о\к\а\з\а\т\ь \е\щ\е'}
                              </button>
                            )}
                            {auditLoading[user.id] && (
                              <div className="text-xs text-gray-500">{'\О\б\н\о\в\л\е\н\и\е...'}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 border border-dashed border-white/10 rounded-lg p-3">
                            {'\Н\е\т \и\з\м\е\н\е\н\и\й \з\а \в\ы\б\р\а\н\н\ы\й \п\е\р\и\о\д'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
              return items
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {users.length === 0
                ? '\Н\е\т \п\о\л\ь\з\о\в\а\т\е\л\е\й'
                : '\Н\и\ч\е\г\о \н\е \н\а\й\д\е\н\о'}
            </div>
          )}
        </div>
        <div className="panel panel-glass rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">{'\Б\е\з\о\п\а\с\н\о\с\т\ь: \в\х\о\д\ы'}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-400/20">{'\Б\е\з\о\п\а\с\н\о\с\т\ь'}</span>
            </div>
            <button
              onClick={() => loadLoginAudits('replace')}
              aria-label="Refresh login audits"
              className="p-2 text-gray-400 hover:text-white transition"
              title={'\О\б\н\о\в\и\т\ь'}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <select
              value={loginAuditStatus}
              onChange={(e) => setLoginAuditStatus(e.target.value as 'all' | 'success' | 'failure')}
              className={`${fieldBase} w-full px-3 py-2`}
              aria-label="Login audit status"
            >
              {LOGIN_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={loginAuditQuery}
                onChange={(e) => setLoginAuditQuery(e.target.value)}
                className={`${fieldBase} w-full pl-9 pr-3 py-2`}
                placeholder={'\П\о\и\с\к \п\о email \и\л\и \и\м\е\н\и'}
                aria-label="Login audit search"
              />
            </div>
            <button
              onClick={() => {
                setLoginAuditStatus('all')
                setLoginAuditQuery('')
              }}
              className="px-3 py-2 text-gray-300 hover:text-white border border-white/10 rounded"
            >
              {'\С\б\р\о\с\и\т\ь'}
            </button>
          </div>

          {loginAuditSummary.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {loginAuditSummary.map((day) => (
                <div
                  key={day.date}
                  className="panel-soft panel-glass rounded-xl p-3"
                >
                  <div className="text-xs text-gray-400">{formatSummaryDate(day.date)}</div>
                  <div className="text-sm text-white">
                    {day.success} {'\у\с\п\е\ш\н\о'}
                  </div>
                  <div className="text-xs text-red-400">
                    {day.failure} {'\о\ш\и\б\о\к'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loginAuditLoading && loginAudits.length === 0 ? (
            <div className="text-xs text-gray-500">{'\З\а\г\р\у\з\к\а...'}</div>
          ) : loginAudits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\Д\а\т\а'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\П\о\л\ь\з\о\в\а\т\е\л\ь'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\Р\е\з\у\л\ь\т\а\т'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\П\р\и\ч\и\н\а'}</th>
                  </tr>
                </thead>
                <tbody>
                  {loginAudits.map((event) => {
                    const displayName =
                      event.user?.name || event.user?.email || event.email
                    return (
                      <tr key={event.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {formatDate(event.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-white">{displayName}</div>
                          <div className="text-xs text-gray-500">{event.email}</div>
                        </td>
                        <td className="py-3 px-4">{getLoginStatusBadge(event.success)}</td>
                        <td className="py-3 px-4 text-xs text-gray-400">
                          {formatLoginReason(event.reason)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-gray-500">{'\Н\е\т \д\а\н\н\ы\х'} </div>
          )}

          {loginAuditCursor && (
            <div className="mt-4">
              <button
                onClick={() => loadLoginAudits('more')}
                disabled={loginAuditLoading}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition disabled:opacity-50"
              >
                {loginAuditLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {'\З\а\г\р\у\з\к\а...'}
                  </span>
                ) : (
                  '\П\о\к\а\з\а\т\ь \е\щ\е'
                )}
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
