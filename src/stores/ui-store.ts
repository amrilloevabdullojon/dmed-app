/**
 * UI Store - Zustand store для глобального UI состояния
 *
 * Используется для:
 * - Управление темой (светлая/темная)
 * - Состояние sidebar (открыт/закрыт)
 * - Модальные окна
 * - Уведомления
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void

  // Modals
  activeModal: string | null
  openModal: (modalId: string) => void
  closeModal: () => void

  // Filters (для сохранения состояния фильтров между сессиями)
  savedFilters: Record<string, any>
  setSavedFilters: (key: string, filters: any) => void
  clearSavedFilters: (key: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Theme
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      setTheme: (theme) => set({ theme }),

      // Modals
      activeModal: null,
      openModal: (modalId) => set({ activeModal: modalId }),
      closeModal: () => set({ activeModal: null }),

      // Filters
      savedFilters: {},
      setSavedFilters: (key, filters) =>
        set((state) => ({
          savedFilters: { ...state.savedFilters, [key]: filters },
        })),
      clearSavedFilters: (key) =>
        set((state) => {
          const { [key]: _, ...rest } = state.savedFilters
          return { savedFilters: rest }
        }),
    }),
    {
      name: 'dmed-ui-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Только храним определенные поля в localStorage
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        savedFilters: state.savedFilters,
      }),
    }
  )
)

// Селекторы для оптимизации re-renders
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen)
export const useTheme = () => useUIStore((state) => state.theme)
export const useActiveModal = () => useUIStore((state) => state.activeModal)
