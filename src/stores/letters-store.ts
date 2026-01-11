/**
 * Letters Store - Zustand store для работы с письмами
 *
 * Используется для:
 * - Управление выбранными письмами (bulk operations)
 * - Drag & drop состояние
 * - Временные данные форм (autosave)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface LetterDraft {
  number: string
  org: string
  content: string
  [key: string]: any
}

interface LettersState {
  // Selected letters для bulk operations
  selectedLetterIds: Set<string>
  selectLetter: (id: string) => void
  deselectLetter: (id: string) => void
  toggleLetter: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean

  // Drag & Drop
  draggedLetterId: string | null
  setDraggedLetterId: (id: string | null) => void

  // Draft autosave
  letterDraft: LetterDraft | null
  setLetterDraft: (draft: LetterDraft | null) => void
  clearLetterDraft: () => void

  // View mode
  viewMode: 'list' | 'kanban' | 'table'
  setViewMode: (mode: 'list' | 'kanban' | 'table') => void
}

export const useLettersStore = create<LettersState>()(
  devtools(
    (set, get) => ({
      // Selected letters
      selectedLetterIds: new Set(),
      selectLetter: (id) =>
        set((state) => ({
          selectedLetterIds: new Set([...state.selectedLetterIds, id]),
        })),
      deselectLetter: (id) =>
        set((state) => {
          const newSet = new Set(state.selectedLetterIds)
          newSet.delete(id)
          return { selectedLetterIds: newSet }
        }),
      toggleLetter: (id) => {
        const { selectedLetterIds } = get()
        if (selectedLetterIds.has(id)) {
          get().deselectLetter(id)
        } else {
          get().selectLetter(id)
        }
      },
      selectAll: (ids) =>
        set({
          selectedLetterIds: new Set(ids),
        }),
      clearSelection: () =>
        set({
          selectedLetterIds: new Set(),
        }),
      isSelected: (id) => get().selectedLetterIds.has(id),

      // Drag & Drop
      draggedLetterId: null,
      setDraggedLetterId: (id) => set({ draggedLetterId: id }),

      // Draft
      letterDraft: null,
      setLetterDraft: (draft) => set({ letterDraft: draft }),
      clearLetterDraft: () => set({ letterDraft: null }),

      // View mode
      viewMode: 'list',
      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: 'letters-store',
    }
  )
)

// Селекторы
export const useSelectedLetterIds = () =>
  useLettersStore((state) => state.selectedLetterIds)
export const useSelectedCount = () =>
  useLettersStore((state) => state.selectedLetterIds.size)
export const useViewMode = () => useLettersStore((state) => state.viewMode)
export const useDraggedLetterId = () =>
  useLettersStore((state) => state.draggedLetterId)
