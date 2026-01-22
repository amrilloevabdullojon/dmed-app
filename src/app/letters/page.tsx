import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import { letterFiltersSchema, paginationSchema } from '@/lib/schemas'
import type { LetterFiltersInput, PaginationInput } from '@/lib/schemas'
import LettersPageClient from './LettersPageClient'
import { buildLettersParams, getLettersListCached } from '@/lib/list-cache'
import type { LetterStatus } from '@/types/prisma'

const lettersQuerySchema = paginationSchema.merge(letterFiltersSchema)

type SearchParams = Record<string, string | string[] | undefined>
type PageProps = { searchParams?: Promise<SearchParams> }
type SortField = NonNullable<LetterFiltersInput['sortBy']>
type SortOrder = NonNullable<LetterFiltersInput['sortOrder']>

type InitialFilters = {
  page: number
  limit: number
  status: LetterStatus | 'all'
  quickFilter: string
  owner: string
  type: string
  sortBy: SortField
  sortOrder: SortOrder
  search: string
}

function parseSearchParams(searchParams: SearchParams): {
  filters: LetterFiltersInput
  pagination: PaginationInput
} {
  const raw: Record<string, string> = {}
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0 && value[value.length - 1] !== undefined) {
        raw[key] = value[value.length - 1] as string
      }
      return
    }
    if (typeof value === 'string') {
      raw[key] = value
    }
  })

  const parsed = lettersQuerySchema.safeParse(raw)
  if (!parsed.success) {
    const defaults = lettersQuerySchema.parse({})
    const { page, limit, ...filters } = defaults
    return { filters, pagination: { page, limit } }
  }

  const { page, limit, ...filters } = parsed.data
  return { filters, pagination: { page, limit } }
}

function buildInitialFilters(
  filters: LetterFiltersInput,
  pagination: PaginationInput
): InitialFilters {
  return {
    page: pagination.page ?? 1,
    limit: pagination.limit ?? 50,
    status: filters.status ?? 'all',
    quickFilter: filters.filter ?? '',
    owner: filters.owner ?? '',
    type: filters.type ?? '',
    sortBy: filters.sortBy ?? 'created',
    sortOrder: filters.sortOrder ?? 'desc',
    search: filters.search ?? '',
  }
}

export default async function LettersPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  if (!hasPermission(session.user.role, 'VIEW_LETTERS')) {
    redirect('/')
  }

  const { filters, pagination } = parseSearchParams(resolvedSearchParams)
  const list = await getLettersListCached(filters, pagination, session)
  const initialFilters = buildInitialFilters(filters, pagination)

  const canManageUsers = hasPermission(session.user.role, 'MANAGE_USERS')
  let users: Array<{ id: string; name: string | null; email: string | null }> = []

  if (canManageUsers) {
    const cachedUsers = await cache.get<typeof users>(CACHE_KEYS.USERS)
    if (cachedUsers) {
      users = cachedUsers
    } else {
      users = await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: 'desc' },
      })
      await cache.set(CACHE_KEYS.USERS, users, CACHE_TTL.USERS)
    }
  }

  const letters = list.letters.map((letter) => ({
    ...letter,
    date: letter.date.toISOString(),
    deadlineDate: letter.deadlineDate.toISOString(),
  }))

  const initialCacheKey = buildLettersParams(filters, pagination).toString()

  return (
    <LettersPageClient
      initialData={{
        letters,
        pagination: list.pagination,
        users,
        filters: initialFilters,
        canManageUsers,
        initialCacheKey,
      }}
    />
  )
}
