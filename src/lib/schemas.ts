import { z } from 'zod'
import type { LetterStatus } from '@prisma/client'

// ==================== COMMON ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
})

export const idParamSchema = z.object({
  id: z.string().cuid(),
})

// ==================== LETTER ====================

const letterStatuses: [LetterStatus, ...LetterStatus[]] = [
  'NOT_REVIEWED',
  'ACCEPTED',
  'IN_PROGRESS',
  'CLARIFICATION',
  'READY',
  'DONE',
]

export const letterStatusSchema = z.enum(letterStatuses)

export const createLetterSchema = z.object({
  number: z
    .string()
    .min(1, 'Номер письма обязателен')
    .max(50, 'Номер письма слишком длинный'),
  org: z
    .string()
    .min(1, 'Организация обязательна')
    .max(500, 'Название организации слишком длинное'),
  date: z.string().transform((val) => new Date(val)),
  deadlineDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  type: z.string().max(100).optional(),
  content: z.string().max(10000).optional(),
  comment: z.string().max(5000).optional(),
  contacts: z.string().max(500).optional(),
  jiraLink: z.string().url().max(500).optional().or(z.literal('')),
  ownerId: z.string().cuid().optional(),
  applicantName: z.string().max(200).optional(),
  applicantEmail: z.string().email().max(320).optional().or(z.literal('')),
  applicantPhone: z.string().max(50).optional(),
  applicantTelegramChatId: z.string().max(50).optional(),
})

export const updateLetterSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.null()]),
})

export const letterFiltersSchema = z.object({
  status: z.union([letterStatusSchema, z.literal('all')]).optional(),
  owner: z.string().cuid().optional(),
  type: z.string().optional(),
  search: z.string().max(200).optional(),
  filter: z.enum(['overdue', 'urgent', 'done', 'active', 'favorites']).optional(),
  sortBy: z.enum(['created', 'deadline', 'date', 'priority', 'status', 'number', 'org']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const bulkLetterSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  action: z.enum(['delete', 'changeStatus', 'changeOwner']),
  status: letterStatusSchema.optional(),
  ownerId: z.string().cuid().optional(),
})

// ==================== COMMENT ====================

export const createCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'Текст комментария обязателен')
    .max(5000, 'Комментарий слишком длинный'),
  parentId: z.string().cuid().optional(),
})

// ==================== USER ====================

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']).optional(),
  canLogin: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyTelegram: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  telegramChatId: z.string().max(50).optional().nullable(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  digestFrequency: z.enum(['NONE', 'DAILY', 'WEEKLY']).optional(),
})

export const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
  skills: z.array(z.string().max(50)).max(20).optional(),
  publicEmail: z.boolean().optional(),
  publicPhone: z.boolean().optional(),
  publicBio: z.boolean().optional(),
  publicPosition: z.boolean().optional(),
  publicDepartment: z.boolean().optional(),
  publicLocation: z.boolean().optional(),
  publicTimezone: z.boolean().optional(),
  publicSkills: z.boolean().optional(),
  publicLastLogin: z.boolean().optional(),
  publicProfileEnabled: z.boolean().optional(),
  visibility: z.enum(['INTERNAL', 'PRIVATE']).optional(),
})

// ==================== TEMPLATE ====================

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  content: z.string().min(1, 'Содержание обязательно').max(10000),
  category: z.string().max(50).optional(),
  isPublic: z.boolean().default(false),
})

export const updateTemplateSchema = createTemplateSchema.partial()

// ==================== SYNC ====================

export const syncSchema = z.object({
  direction: z.enum(['to_sheets', 'from_sheets']),
})

// ==================== TYPES ====================

export type CreateLetterInput = z.infer<typeof createLetterSchema>
export type UpdateLetterInput = z.infer<typeof updateLetterSchema>
export type LetterFiltersInput = z.infer<typeof letterFiltersSchema>
export type BulkLetterInput = z.infer<typeof bulkLetterSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
