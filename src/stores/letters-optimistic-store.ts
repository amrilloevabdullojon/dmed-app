/**
 * Optimistic Letters Store
 *
 * Продвинутый store с optimistic updates для писем
 * Интегрируется с tRPC для мгновенного отклика UI
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

type LetterStatus = 'NOT_REVIEWED' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED'

interface Letter {
  id: string
  number: string
  org: string
  status: LetterStatus
  priority: number
  assignedToId?: string | null
  updatedAt: Date
}

interface OptimisticUpdate {
  id: string
  type: 'status' | 'priority' | 'assign'
  originalValue: any
  newValue: any
  timestamp: number
}

interface LettersOptimisticState {
  // Локальный кеш писем
  letters: Map<string, Letter>

  // Optimistic updates в процессе
  pendingUpdates: Map<string, OptimisticUpdate>

  // Filters
  filters: {
    status?: LetterStatus
    assignedToId?: string
    search?: string
  }

  // Actions
  addLetter: (letter: Letter) => void
  updateLetter: (id: string, updates: Partial<Letter>) => void
  removeLetter: (id: string) => void

  // Optimistic updates
  optimisticUpdateStatus: (id: string, status: LetterStatus) => void
  optimisticUpdatePriority: (id: string, priority: number) => void
  optimisticAssign: (id: string, assignedToId: string | null) => void

  // Rollback optimistic update on error
  rollbackUpdate: (updateId: string) => void
  confirmUpdate: (updateId: string) => void

  // Filters
  setFilters: (filters: Partial<LettersOptimisticState['filters']>) => void
  clearFilters: () => void

  // Getters
  getLetter: (id: string) => Letter | undefined
  getFilteredLetters: () => Letter[]
  getPendingUpdatesCount: () => number
}

export const useLettersOptimisticStore = create<LettersOptimisticState>()(
  devtools(
    persist(
      immer((set, get) => ({
        letters: new Map(),
        pendingUpdates: new Map(),
        filters: {},

        // Add letter
        addLetter: (letter) =>
          set((state) => {
            state.letters.set(letter.id, letter)
          }),

        // Update letter
        updateLetter: (id, updates) =>
          set((state) => {
            const letter = state.letters.get(id)
            if (letter) {
              state.letters.set(id, { ...letter, ...updates, updatedAt: new Date() })
            }
          }),

        // Remove letter
        removeLetter: (id) =>
          set((state) => {
            state.letters.delete(id)
          }),

        // Optimistic status update
        optimisticUpdateStatus: (id, status) =>
          set((state) => {
            const letter = state.letters.get(id)
            if (!letter) return

            // Сохранить оригинальное значение для rollback
            const updateId = `${id}-status-${Date.now()}`
            state.pendingUpdates.set(updateId, {
              id: updateId,
              type: 'status',
              originalValue: letter.status,
              newValue: status,
              timestamp: Date.now(),
            })

            // Применить изменение немедленно
            letter.status = status
            letter.updatedAt = new Date()
          }),

        // Optimistic priority update
        optimisticUpdatePriority: (id, priority) =>
          set((state) => {
            const letter = state.letters.get(id)
            if (!letter) return

            const updateId = `${id}-priority-${Date.now()}`
            state.pendingUpdates.set(updateId, {
              id: updateId,
              type: 'priority',
              originalValue: letter.priority,
              newValue: priority,
              timestamp: Date.now(),
            })

            letter.priority = priority
            letter.updatedAt = new Date()
          }),

        // Optimistic assign
        optimisticAssign: (id, assignedToId) =>
          set((state) => {
            const letter = state.letters.get(id)
            if (!letter) return

            const updateId = `${id}-assign-${Date.now()}`
            state.pendingUpdates.set(updateId, {
              id: updateId,
              type: 'assign',
              originalValue: letter.assignedToId,
              newValue: assignedToId,
              timestamp: Date.now(),
            })

            letter.assignedToId = assignedToId
            letter.updatedAt = new Date()
          }),

        // Rollback update on error
        rollbackUpdate: (updateId) =>
          set((state) => {
            const update = state.pendingUpdates.get(updateId)
            if (!update) return

            // Extract letter ID from update ID
            const letterId = updateId.split('-')[0]
            const letter = state.letters.get(letterId)
            if (!letter) return

            // Rollback to original value
            switch (update.type) {
              case 'status':
                letter.status = update.originalValue
                break
              case 'priority':
                letter.priority = update.originalValue
                break
              case 'assign':
                letter.assignedToId = update.originalValue
                break
            }

            state.pendingUpdates.delete(updateId)
          }),

        // Confirm successful update
        confirmUpdate: (updateId) =>
          set((state) => {
            state.pendingUpdates.delete(updateId)
          }),

        // Filters
        setFilters: (filters) =>
          set((state) => {
            state.filters = { ...state.filters, ...filters }
          }),

        clearFilters: () =>
          set((state) => {
            state.filters = {}
          }),

        // Getters
        getLetter: (id) => {
          return get().letters.get(id)
        },

        getFilteredLetters: () => {
          const { letters, filters } = get()
          let result = Array.from(letters.values())

          if (filters.status) {
            result = result.filter((l) => l.status === filters.status)
          }

          if (filters.assignedToId) {
            result = result.filter((l) => l.assignedToId === filters.assignedToId)
          }

          if (filters.search) {
            const search = filters.search.toLowerCase()
            result = result.filter(
              (l) =>
                l.number.toLowerCase().includes(search) ||
                l.org.toLowerCase().includes(search)
            )
          }

          return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        },

        getPendingUpdatesCount: () => {
          return get().pendingUpdates.size
        },
      })),
      {
        name: 'letters-optimistic-storage',
        // Не сохранять pendingUpdates в localStorage
        partialize: (state) => ({
          letters: Array.from(state.letters.entries()),
          filters: state.filters,
        }),
        // Восстановить Map из массива
        onRehydrateStorage: () => (state) => {
          if (state && Array.isArray(state.letters)) {
            state.letters = new Map(state.letters as any)
          }
        },
      }
    ),
    {
      name: 'letters-optimistic-store',
    }
  )
)

// Селекторы
export const useFilteredLetters = () =>
  useLettersOptimisticStore((state) => state.getFilteredLetters())

export const usePendingUpdatesCount = () =>
  useLettersOptimisticStore((state) => state.getPendingUpdatesCount())

export const useLetterFilters = () =>
  useLettersOptimisticStore((state) => state.filters)
