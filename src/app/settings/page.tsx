'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useCallback, useEffect, useState } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: 'EMPLOYEE' | 'ADMIN'
  canLogin: boolean
  telegramChatId: string | null
  createdAt: string
  _count: {
    letters: number
    comments: number
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
    role: 'EMPLOYEE' | 'ADMIN'
    telegramChatId: string
  }>({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
  const [createData, setCreateData] = useState<{
    name: string
    email: string
    role: 'EMPLOYEE' | 'ADMIN'
    telegramChatId: string
  }>({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (authStatus === 'authenticated') {
      if (session?.user.role !== 'ADMIN') {
        router.push('/letters')
      } else {
        loadUsers()
        loadSyncLogs()
      }
    }
  }, [authStatus, session, router, loadUsers, loadSyncLogs])

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditData({
      name: user.name || '',
      email: user.email || '',
      role: user.role,
      telegramChatId: user.telegramChatId || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({ name: '', email: '', role: 'EMPLOYEE', telegramChatId: '' })
  }

  const saveUser = async () => {
    if (!editingId) return

    setSaving(true)
    try {
      const res = await fetch(`/api/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (res.ok) {
        toast.success('Пользователь сохранён')
        await loadUsers()
        cancelEdit()
      } else {
        toast.error('Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Failed to save user:', error)
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

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
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Пользователь удалён')
        await loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Ошибка при удалении')
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.error('Ошибка при удалении')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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

  if (!session || session.user.role !== 'ADMIN') {
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
                placeholder={'\u0418\u043c\u044f'}
              />
              <input
                type="email"
                value={createData.email}
                onChange={(e) =>
                  setCreateData({ ...createData, email: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="email@example.com"
              />
              <select
                value={createData.role}
                onChange={(e) =>
                  setCreateData({
                    ...createData,
                    role: e.target.value as 'EMPLOYEE' | 'ADMIN',
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="EMPLOYEE">{'\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a'}</option>
                <option value="ADMIN">{'\u0410\u0434\u043c\u0438\u043d'}</option>
              </select>
              <input
                type="text"
                value={createData.telegramChatId}
                onChange={(e) =>
                  setCreateData({ ...createData, telegramChatId: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
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

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Пользователь</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Роль</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{'\u0414\u043e\u0441\u0442\u0443\u043f'}</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Telegram</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Статистика</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    
                    <td className="py-3 px-4">
                      {editingId === user.id ? (
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="Имя"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <Image
                              src={user.image}
                              alt={user.name || user.email || 'User'}
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-full"
                              unoptimized
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                              <span className="text-gray-400 text-sm">
                                {(user.name || user.email || '?')[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-white">
                            {user.name || 'Без имени'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingId === user.id ? (
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) =>
                            setEditData({ ...editData, email: e.target.value })
                          }
                          className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="email@example.com"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Mail className="w-4 h-4" />
                          {user.email || '-'}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingId === user.id ? (
                        <select
                          value={editData.role}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              role: e.target.value as 'EMPLOYEE' | 'ADMIN',
                            })
                          }
                          className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                        >
                          <option value="EMPLOYEE">Пользователь</option>
                          <option value="ADMIN">Администратор</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                            user.role === 'ADMIN'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {user.role === 'ADMIN' ? 'Админ' : 'Пользователь'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.role === 'ADMIN' || user.canLogin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          {'\u041e\u0442\u043a\u0440\u044b\u0442'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                          <XCircle className="w-3 h-3" />
                          {'\u0417\u0430\u043a\u0440\u044b\u0442'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingId === user.id ? (
                        <input
                          type="text"
                          value={editData.telegramChatId}
                          onChange={(e) =>
                            setEditData({ ...editData, telegramChatId: e.target.value })
                          }
                          className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="Chat ID"
                        />
                      ) : user.telegramChatId ? (
                        <div className="flex items-center gap-2 text-blue-400">
                          <MessageSquare className="w-4 h-4" />
                          {user.telegramChatId}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {user._count.letters}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {user._count.comments}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === user.id ? (
                          <>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="p-2 text-gray-400 hover:text-white transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={saveUser}
                              disabled={saving}
                              className="p-2 text-emerald-400 hover:text-emerald-300 transition"
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(user)}
                              className="p-2 text-gray-400 hover:text-white transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {user.id !== session.user.id && (
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="p-2 text-gray-400 hover:text-red-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Нет пользователей
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
