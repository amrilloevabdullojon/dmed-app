import type { LetterStatus, Role } from '@prisma/client'

// ==================== USER ====================

export interface UserSummary {
  id: string
  name: string | null
  email: string | null
  image?: string | null
}

export interface UserWithRole extends UserSummary {
  role: Role
}

// ==================== LETTER ====================

export interface CreateLetterDTO {
  number: string
  org: string
  date: Date
  deadlineDate?: Date | null
  type?: string
  content?: string
  comment?: string
  contacts?: string
  jiraLink?: string
  ownerId?: string
  applicantName?: string
  applicantEmail?: string
  applicantPhone?: string
  applicantTelegramChatId?: string
}

export interface UpdateLetterDTO {
  field: string
  value: string | null
}

export interface LetterSummary {
  id: string
  number: string
  org: string
  date: Date
  deadlineDate: Date
  status: LetterStatus
  type: string | null
  content: string | null
  priority: number
  owner: UserSummary | null
  _count: {
    comments: number
    watchers: number
  }
}

export interface LetterDetail extends Omit<LetterSummary, '_count'> {
  comment: string | null
  contacts: string | null
  jiraLink: string | null
  zordoc: string | null
  answer: string | null
  sendStatus: string | null
  ijroDate: Date | null
  closeDate: Date | null
  applicantName: string | null
  applicantEmail: string | null
  applicantPhone: string | null
  applicantTelegramChatId: string | null
  applicantAccessToken: string | null
  applicantAccessTokenExpiresAt: Date | null
  files: FileInfo[]
  comments: CommentInfo[]
  history: HistoryInfo[]
  isWatching: boolean
  isFavorite: boolean
}

// ==================== FILE ====================

export interface FileInfo {
  id: string
  name: string
  url: string
  size: number | null
  mimeType: string | null
  status: string | null
  uploadError: string | null
}

// ==================== COMMENT ====================

export interface CommentInfo {
  id: string
  text: string
  createdAt: Date
  author: UserSummary
  replies?: CommentInfo[]
}

// ==================== HISTORY ====================

export interface HistoryInfo {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: Date
  user: UserSummary
}

// ==================== PAGINATION ====================

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

// ==================== FILTERS ====================

export interface LetterFilters {
  status?: LetterStatus | 'all'
  owner?: string
  type?: string
  search?: string
  filter?: 'overdue' | 'urgent' | 'done' | 'active' | 'favorites'
  sortBy?: 'created' | 'deadline' | 'date' | 'priority' | 'status' | 'number' | 'org'
  sortOrder?: 'asc' | 'desc'
}

// ==================== API RESPONSES ====================

export interface SuccessResponse<T = unknown> {
  success: true
  data?: T
}

export interface ErrorResponse {
  success?: false
  error: string
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse
