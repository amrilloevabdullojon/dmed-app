'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  ArrowUpFromLine,
  ArrowDownToLine,
  UserPlus,
  Search,
  Bell,
  Lock,
  Unlock,
  ShieldAlert,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permissions'

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
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
  ADMIN: '\u0410\u0434\u043c\u0438\u043d',
  MANAGER: '\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440',
  AUDITOR: '\u0410\u0443\u0434\u0438\u0442\u043e\u0440',
  EMPLOYEE: '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a',
  VIEWER: '\u041d\u0430\u0431\u043b\u044e\u0434\u0430\u0442\u0435\u043b\u044c',
}

const ROLE_BADGE_CLASSES: Record<User['role'], string> = {
  ADMIN: 'bg-amber-500/20 text-amber-400',
  MANAGER: 'bg-blue-500/20 text-blue-400',
  AUDITOR: 'bg-purple-500/20 text-purple-400',
  EMPLOYEE: 'bg-emerald-500/20 text-emerald-400',
  VIEWER: 'bg-slate-500/20 text-slate-400',
}

const ROLE_ORDER: User['role'][] = ['ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']

const ROLE_OPTIONS: Array<{ value: User['role']; label: string }> = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

const DIGEST_LABELS: Record<User['digestFrequency'], string> = {
  NONE: '\u041d\u0435\u0442',
  DAILY: '\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u043e',
  WEEKLY: '\u0415\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u043e',
}

const DIGEST_OPTIONS: Array<{ value: User['digestFrequency']; label: string }> = [
  { value: 'NONE', label: DIGEST_LABELS.NONE },
  { value: 'DAILY', label: DIGEST_LABELS.DAILY },
  { value: 'WEEKLY', label: DIGEST_LABELS.WEEKLY },
]

const AUDIT_ACTION_OPTIONS = [
  { value: 'all', label: '\u0412\u0441\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f' },
  { value: 'CREATE', label: '\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435' },
  { value: 'UPDATE', label: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f' },
  { value: 'ROLE', label: '\u0420\u043e\u043b\u0438' },
  { value: 'ACCESS', label: '\u0414\u043e\u0441\u0442\u0443\u043f' },
  { value: 'DELETE', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435' },
]

const AUDIT_FIELD_OPTIONS = [
  { value: 'all', label: '\u0412\u0441\u0435 \u043f\u043e\u043b\u044f' },
  { value: 'name', label: '\u0418\u043c\u044f' },
  { value: 'email', label: 'Email' },
  { value: 'role', label: '\u0420\u043e\u043b\u044c' },
  { value: 'canLogin', label: '\u0414\u043e\u0441\u0442\u0443\u043f' },
  { value: 'telegramChatId', label: 'Telegram' },
  { value: 'notifyEmail', label: 'Email \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f' },
  { value: 'notifyTelegram', label: 'Telegram \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f' },
  { value: 'notifySms', label: 'SMS \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f' },
  { value: 'notifyInApp', label: '\u0412\u043d\u0443\u0442\u0440\u0438 \u0441\u0438\u0441\u0442\u0435\u043c\u044b' },
  { value: 'quietHoursStart', label: '\u0422\u0438\u0445\u0438\u0435 \u0447\u0430\u0441\u044b (\u0441)' },
  { value: 'quietHoursEnd', label: '\u0422\u0438\u0445\u0438\u0435 \u0447\u0430\u0441\u044b (\u0434\u043e)' },
  { value: 'digestFrequency', label: '\u0414\u0430\u0439\u0434\u0436\u0435\u0441\u0442' },
]

const LOGIN_STATUS_OPTIONS = [
  { value: 'all', label: '\u0412\u0441\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0438' },
  { value: 'success', label: '\u0423\u0441\u043f\u0435\u0448\u043d\u044b\u0435' },
  { value: 'failure', label: '\u041e\u0448\u0438\u0431\u043a\u0438' },
]

const INACTIVE_WARNING_DAYS = 7

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    name: string
    email: string
    role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
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
    role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
    telegramChatId: string
  }>({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editSnapshot, setEditSnapshot] = useState<{
    name: string
    email: string
    role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
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
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'>('all')
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
  }, [])

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
        toast.error(data.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c \u0437\u0430\u043f\u0440\u043e\u0441')
        return
      }

      toast.success(
        action === 'approve'
          ? '\u0417\u0430\u043f\u0440\u043e\u0441 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d'
          : '\u0417\u0430\u043f\u0440\u043e\u0441 \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d'
      )
      await loadApprovals()
      await loadUsers()
    } catch (error) {
      console.error('Failed to update approval:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0438 \u0437\u0430\u043f\u0440\u043e\u0441\u0430')
    } finally {
      setApprovalActionId(null)
    }
  }, [loadApprovals, loadUsers])

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

  const saveUser = useCallback(async (mode: 'auto' | 'manual' = 'manual') => {
    if (!editingId) return

    const toastId = `user-save-${editingId}`
    if (mode === 'auto') {
      toast.loading('\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...', { id: toastId })
    }

    setSavingId(editingId)
    try {
      const res = await fetch(`/api/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (res.ok) {
        const data = await res.json()
        const updated = data.user || {}
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingId ? { ...user, ...updated } : user
          )
        )
        setEditSnapshot({
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
        })
        if (data.requiresApproval) {
          toast.message('\u041d\u0443\u0436\u043d\u043e \u0432\u0442\u043e\u0440\u043e\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0430\u0434\u043c\u0438\u043d\u0430', { id: toastId })
          loadApprovals()
        } else {
          toast.success(
            mode === 'auto'
              ? '\u0410\u0432\u0442\u043e\u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e'
              : '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b',
            { id: toastId }
          )
        }
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c', { id: toastId })
      }
    } catch (error) {
      console.error('Failed to save user:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f', { id: toastId })
    } finally {
      setSavingId(null)
    }
  }, [editData, editingId, loadApprovals])

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
    const timer = setTimeout(() => {
      saveUser('auto')
    }, 700)
    return () => clearTimeout(timer)
  }, [editingId, editSnapshot, hasEditChanges, saveUser, savingId])

  const createUser = async () => {
    if (!createData.email.trim()) {
      toast.error('\u0423\u043a\u0430\u0436\u0438\u0442\u0435 email \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u0447\u0435\u0440\u0435\u0437 Google')
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
        toast.success('\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d')
        setCreateData({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
        await loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f')
      }
    } catch (error) {
      console.error('Failed to create user:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f')
    } finally {
      setCreating(false)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.')) {
      return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.requiresApproval) {
          toast.message('\u041d\u0443\u0436\u043d\u043e \u0432\u0442\u043e\u0440\u043e\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0430\u0434\u043c\u0438\u043d\u0430')
          await loadApprovals()
          return
        }
        toast.success('\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0443\u0434\u0430\u043b\u0435\u043d')
        await loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || '\u041e\u0448\u0438\u0431\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f')
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f')
    }
  }

  const toggleUserAccess = async (user: User) => {
    if (user.role === 'ADMIN') {
      toast.error('\u041d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0430\u0434\u043c\u0438\u043d\u0430')
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
        toast.error(data.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f')
        return
      }

      if (data.user) {
        setUsers((prev) =>
          prev.map((item) => (item.id === user.id ? { ...item, ...data.user } : item))
        )
      }

      if (data.requiresApproval) {
        toast.message('\u041d\u0443\u0436\u043d\u043e \u0432\u0442\u043e\u0440\u043e\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0430\u0434\u043c\u0438\u043d\u0430')
        await loadApprovals()
        return
      }

      toast.success(
        nextAccess
          ? '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442'
          : '\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442'
      )
    } catch (error) {
      console.error('Failed to toggle access:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u0430')
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
      ? '\u0412\u043a\u043b\u044e\u0447\u0435\u043d\u043e'
      : '\u0412\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u043e'
  }

  const formatAuditValue = (field: string | null, value: string | null) => {
    if (!value) return '-'
    if (field === 'role') return formatRoleLabel(value)
    if (field === 'canLogin') {
      return value === 'true'
        ? '\u041e\u0442\u043a\u0440\u044b\u0442'
        : '\u0417\u0430\u043a\u0440\u044b\u0442'
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
      return '\u0421\u043e\u0437\u0434\u0430\u043d \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'
    }
    if (entry.action === 'DELETE') {
      return '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0443\u0434\u0430\u043b\u0435\u043d'
    }
    if (entry.action === 'ROLE') {
      return '\u0421\u043c\u0435\u043d\u0430 \u0440\u043e\u043b\u0438'
    }
    if (entry.action === 'ACCESS') {
      return '\u0414\u043e\u0441\u0442\u0443\u043f \u043a \u0441\u0438\u0441\u0442\u0435\u043c\u0435'
    }

    const fieldLabels: Record<string, string> = {
      name: '\u0418\u043c\u044f',
      email: 'Email',
      role: '\u0420\u043e\u043b\u044c',
      canLogin: '\u0414\u043e\u0441\u0442\u0443\u043f',
      telegramChatId: 'Telegram',
      notifyEmail: 'Email \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
      notifyTelegram: 'Telegram \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
      notifySms: 'SMS \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
      notifyInApp: '\u0412\u043d\u0443\u0442\u0440\u0438 \u0441\u0438\u0441\u0442\u0435\u043c\u044b',
      quietHoursStart: '\u0422\u0438\u0445\u0438\u0435 \u0447\u0430\u0441\u044b (\u0441)',
      quietHoursEnd: '\u0422\u0438\u0445\u0438\u0435 \u0447\u0430\u0441\u044b (\u0434\u043e)',
      digestFrequency: '\u0414\u0430\u0439\u0434\u0436\u0435\u0441\u0442',
    }
    const label = entry.field ? fieldLabels[entry.field] || entry.field : '\u041f\u043e\u043b\u0435'
    return `\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e \u043f\u043e\u043b\u0435: ${label}`
  }

  const formatLoginReason = (reason: string | null) => {
    if (!reason) return '-'
    const labels: Record<string, string> = {
      RATE_LIMIT: '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a',
      USER_NOT_FOUND: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d',
      ACCESS_BLOCKED: '\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442',
    }
    return labels[reason] || reason
  }

  const getLoginStatusBadge = (success: boolean) => {
    return success ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
        <CheckCircle className="w-3 h-3" />
        {'\u0423\u0441\u043f\u0435\u0448\u043d\u043e'}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
        <XCircle className="w-3 h-3" />
        {'\u041e\u0448\u0438\u0431\u043a\u0430'}
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
        {days} {'\u0434\u043d\u0435\u0439 \u0431\u0435\u0437 \u0432\u0445\u043e\u0434\u0430'}
      </span>
    )
  }

  const buildAuditUrl = useCallback((userId: string, cursor?: string | null) => {
    const params = new URLSearchParams()
    if (auditFilters.action !== 'all') {
      params.set('action', auditFilters.action)
    }
    if (auditFilters.field !== 'all') {
      params.set('field', auditFilters.field)
    }
    if (auditFilters.query.trim()) {
      params.set('q', auditFilters.query.trim())
    }
    if (auditFilters.actor.trim()) {
      params.set('actor', auditFilters.actor.trim())
    }
    if (cursor) {
      params.set('cursor', cursor)
    }
    params.set('take', '10')
    return `/api/users/${userId}/audit?${params.toString()}`
  }, [auditFilters])

  const loadAudit = useCallback(async (userId: string, mode: 'replace' | 'more' = 'replace') => {
    setAuditLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      const cursor = mode === 'more' ? auditCursorByUser[userId] : null
      const res = await fetch(buildAuditUrl(userId, cursor))
      if (res.ok) {
        const data = await res.json()
        setAuditByUser((prev) => ({
          ...prev,
          [userId]: mode === 'more' ? [...(prev[userId] || []), ...(data.audits || [])] : (data.audits || []),
        }))
        setAuditCursorByUser((prev) => ({ ...prev, [userId]: data.nextCursor || null }))
      }
    } catch (error) {
      console.error('Failed to load user audit:', error)
    } finally {
      setAuditLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }, [auditCursorByUser, buildAuditUrl])

  const toggleAudit = async (userId: string) => {
    const nextOpen = auditOpenId === userId ? null : userId
    setAuditOpenId(nextOpen)
    if (nextOpen) {
      loadAudit(userId, 'replace')
    }
  }

  useEffect(() => {
    if (auditOpenId) {
      loadAudit(auditOpenId, 'replace')
    }
  }, [auditFilters, auditOpenId, loadAudit])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    const timer = setTimeout(() => {
      loadLoginAudits('replace')
    }, 400)
    return () => clearTimeout(timer)
  }, [authStatus, loginAuditStatus, loginAuditQuery, loadLoginAudits])

  const getUserStatus = (user: User) => {
    if (user.role === 'ADMIN') return 'active'
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
          {'\u0410\u043a\u0442\u0438\u0432\u0435\u043d'}
        </span>
      )
    }
    if (status === 'invited') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
          <Clock className="w-3 h-3" />
          {'\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
        <XCircle className="w-3 h-3" />
        {'\u0411\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d'}
      </span>
    )
  }

  const adminCount = users.filter((user) => user.role === 'ADMIN').length

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
  const bulkDemoteBlocked =
    bulkAction === 'role' &&
    !!bulkValue &&
    bulkValue !== 'ADMIN' &&
    adminCount - selectedAdminCount <= 0

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
          `\u0423\u0434\u0430\u043b\u0438\u0442\u044c ${selectedIds.size} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.`
        )
      ) {
        return
      }
    }

    if (bulkAction === 'role' && !bulkValue) {
      toast.error('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u043e\u043b\u044c')
      return
    }

    if (bulkAction === 'canLogin' && !bulkValue) {
      toast.error('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f')
      return
    }

    if (bulkAction === 'role' && bulkValue !== 'ADMIN') {
      const selectedAdmins = users.filter(
        (user) => selectedIds.has(user.id) && user.role === 'ADMIN'
      ).length
      if (adminCount - selectedAdmins <= 0) {
        toast.error('Нельзя понизить единственного админа')
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
        toast.error(data.error || '\u041e\u0448\u0438\u0431\u043a\u0430 \u043c\u0430\u0441\u0441\u043e\u0432\u043e\u0433\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f')
        return
      }

      toast.success(
        bulkAction === 'delete'
          ? `\u0423\u0434\u0430\u043b\u0435\u043d\u043e: ${data.deleted ?? 0}`
          : `\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e: ${data.updated ?? 0}`
      )
      if (data.requiresApproval) {
        toast.message(
          `\u041d\u0443\u0436\u043d\u043e \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c: ${data.pendingApprovals ?? 0}`
        )
        await loadApprovals()
      }
      await loadUsers()
      clearSelection()
      setBulkAction('')
      setBulkValue('')
    } catch (error) {
      console.error('Bulk user action failed:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u043c\u0430\u0441\u0441\u043e\u0432\u043e\u0433\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, selectedIds, users, adminCount, loadUsers, loadApprovals, clearSelection])

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

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !hasPermission(session.user.role, 'MANAGE_USERS')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-8">Настройки</h1>

        {/* Sync Logs */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">Логи синхронизации</h2>
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
                  <tr className="border-b border-gray-700">
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
                      <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
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
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Управление пользователями</h2>
          </div>

          <div className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                {'\u0417\u0430\u043f\u0440\u043e\u0441\u044b \u043d\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435'}
              </div>
              <button
                onClick={loadApprovals}
                aria-label="Refresh approvals"
                className="p-2 text-gray-400 hover:text-white transition"
                title={'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {approvalsLoading ? (
              <div className="text-xs text-gray-500">{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...'}</div>
            ) : approvals.length > 0 ? (
              <div className="space-y-3">
                {approvals.map((approval) => {
                  const approvalTitle =
                    approval.action === 'DEMOTE_ADMIN'
                      ? '\u041f\u043e\u043d\u0438\u0436\u0435\u043d\u0438\u0435 \u0440\u043e\u043b\u0438 \u0430\u0434\u043c\u0438\u043d\u0430'
                      : '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0430\u0434\u043c\u0438\u043d\u0430'
                  const requester =
                    approval.requestedBy.name ||
                    approval.requestedBy.email ||
                    '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439'
                  const targetLabel =
                    approval.targetUser.name || approval.targetUser.email || '\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438'
                  return (
                    <div
                      key={approval.id}
                      className="border border-white/5 rounded-lg p-3 bg-white/5 flex flex-col gap-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm text-white">{approvalTitle}</div>
                          <div className="text-xs text-gray-400">
                            {targetLabel} · {formatRoleLabel(approval.targetUser.role)}
                          </div>
                          {approval.action === 'DEMOTE_ADMIN' && approval.payload?.newRole && (
                            <div className="text-xs text-emerald-400">
                              {'\u041d\u043e\u0432\u0430\u044f \u0440\u043e\u043b\u044c:'} {formatRoleLabel(approval.payload.newRole)}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {requester} · {formatDate(approval.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproval(approval.id, 'approve')}
                            disabled={approvalActionId === approval.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition disabled:opacity-50"
                          >
                            {approvalActionId === approval.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {'\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c'}
                          </button>
                          <button
                            onClick={() => handleApproval(approval.id, 'reject')}
                            disabled={approvalActionId === approval.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            {'\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500">{'\u041d\u0435\u0442 \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432 \u043d\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435'}</div>
            )}
          </div>

          <div className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                value={createData.name}
                onChange={(e) =>
                  setCreateData({ ...createData, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Name"
                placeholder={'\u0418\u043c\u044f'}
              />
              <input
                type="email"
                value={createData.email}
                onChange={(e) =>
                  setCreateData({ ...createData, email: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Telegram chat ID"
                placeholder="Telegram Chat ID"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <p className="text-xs text-gray-500">
                {'\u0414\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u0447\u0435\u0440\u0435\u0437 Google \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f email.'}
              </p>
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
                {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}
              </button>
            </div>
          </div>

          <div className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder={'\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0438\u043c\u0435\u043d\u0438, email, Telegram'}
                  aria-label="Search users"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | User['role'])}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Filter by role"
              >
                <option value="all">{'\u0412\u0441\u0435 \u0440\u043e\u043b\u0438'}</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value as 'all' | 'active' | 'invited' | 'blocked')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Filter by status"
              >
                <option value="all">{'\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044b'}</option>
                <option value="active">{'\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435'}</option>
                <option value="invited">{'\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u044b'}</option>
                <option value="blocked">{'\u0411\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b'}</option>
              </select>
              <select
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value as 'all' | 'has' | 'none')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Filter by email"
              >
                <option value="all">{'\u0412\u0441\u0435 email'}</option>
                <option value="has">{'\u0421 email'}</option>
                <option value="none">{'\u0411\u0435\u0437 email'}</option>
              </select>
              <select
                value={telegramFilter}
                onChange={(e) => setTelegramFilter(e.target.value as 'all' | 'has' | 'none')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Filter by Telegram"
              >
                <option value="all">{'\u0412\u0441\u0435 Telegram'}</option>
                <option value="has">{'\u0421 Telegram'}</option>
                <option value="none">{'\u0411\u0435\u0437 Telegram'}</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-xs text-gray-400">
              <span>
                {'\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e'} {filteredUsers.length} {'\u0438\u0437'} {users.length}
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
                  {'\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b'}
                </button>
              )}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-3">
              <span className="text-sm text-white">
                {'\u0412\u044b\u0431\u0440\u0430\u043d\u043e'}: {selectedIds.size}
              </span>
              <select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value as 'role' | 'canLogin' | 'delete' | '')
                  setBulkValue('')
                }}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                aria-label="Bulk action"
              >
                <option value="">{'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435'}</option>
                <option value="role">{'\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u0440\u043e\u043b\u044c'}</option>
                <option value="canLogin">{'\u0414\u043e\u0441\u0442\u0443\u043f'}</option>
                <option value="delete">{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</option>
              </select>
              {bulkAction === 'role' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  aria-label="Bulk role"
                >
                  <option value="">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u043e\u043b\u044c'}</option>
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
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  aria-label="Bulk access"
                >
                  <option value="">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f'}</option>
                  <option value="enable">{'\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f'}</option>
                  <option value="disable">{'\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f'}</option>
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
                {'\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c'}
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-2 text-gray-400 hover:text-white transition"
              >
                {'\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c'}
              </button>
              {bulkDemoteBlocked && (
                <span className="text-xs text-amber-400">
                  {'\u041d\u0435\u043b\u044c\u0437\u044f \u043f\u043e\u043d\u0438\u0437\u0438\u0442\u044c \u0435\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u0430\u0434\u043c\u0438\u043d\u0430'}
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
                className="rounded border-gray-600"
                aria-label="Select all users"
              />
              {'\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435\u0445'}
            </label>
            <span className="text-xs text-gray-500">
              {'\u0412\u044b\u0431\u0440\u0430\u043d\u043e:'} {selectedIds.size}
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
                  className={`rounded-2xl border border-white/10 bg-white/5 p-4 transition ${
                    isSelected ? 'ring-2 ring-emerald-400/40' : ''
                  }`}
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
                        <div className="w-11 h-11 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-gray-300 text-sm font-semibold">
                            {(user.name || user.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">
                            {user.name || '\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438'}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${ROLE_BADGE_CLASSES[user.role]}`}
                          >
                            <Shield className="w-3 h-3" />
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
                      className="rounded border-gray-600 mt-1"
                      aria-label={`Select ${user.name || user.email || 'user'}`}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {getUserStatusBadge(user)}
                    {getInactiveBadge(user)}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-gray-300">
                      <FileText className="w-3 h-3" />
                      {user._count.letters} {'\u043f\u0438\u0441\u0435\u043c'}
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
                        <span className="text-xs text-gray-400">{'\u0418\u043c\u044f'}</span>
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                          aria-label="Name"
                          placeholder={'\u0418\u043c\u044f'}
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
                          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                          aria-label="Email"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">{'\u0420\u043e\u043b\u044c'}</span>
                        <select
                          value={editData.role}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              role: e.target.value as User['role'],
                            })
                          }
                          disabled={isLastAdmin}
                          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-60"
                          aria-label="User role"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                        {isLastAdmin && (
                          <span className="text-xs text-amber-400">
                            {'\u0415\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0430\u0434\u043c\u0438\u043d \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u043e\u043d\u0438\u0436\u0435\u043d'}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-gray-400">{'\u0414\u043e\u0441\u0442\u0443\u043f'}</span>
                        <select
                          value={editData.canLogin ? 'open' : 'closed'}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              canLogin: e.target.value === 'open',
                            })
                          }
                          disabled={user.role === 'ADMIN'}
                          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-60"
                          aria-label="Access"
                        >
                          <option value="open">{'\u041e\u0442\u043a\u0440\u044b\u0442'}</option>
                          <option value="closed">{'\u0417\u0430\u043a\u0440\u044b\u0442'}</option>
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
                          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                          aria-label="Telegram chat ID"
                          placeholder="Chat ID"
                        />
                      </div>
                      <div className="border-t border-white/10 pt-3 grid gap-3 text-xs">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Bell className="w-3.5 h-3.5" />
                          {'\u041a\u0430\u043d\u0430\u043b\u044b \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439'}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-300">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.notifyEmail}
                              onChange={(e) =>
                                setEditData({ ...editData, notifyEmail: e.target.checked })
                              }
                              className="rounded border-gray-600"
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
                              className="rounded border-gray-600"
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
                              className="rounded border-gray-600"
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
                              className="rounded border-gray-600"
                              aria-label="Notify in app"
                            />
                            {'\u0412\u043d\u0443\u0442\u0440\u0438 \u0441\u0438\u0441\u0442\u0435\u043c\u044b'}
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <span className="text-gray-400">
                              {'\u0422\u0438\u0445\u0438\u0435 \u0447\u0430\u0441\u044b (\u0441)'}
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
                              className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                              aria-label="Quiet hours start"
                            />
                          </div>
                          <div className="grid gap-1">
                            <span className="text-gray-400">
                              {'\u0422\u0438\u0445\u0438\u0435 \u0447\u0430\u0441\u044b (\u0434\u043e)'}
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
                              className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                              aria-label="Quiet hours end"
                            />
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-gray-400">{'\u0414\u0430\u0439\u0434\u0436\u0435\u0441\u0442'}</span>
                          <select
                            value={editData.digestFrequency}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                digestFrequency: e.target.value as User['digestFrequency'],
                              })
                            }
                            className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
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
                          ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...'
                          : isDirty
                            ? '\u0410\u0432\u0442\u043e\u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435'
                            : '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434:'} {formatDate(user.lastLoginAt)}
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
                          {user.id !== session.user.id && (
                            <button
                              onClick={() => toggleUserAccess(user)}
                              aria-label={user.canLogin ? 'Disable access' : 'Enable access'}
                              disabled={user.role === 'ADMIN'}
                              title={
                                user.role === 'ADMIN'
                                  ? '\u041d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0430\u0434\u043c\u0438\u043d\u0430'
                                  : user.canLogin
                                    ? '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f'
                                    : '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f'
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
                              disabled={isLastAdmin}
                              title={
                                isLastAdmin
                                  ? '\u041d\u0435\u043b\u044c\u0437\u044f \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0435\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u0430\u0434\u043c\u0438\u043d\u0430'
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
                          ? '\u0421\u043a\u0440\u044b\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e'
                          : '\u0418\u0441\u0442\u043e\u0440\u0438\u044f'}
                      </button>
                    </div>
                  </div>

                  {auditOpenId === user.id && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="text-sm text-gray-300 mb-2">
                        {'\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439'}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mb-3 text-xs">
                        <select
                          value={auditFilters.action}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({ ...prev, action: e.target.value }))
                          }
                          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
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
                          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
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
                          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder={'\u0410\u0432\u0442\u043e\u0440'}
                          aria-label="Audit actor search"
                        />
                        <input
                          type="text"
                          value={auditFilters.query}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({ ...prev, query: e.target.value }))
                          }
                          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder={'\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f\u043c'}
                          aria-label="Audit search"
                        />
                      </div>
                      {auditLoading[user.id] ? (
                        <div className="text-xs text-gray-500">
                          {'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...'}
                        </div>
                      ) : auditByUser[user.id]?.length ? (
                        <div className="space-y-3">
                          {auditByUser[user.id].map((entry) => {
                            const actorName =
                              entry.actor?.name ||
                              entry.actor?.email ||
                              '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0430\u0432\u0442\u043e\u0440'
                            const showValues = entry.action !== 'CREATE' && entry.action !== 'DELETE'
                            return (
                              <div
                                key={entry.id}
                                className="border border-white/5 rounded-lg p-3 bg-white/5"
                              >
                                <div className="text-sm text-white">
                                  {getAuditSummary(entry)}
                                </div>
                                {showValues && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {formatAuditValue(entry.field, entry.oldValue)} {'\u2192'}{' '}
                                    {formatAuditValue(entry.field, entry.newValue)}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 mt-2">
                                  {actorName} \u00b7 {formatDate(entry.createdAt)}
                                </div>
                              </div>
                            )
                          })}
                          {auditCursorByUser[user.id] && (
                            <button
                              onClick={() => loadAudit(user.id, 'more')}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                            >
                              {'\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0435'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {'\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439'}
                        </div>
                      )}
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
                ? '\u041d\u0435\u0442 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439'
                : '\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e'}
            </div>
          )}
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">{'\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c: \u0432\u0445\u043e\u0434\u044b'}</h2>
            </div>
            <button
              onClick={() => loadLoginAudits('replace')}
              aria-label="Refresh login audits"
              className="p-2 text-gray-400 hover:text-white transition"
              title={'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c'}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <select
              value={loginAuditStatus}
              onChange={(e) => setLoginAuditStatus(e.target.value as 'all' | 'success' | 'failure')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
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
                className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder={'\u041f\u043e\u0438\u0441\u043a \u043f\u043e email \u0438\u043b\u0438 \u0438\u043c\u0435\u043d\u0438'}
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
              {'\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c'}
            </button>
          </div>

          {loginAuditSummary.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {loginAuditSummary.map((day) => (
                <div
                  key={day.date}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="text-xs text-gray-400">{formatSummaryDate(day.date)}</div>
                  <div className="text-sm text-white">
                    {day.success} {'\u0443\u0441\u043f\u0435\u0448\u043d\u043e'}
                  </div>
                  <div className="text-xs text-red-400">
                    {day.failure} {'\u043e\u0448\u0438\u0431\u043e\u043a'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loginAuditLoading && loginAudits.length === 0 ? (
            <div className="text-xs text-gray-500">{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...'}</div>
          ) : loginAudits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\u0414\u0430\u0442\u0430'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\u041f\u0440\u0438\u0447\u0438\u043d\u0430'}</th>
                  </tr>
                </thead>
                <tbody>
                  {loginAudits.map((event) => {
                    const displayName =
                      event.user?.name || event.user?.email || event.email
                    return (
                      <tr key={event.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
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
            <div className="text-xs text-gray-500">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445'} </div>
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
                    {'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...'}
                  </span>
                ) : (
                  '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0435'
                )}
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
