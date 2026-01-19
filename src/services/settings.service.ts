import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { randomUUID } from 'crypto'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeNotificationSettings,
  type NotificationSettings,
  type NotificationMatrixItem,
  type NotificationSubscription,
} from '@/lib/notification-settings'
import type {
  Prisma,
  DigestFrequency,
  Role,
  UserProfile,
  UserPreferences,
  SettingsEntity,
  SettingsAction,
  ThemeMode,
  UIDensity,
  WallpaperStyle,
} from '@prisma/client'

/**
 * Settings Service - Централизованный сервис для работы с настройками пользователей
 *
 * Функции:
 * - Управление профилем пользователя
 * - Управление персонализацией (theme, language, animations)
 * - Управление настройками уведомлений
 * - Генерация публичных профилей
 */

export class SettingsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'SettingsServiceError'
  }
}

// ==================== PROFILE TYPES ====================

const emptyProfile = {
  bio: null,
  phone: null,
  position: null,
  department: null,
  location: null,
  timezone: null,
  skills: [] as string[],
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
  visibility: 'INTERNAL' as const,
}

export type ProfileUpdateInput = Partial<{
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
}>

export type ProfileData = UserProfile & {
  avatarUrl: string | null
  coverUrl: string | null
}

export type ProfileActivity = {
  letters: Array<{
    id: string
    number: string
    org: string | null
    status: string
    updatedAt: Date
  }>
  comments: Array<{
    id: string
    text: string
    createdAt: Date
    letter: {
      id: string
      number: string
      org: string | null
    }
  }>
  assignments: Array<{
    id: string
    createdAt: Date
    user: {
      id: string
      name: string | null
      email: string | null
    }
    letter: {
      id: string
      number: string
      org: string | null
    }
  }>
}

export type FullProfileData = {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: Role
    lastLoginAt: Date | null
    _count: {
      letters: number
      comments: number
      sessions: number
    }
  }
  profile: ProfileData
  activity: ProfileActivity
}

// ==================== PREFERENCES TYPES ====================

export type PreferencesUpdateInput = Partial<{
  theme: ThemeMode | 'SYSTEM'
  language: string
  density: UIDensity
  animations: boolean
  backgroundAnimations: boolean
  pageTransitions: boolean
  microInteractions: boolean
  listAnimations: boolean
  modalAnimations: boolean
  scrollAnimations: boolean
  wallpaperStyle: WallpaperStyle
  wallpaperIntensity: number
  snowfall: boolean
  particles: boolean
  soundNotifications: boolean
  desktopNotifications: boolean
}>

// ==================== NOTIFICATION SETTINGS TYPES ====================

export type NotificationSettingsUpdateInput = Partial<NotificationSettings>

// ==================== HELPER FUNCTIONS ====================

const normalizeOptional = (value: unknown) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

const parseSkills = (value: unknown) => {
  if (!value) return []
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const unique = new Set(raw.map((item) => String(item).trim()).filter((item) => item.length > 0))
  return Array.from(unique)
}

const mapDigestFrequency = (digest: NotificationSettings['emailDigest']): DigestFrequency => {
  if (digest === 'daily') return 'DAILY'
  if (digest === 'weekly') return 'WEEKLY'
  return 'NONE'
}

type PreferencesUpdateData = Partial<
  Pick<
    UserPreferences,
    | 'theme'
    | 'language'
    | 'density'
    | 'animations'
    | 'backgroundAnimations'
    | 'pageTransitions'
    | 'microInteractions'
    | 'listAnimations'
    | 'modalAnimations'
    | 'scrollAnimations'
    | 'wallpaperStyle'
    | 'wallpaperIntensity'
    | 'snowfall'
    | 'particles'
    | 'soundNotifications'
    | 'desktopNotifications'
  >
>

const normalizeThemeMode = (theme: PreferencesUpdateInput['theme']): ThemeMode | undefined => {
  if (!theme) return undefined
  return theme === 'SYSTEM' ? 'AUTO' : theme
}

const normalizePreferencesUpdates = (updates: PreferencesUpdateInput): PreferencesUpdateData => {
  const data: PreferencesUpdateData = {}
  const theme = normalizeThemeMode(updates.theme)
  if (theme) data.theme = theme
  if (typeof updates.language === 'string') data.language = updates.language
  if (updates.density) data.density = updates.density
  if (typeof updates.animations === 'boolean') data.animations = updates.animations
  if (typeof updates.backgroundAnimations === 'boolean') {
    data.backgroundAnimations = updates.backgroundAnimations
  }
  if (typeof updates.pageTransitions === 'boolean') data.pageTransitions = updates.pageTransitions
  if (typeof updates.microInteractions === 'boolean')
    data.microInteractions = updates.microInteractions
  if (typeof updates.listAnimations === 'boolean') data.listAnimations = updates.listAnimations
  if (typeof updates.modalAnimations === 'boolean') data.modalAnimations = updates.modalAnimations
  if (typeof updates.scrollAnimations === 'boolean')
    data.scrollAnimations = updates.scrollAnimations
  if (updates.wallpaperStyle) data.wallpaperStyle = updates.wallpaperStyle
  if (typeof updates.wallpaperIntensity === 'number') {
    data.wallpaperIntensity = updates.wallpaperIntensity
  }
  if (typeof updates.snowfall === 'boolean') data.snowfall = updates.snowfall
  if (typeof updates.particles === 'boolean') data.particles = updates.particles
  if (typeof updates.soundNotifications === 'boolean') {
    data.soundNotifications = updates.soundNotifications
  }
  if (typeof updates.desktopNotifications === 'boolean') {
    data.desktopNotifications = updates.desktopNotifications
  }
  return data
}

const buildActivity = async (userId: string): Promise<ProfileActivity> => {
  const [letters, comments, assignments] = await Promise.all([
    prisma.letter.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: {
        id: true,
        number: true,
        org: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.comment.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        text: true,
        createdAt: true,
        letter: {
          select: { id: true, number: true, org: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.history.findMany({
      where: { field: 'owner', newValue: userId },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        letter: { select: { id: true, number: true, org: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return { letters, comments, assignments }
}

// ==================== HISTORY TRACKING ====================

/**
 * Вычислить разницу между двумя объектами
 */
function calculateDiff(
  before: unknown,
  after: unknown
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {}

  if (!before || typeof before !== 'object') {
    return diff
  }
  if (!after || typeof after !== 'object') {
    return diff
  }

  const beforeObj = before as Record<string, unknown>
  const afterObj = after as Record<string, unknown>

  // Проверяем все ключи из after
  for (const key in afterObj) {
    if (beforeObj[key] !== afterObj[key]) {
      diff[key] = {
        old: beforeObj[key],
        new: afterObj[key],
      }
    }
  }

  return diff
}

/**
 * Создать запись в истории настроек
 */
async function createHistoryEntry(
  userId: string,
  entityType: SettingsEntity,
  entityId: string,
  action: SettingsAction,
  before: unknown,
  after: unknown,
  changedBy?: string
): Promise<void> {
  try {
    const diff = calculateDiff(before, after)

    await prisma.settingsHistory.create({
      data: {
        userId,
        entityType,
        entityId,
        action,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
        diff: diff as unknown as Prisma.InputJsonValue,
        changedBy,
      },
    })

    logger.info('settings.service', 'History entry created', {
      userId,
      entityType,
      action,
      changedBy,
    })
  } catch (error) {
    // Не выбрасываем ошибку, чтобы не ломать основной флоу
    logger.error('settings.service', 'Failed to create history entry', {
      error,
      userId,
      entityType,
      action,
    })
  }
}

// ==================== SETTINGS SERVICE ====================

export class SettingsService {
  // ==================== PROFILE METHODS ====================

  /**
   * Получить профиль пользователя со всеми данными
   *
   * @example
   * const profile = await SettingsService.getProfile('user1')
   */
  static async getProfile(userId: string): Promise<FullProfileData> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          lastLoginAt: true,
          _count: {
            select: {
              letters: true,
              comments: true,
              sessions: true,
            },
          },
          profile: true,
        },
      })

      if (!user) {
        throw new SettingsServiceError('Пользователь не найден', 'NOT_FOUND', 404)
      }

      const activity = await buildActivity(user.id)

      const profile = user.profile ?? emptyProfile
      const profileUpdatedAt = user.profile?.updatedAt ?? null
      const normalizedProfile: ProfileData = {
        ...profile,
        avatarUrl: resolveProfileAssetUrl(profile.avatarUrl, profileUpdatedAt),
        coverUrl: resolveProfileAssetUrl(profile.coverUrl, profileUpdatedAt),
      } as ProfileData

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
          _count: user._count,
        },
        profile: normalizedProfile,
        activity,
      }
    } catch (error) {
      if (error instanceof SettingsServiceError) {
        throw error
      }
      logger.error('settings.service', error, { userId })
      throw new SettingsServiceError('Ошибка при получении профиля', 'FETCH_FAILED', 500)
    }
  }

  /**
   * Обновить профиль пользователя
   *
   * @example
   * const profile = await SettingsService.updateProfile('user1', {
   *   bio: 'Software Developer',
   *   skills: ['JavaScript', 'TypeScript']
   * })
   */
  static async updateProfile(
    userId: string,
    updates: ProfileUpdateInput,
    changedBy?: string
  ): Promise<ProfileData> {
    try {
      // Get current profile for history
      const before = await prisma.userProfile.findUnique({
        where: { userId },
      })

      const data: ProfileUpdateInput = {}

      // Normalize string fields
      if ('bio' in updates) data.bio = normalizeOptional(updates.bio)
      if ('phone' in updates) data.phone = normalizeOptional(updates.phone)
      if ('position' in updates) data.position = normalizeOptional(updates.position)
      if ('department' in updates) data.department = normalizeOptional(updates.department)
      if ('location' in updates) data.location = normalizeOptional(updates.location)
      if ('timezone' in updates) data.timezone = normalizeOptional(updates.timezone)
      if ('skills' in updates) data.skills = parseSkills(updates.skills)
      if ('avatarUrl' in updates) data.avatarUrl = normalizeOptional(updates.avatarUrl)
      if ('coverUrl' in updates) data.coverUrl = normalizeOptional(updates.coverUrl)

      // Boolean fields
      if (typeof updates.publicEmail === 'boolean') data.publicEmail = updates.publicEmail
      if (typeof updates.publicPhone === 'boolean') data.publicPhone = updates.publicPhone
      if (typeof updates.publicBio === 'boolean') data.publicBio = updates.publicBio
      if (typeof updates.publicPosition === 'boolean') data.publicPosition = updates.publicPosition
      if (typeof updates.publicDepartment === 'boolean') {
        data.publicDepartment = updates.publicDepartment
      }
      if (typeof updates.publicLocation === 'boolean') data.publicLocation = updates.publicLocation
      if (typeof updates.publicTimezone === 'boolean') data.publicTimezone = updates.publicTimezone
      if (typeof updates.publicSkills === 'boolean') data.publicSkills = updates.publicSkills
      if (typeof updates.publicLastLogin === 'boolean') {
        data.publicLastLogin = updates.publicLastLogin
      }
      if (typeof updates.publicProfileEnabled === 'boolean') {
        data.publicProfileEnabled = updates.publicProfileEnabled
      }

      // Visibility
      if (updates.visibility === 'INTERNAL' || updates.visibility === 'PRIVATE') {
        data.visibility = updates.visibility
      }

      const profile = await prisma.userProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...emptyProfile,
          ...data,
          publicProfileToken:
            data.publicProfileToken || (data.publicProfileEnabled ? randomUUID() : null),
        },
      })

      // Create history entry
      await createHistoryEntry(
        userId,
        'PROFILE',
        profile.id,
        before ? 'UPDATED' : 'CREATED',
        before,
        profile,
        changedBy
      )

      // Ensure public profile token exists if enabled
      if (data.publicProfileEnabled && !profile.publicProfileToken) {
        const updated = await prisma.userProfile.update({
          where: { id: profile.id },
          data: { publicProfileToken: randomUUID() },
        })

        logger.info('settings.service', 'Profile updated', {
          userId,
          fields: Object.keys(data),
        })

        return {
          ...updated,
          avatarUrl: resolveProfileAssetUrl(updated.avatarUrl, updated.updatedAt),
          coverUrl: resolveProfileAssetUrl(updated.coverUrl, updated.updatedAt),
        } as ProfileData
      }

      logger.info('settings.service', 'Profile updated', {
        userId,
        fields: Object.keys(data),
      })

      return {
        ...profile,
        avatarUrl: resolveProfileAssetUrl(profile.avatarUrl, profile.updatedAt),
        coverUrl: resolveProfileAssetUrl(profile.coverUrl, profile.updatedAt),
      } as ProfileData
    } catch (error) {
      logger.error('settings.service', error, { userId, updates })
      throw new SettingsServiceError('Ошибка при обновлении профиля', 'UPDATE_FAILED', 500)
    }
  }

  /**
   * Удалить asset профиля (аватар или обложку)
   *
   * @example
   * await SettingsService.deleteProfileAsset('user1', 'avatar')
   */
  static async deleteProfileAsset(userId: string, type: 'avatar' | 'cover'): Promise<void> {
    try {
      const field = type === 'avatar' ? 'avatarUrl' : 'coverUrl'

      await prisma.userProfile.update({
        where: { userId },
        data: { [field]: null },
      })

      logger.info('settings.service', 'Profile asset deleted', { userId, type })
    } catch (error) {
      logger.error('settings.service', error, { userId, type })
      throw new SettingsServiceError('Ошибка при удалении asset', 'DELETE_FAILED', 500)
    }
  }

  /**
   * Сгенерировать новый токен публичного профиля
   *
   * @example
   * const token = await SettingsService.generatePublicProfileToken('user1')
   */
  static async generatePublicProfileToken(userId: string): Promise<string> {
    try {
      const token = randomUUID()

      await prisma.userProfile.upsert({
        where: { userId },
        update: {
          publicProfileToken: token,
          publicProfileEnabled: true,
        },
        create: {
          userId,
          ...emptyProfile,
          publicProfileToken: token,
          publicProfileEnabled: true,
        },
      })

      logger.info('settings.service', 'Public profile token generated', { userId })

      return token
    } catch (error) {
      logger.error('settings.service', error, { userId })
      throw new SettingsServiceError('Ошибка при генерации токена', 'TOKEN_GENERATION_FAILED', 500)
    }
  }

  /**
   * Получить публичный профиль по токену
   *
   * @example
   * const profile = await SettingsService.getPublicProfile('token123')
   */
  static async getPublicProfile(token: string): Promise<{
    user: {
      id: string
      name: string | null
      email: string | null
      image: string | null
      lastLoginAt: Date | null
    }
    profile: Partial<ProfileData>
  } | null> {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: {
          publicProfileToken: token,
          publicProfileEnabled: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              lastLoginAt: true,
            },
          },
        },
      })

      if (!profile) {
        return null
      }

      // Filter fields based on privacy settings
      const publicProfile: Partial<ProfileData> = {}

      if (profile.publicBio && profile.bio) publicProfile.bio = profile.bio
      if (profile.publicPhone && profile.phone) publicProfile.phone = profile.phone
      if (profile.publicPosition && profile.position) publicProfile.position = profile.position
      if (profile.publicDepartment && profile.department) {
        publicProfile.department = profile.department
      }
      if (profile.publicLocation && profile.location) publicProfile.location = profile.location
      if (profile.publicTimezone && profile.timezone) publicProfile.timezone = profile.timezone
      if (profile.publicSkills && profile.skills) publicProfile.skills = profile.skills as string[]

      publicProfile.avatarUrl = resolveProfileAssetUrl(profile.avatarUrl, profile.updatedAt)
      publicProfile.coverUrl = resolveProfileAssetUrl(profile.coverUrl, profile.updatedAt)

      return {
        user: {
          id: profile.user.id,
          name: profile.user.name,
          email: profile.publicEmail ? profile.user.email : null,
          image: profile.user.image,
          lastLoginAt: profile.publicLastLogin ? profile.user.lastLoginAt : null,
        },
        profile: publicProfile,
      }
    } catch (error) {
      logger.error('settings.service', error, { token })
      throw new SettingsServiceError('Ошибка при получении публичного профиля', 'FETCH_FAILED', 500)
    }
  }

  // ==================== PREFERENCES METHODS ====================

  /**
   * Получить настройки персонализации пользователя
   *
   * @example
   * const preferences = await SettingsService.getPreferences('user1')
   */
  static async getPreferences(userId: string): Promise<UserPreferences> {
    try {
      let preferences = await prisma.userPreferences.findUnique({
        where: { userId },
      })

      // Create default preferences if not exist
      if (!preferences) {
        preferences = await prisma.userPreferences.create({
          data: {
            userId,
            theme: 'DARK',
            language: 'ru',
            density: 'COMFORTABLE',
            animations: true,
            backgroundAnimations: true,
            pageTransitions: true,
            microInteractions: true,
            listAnimations: true,
            modalAnimations: true,
            scrollAnimations: true,
            wallpaperStyle: 'AURORA',
            wallpaperIntensity: 60,
            snowfall: false,
            particles: false,
            soundNotifications: true,
            desktopNotifications: true,
          },
        })
      }

      return preferences
    } catch (error) {
      logger.error('settings.service', error, { userId })
      throw new SettingsServiceError('Ошибка при получении настроек', 'FETCH_FAILED', 500)
    }
  }

  /**
   * Обновить настройки персонализации
   *
   * @example
   * const preferences = await SettingsService.updatePreferences('user1', {
   *   theme: 'DARK',
   *   animations: true
   * })
   */
  static async updatePreferences(
    userId: string,
    updates: PreferencesUpdateInput,
    changedBy?: string
  ): Promise<UserPreferences> {
    try {
      // Get current preferences for history
      const before = await prisma.userPreferences.findUnique({
        where: { userId },
      })

      const data = normalizePreferencesUpdates(updates)
      const preferences = await prisma.userPreferences.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...data,
        },
      })

      // Create history entry
      await createHistoryEntry(
        userId,
        'PREFERENCES',
        preferences.id,
        before ? 'UPDATED' : 'CREATED',
        before,
        preferences,
        changedBy
      )

      logger.info('settings.service', 'Preferences updated', {
        userId,
        fields: Object.keys(updates),
      })

      return preferences
    } catch (error) {
      logger.error('settings.service', error, { userId, updates })
      throw new SettingsServiceError('Ошибка при обновлении настроек', 'UPDATE_FAILED', 500)
    }
  }

  /**
   * Сбросить настройки персонализации к дефолтным
   *
   * @example
   * const preferences = await SettingsService.resetPreferences('user1')
   */
  static async resetPreferences(userId: string): Promise<UserPreferences> {
    try {
      const preferences = await prisma.userPreferences.upsert({
        where: { userId },
        update: {
          theme: 'DARK',
          language: 'ru',
          density: 'COMFORTABLE',
          animations: true,
          backgroundAnimations: true,
          pageTransitions: true,
          microInteractions: true,
          listAnimations: true,
          modalAnimations: true,
          scrollAnimations: true,
          wallpaperStyle: 'AURORA',
          wallpaperIntensity: 60,
          snowfall: false,
          particles: false,
          soundNotifications: true,
          desktopNotifications: true,
        },
        create: {
          userId,
          theme: 'DARK',
          language: 'ru',
          density: 'COMFORTABLE',
          animations: true,
          backgroundAnimations: true,
          pageTransitions: true,
          microInteractions: true,
          listAnimations: true,
          modalAnimations: true,
          scrollAnimations: true,
          wallpaperStyle: 'AURORA',
          wallpaperIntensity: 60,
          snowfall: false,
          particles: false,
          soundNotifications: true,
          desktopNotifications: true,
        },
      })

      logger.info('settings.service', 'Preferences reset to defaults', { userId })

      return preferences
    } catch (error) {
      logger.error('settings.service', error, { userId })
      throw new SettingsServiceError('Ошибка при сбросе настроек', 'RESET_FAILED', 500)
    }
  }

  // ==================== NOTIFICATION SETTINGS METHODS ====================

  /**
   * Получить настройки уведомлений пользователя
   *
   * @example
   * const settings = await SettingsService.getNotificationSettings('user1')
   */
  static async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
      // Try to get from NotificationPreference table
      const preference = await prisma.notificationPreference
        .findUnique({
          where: { userId },
          select: { settings: true },
        })
        .catch(() => null)

      if (preference?.settings) {
        return normalizeNotificationSettings(preference.settings as Partial<NotificationSettings>)
      }

      // Fallback to user table
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          notifyEmail: true,
          notifyTelegram: true,
          notifySms: true,
          notifyInApp: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          digestFrequency: true,
        },
      })

      if (!user) {
        return DEFAULT_NOTIFICATION_SETTINGS
      }

      const emailDigest =
        user.digestFrequency === 'DAILY'
          ? 'daily'
          : user.digestFrequency === 'WEEKLY'
            ? 'weekly'
            : 'instant'

      return normalizeNotificationSettings({
        inAppNotifications: user.notifyInApp,
        emailNotifications: user.notifyEmail,
        telegramNotifications: user.notifyTelegram,
        smsNotifications: user.notifySms,
        emailDigest,
        quietHoursEnabled: Boolean(user.quietHoursStart && user.quietHoursEnd),
        quietHoursStart: user.quietHoursStart || DEFAULT_NOTIFICATION_SETTINGS.quietHoursStart,
        quietHoursEnd: user.quietHoursEnd || DEFAULT_NOTIFICATION_SETTINGS.quietHoursEnd,
      })
    } catch (error) {
      logger.error('settings.service', error, { userId })
      throw new SettingsServiceError(
        'Ошибка при получении настроек уведомлений',
        'FETCH_FAILED',
        500
      )
    }
  }

  /**
   * Обновить настройки уведомлений
   *
   * @example
   * const settings = await SettingsService.updateNotificationSettings('user1', {
   *   emailNotifications: true,
   *   quietHoursEnabled: true
   * })
   */
  static async updateNotificationSettings(
    userId: string,
    updates: NotificationSettingsUpdateInput,
    changedBy?: string
  ): Promise<NotificationSettings> {
    try {
      // Get current settings for history
      const before = await this.getNotificationSettings(userId)

      const nextSettings = normalizeNotificationSettings(updates)

      // Update user table
      await prisma.user.update({
        where: { id: userId },
        data: {
          notifyEmail: nextSettings.emailNotifications,
          notifyTelegram: nextSettings.telegramNotifications,
          notifySms: nextSettings.smsNotifications,
          notifyInApp: nextSettings.inAppNotifications,
          quietHoursStart: nextSettings.quietHoursEnabled ? nextSettings.quietHoursStart : null,
          quietHoursEnd: nextSettings.quietHoursEnabled ? nextSettings.quietHoursEnd : null,
          digestFrequency: mapDigestFrequency(nextSettings.emailDigest),
        },
      })

      // Update preference table
      const preference = await prisma.notificationPreference
        .upsert({
          where: { userId },
          update: { settings: nextSettings as unknown as Prisma.InputJsonValue },
          create: {
            userId,
            settings: nextSettings as unknown as Prisma.InputJsonValue,
          },
        })
        .catch((error) => {
          logger.warn('settings.service', 'NotificationPreference table missing', { error })
          return null
        })

      // Create history entry
      if (preference) {
        await createHistoryEntry(
          userId,
          'NOTIFICATIONS',
          preference.id,
          'UPDATED',
          before,
          nextSettings,
          changedBy
        )
      }

      logger.info('settings.service', 'Notification settings updated', {
        userId,
        fields: Object.keys(updates),
      })

      return nextSettings
    } catch (error) {
      logger.error('settings.service', error, { userId, updates })
      throw new SettingsServiceError(
        'Ошибка при обновлении настроек уведомлений',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Обновить матрицу уведомлений
   *
   * @example
   * await SettingsService.updateNotificationMatrix('user1', [
   *   { event: 'NEW_LETTER', channels: { inApp: true, email: true }, priority: 'normal' }
   * ])
   */
  static async updateNotificationMatrix(
    userId: string,
    matrix: NotificationMatrixItem[]
  ): Promise<void> {
    try {
      const currentSettings = await this.getNotificationSettings(userId)
      await this.updateNotificationSettings(userId, {
        ...currentSettings,
        matrix,
      })

      logger.info('settings.service', 'Notification matrix updated', { userId })
    } catch (error) {
      logger.error('settings.service', error, { userId, matrix })
      throw new SettingsServiceError(
        'Ошибка при обновлении матрицы уведомлений',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Обновить подписки на уведомления
   *
   * @example
   * await SettingsService.updateNotificationSubscriptions('user1', [
   *   { event: 'ALL', scope: 'role', value: 'ADMIN' }
   * ])
   */
  static async updateNotificationSubscriptions(
    userId: string,
    subscriptions: NotificationSubscription[]
  ): Promise<void> {
    try {
      const validRoles = new Set<Role>([
        'SUPERADMIN',
        'ADMIN',
        'MANAGER',
        'AUDITOR',
        'EMPLOYEE',
        'VIEWER',
      ])

      const normalizedSubscriptions = subscriptions
        .map((subscription) => ({
          event: subscription.event,
          scope: subscription.scope,
          value: subscription.value?.trim() || undefined,
        }))
        .filter((subscription) => {
          if (subscription.scope === 'all') return true
          if (!subscription.value) return false
          if (subscription.scope === 'role') return validRoles.has(subscription.value as Role)
          return true
        })

      // Delete existing subscriptions
      await prisma.notificationSubscription.deleteMany({ where: { userId } }).catch(() => {
        logger.warn('settings.service', 'NotificationSubscription table missing')
      })

      // Create new subscriptions
      if (normalizedSubscriptions.length > 0) {
        await prisma.notificationSubscription
          .createMany({
            data: normalizedSubscriptions.map((subscription) => ({
              userId,
              scope: subscription.scope.toUpperCase() as 'ROLE' | 'USER' | 'ALL',
              value: subscription.value ?? null,
              event: subscription.event,
            })),
          })
          .catch(() => {
            logger.warn('settings.service', 'NotificationSubscription table missing')
          })
      }

      // Also update in settings
      const currentSettings = await this.getNotificationSettings(userId)
      await this.updateNotificationSettings(userId, {
        ...currentSettings,
        subscriptions: normalizedSubscriptions,
      })

      logger.info('settings.service', 'Notification subscriptions updated', { userId })
    } catch (error) {
      logger.error('settings.service', error, { userId, subscriptions })
      throw new SettingsServiceError('Ошибка при обновлении подписок', 'UPDATE_FAILED', 500)
    }
  }

  // ==================== HISTORY METHODS ====================

  /**
   * Получить историю изменений настроек
   *
   * @example
   * const history = await SettingsService.getSettingsHistory('user1', {
   *   entityType: 'PROFILE',
   *   limit: 10
   * })
   */
  static async getSettingsHistory(
    userId: string,
    options: {
      entityType?: SettingsEntity
      limit?: number
      before?: Date
    } = {}
  ) {
    try {
      const { entityType, limit = 50, before } = options

      const history = await prisma.settingsHistory.findMany({
        where: {
          userId,
          ...(entityType && { entityType }),
          ...(before && { createdAt: { lt: before } }),
        },
        include: {
          changedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return history
    } catch (error) {
      logger.error('settings.service', error, { userId, options })
      throw new SettingsServiceError('Ошибка при получении истории настроек', 'FETCH_FAILED', 500)
    }
  }

  /**
   * Откатить настройки к версии из истории
   *
   * @example
   * await SettingsService.revertToVersion('user1', 'history123', 'admin1')
   */
  static async revertToVersion(userId: string, historyId: string, adminId?: string): Promise<void> {
    try {
      const historyEntry = await prisma.settingsHistory.findUnique({
        where: { id: historyId },
      })

      if (!historyEntry) {
        throw new SettingsServiceError('Запись в истории не найдена', 'NOT_FOUND', 404)
      }

      if (historyEntry.userId !== userId) {
        throw new SettingsServiceError(
          'Запись в истории принадлежит другому пользователю',
          'FORBIDDEN',
          403
        )
      }

      const before = historyEntry.before as unknown

      switch (historyEntry.entityType) {
        case 'PROFILE':
          if (before && typeof before === 'object') {
            await this.updateProfile(userId, before as ProfileUpdateInput, adminId)
          }
          break

        case 'PREFERENCES':
          if (before && typeof before === 'object') {
            await this.updatePreferences(userId, before as PreferencesUpdateInput, adminId)
          }
          break

        case 'NOTIFICATIONS':
          if (before && typeof before === 'object') {
            await this.updateNotificationSettings(
              userId,
              before as NotificationSettingsUpdateInput,
              adminId
            )
          }
          break

        default:
          throw new SettingsServiceError('Неизвестный тип настроек', 'INVALID_ENTITY_TYPE', 400)
      }

      logger.info('settings.service', 'Settings reverted to version', {
        userId,
        historyId,
        adminId,
      })
    } catch (error) {
      if (error instanceof SettingsServiceError) {
        throw error
      }
      logger.error('settings.service', error, { userId, historyId, adminId })
      throw new SettingsServiceError('Ошибка при откате настроек', 'REVERT_FAILED', 500)
    }
  }
}
