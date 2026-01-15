'use client'

import { useCallback, useMemo } from 'react'
import { useFetch, useMutation } from '@/hooks/useFetch'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeNotificationSettings,
  NotificationSettings,
} from '@/lib/notification-settings'
import { useToast } from '@/components/Toast'

type SettingsResponse = { settings?: NotificationSettings }

const hasSettingsPayload = (value: unknown): value is SettingsResponse =>
  !!value && typeof value === 'object' && 'settings' in value

const normalizeResponse = (data: unknown) =>
  normalizeNotificationSettings(
    hasSettingsPayload(data) ? data.settings : (data as NotificationSettings | undefined)
  )

export const useNotificationSettings = () => {
  const toast = useToast()

  const settingsQuery = useFetch<NotificationSettings>('/api/notification-settings', {
    transform: normalizeResponse,
    initialData: DEFAULT_NOTIFICATION_SETTINGS,
  })

  const updateMutation = useMutation<NotificationSettings, { settings: NotificationSettings }>(
    '/api/notification-settings',
    {
      method: 'PUT',
      transform: normalizeResponse,
    }
  )

  const updateSettings = useCallback(
    async (patch: Partial<NotificationSettings>) => {
      const previous = settingsQuery.data ?? DEFAULT_NOTIFICATION_SETTINGS
      const next = normalizeNotificationSettings({ ...previous, ...patch })
      settingsQuery.mutate(next)
      const result = await updateMutation.mutate({ settings: next })
      if (!result) {
        settingsQuery.mutate(previous)
        toast.error('Не удалось сохранить настройки')
      }
    },
    [settingsQuery, updateMutation, toast]
  )

  return useMemo(
    () => ({
      settings: settingsQuery.data ?? DEFAULT_NOTIFICATION_SETTINGS,
      isLoading: settingsQuery.isLoading,
      isSaving: updateMutation.isLoading,
      updateSettings,
      refetch: settingsQuery.refetch,
    }),
    [
      settingsQuery.data,
      settingsQuery.isLoading,
      updateMutation.isLoading,
      updateSettings,
      settingsQuery.refetch,
    ]
  )
}
