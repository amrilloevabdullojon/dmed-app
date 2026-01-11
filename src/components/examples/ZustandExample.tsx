'use client'

/**
 * Пример использования Zustand stores
 */

import { useUIStore, useSidebarOpen, useTheme } from '@/stores/ui-store'
import { useLettersStore, useSelectedCount } from '@/stores/letters-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ZustandExample() {
  // Использование глобального store
  const { toggleSidebar, toggleTheme } = useUIStore()

  // Использование селекторов (оптимизировано - ререндер только при изменении конкретного поля)
  const sidebarOpen = useSidebarOpen()
  const theme = useTheme()

  // Letters store
  const { selectLetter, deselectLetter, clearSelection, selectedLetterIds } = useLettersStore()
  const selectedCount = useSelectedCount()

  const mockLetterIds = ['letter-1', 'letter-2', 'letter-3', 'letter-4', 'letter-5']

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>UI Store</CardTitle>
          <CardDescription>Глобальное состояние UI (сохраняется в localStorage)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Sidebar</p>
              <p className="text-sm text-muted-foreground">
                Статус: {sidebarOpen ? 'Открыт' : 'Закрыт'}
              </p>
            </div>
            <Button onClick={toggleSidebar} variant="outline">
              Toggle Sidebar
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Тема</p>
              <p className="text-sm text-muted-foreground">
                Текущая: <Badge>{theme}</Badge>
              </p>
            </div>
            <Button onClick={toggleTheme} variant="outline">
              Toggle Theme
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Letters Store</CardTitle>
          <CardDescription>
            Состояние выбранных писем (для bulk operations)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">
              Выбрано писем: <Badge>{selectedCount}</Badge>
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {mockLetterIds.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={selectedLetterIds.has(id) ? 'default' : 'outline'}
                  onClick={() => {
                    if (selectedLetterIds.has(id)) {
                      deselectLetter(id)
                    } else {
                      selectLetter(id)
                    }
                  }}
                >
                  {id}
                </Button>
              ))}
            </div>

            <Button onClick={clearSelection} variant="destructive" size="sm">
              Очистить выбор
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Преимущества Zustand</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert">
          <ul>
            <li>✅ Минимальный boilerplate (в 10 раз меньше Redux)</li>
            <li>✅ TypeScript first</li>
            <li>✅ Селекторы для оптимизации re-renders</li>
            <li>✅ Persist middleware (localStorage/sessionStorage)</li>
            <li>✅ DevTools support (Redux DevTools)</li>
            <li>✅ 2.5KB gzipped</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
