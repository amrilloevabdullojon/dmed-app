'use client'

/**
 * Пример использования tRPC
 *
 * Демонстрация:
 * - Type-safe queries
 * - Type-safe mutations
 * - Автокомплит
 * - Error handling
 * - Loading states
 */

import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function TRPCExample() {
  // Query - получение данных
  const { data: stats, isLoading: statsLoading } = trpc.letters.stats.useQuery()

  // Query с параметрами
  const { data: lettersData, isLoading: lettersLoading, refetch } = trpc.letters.getAll.useQuery({
    status: 'IN_PROGRESS',
    limit: 5,
  })

  // Mutation - создание письма
  const createMutation = trpc.letters.create.useMutation({
    onSuccess: () => {
      toast.success('Письмо создано!')
      refetch() // Обновить список
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  // Mutation - обновление письма
  const updateMutation = trpc.letters.update.useMutation({
    onSuccess: () => {
      toast.success('Письмо обновлено!')
      refetch()
    },
  })

  // Пример создания письма
  const handleCreateLetter = () => {
    createMutation.mutate({
      number: `${Math.floor(Math.random() * 1000)}/2024`,
      org: 'ООО Пример Компания',
      date: new Date(),
      deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 дней
      content: 'Тестовое письмо через tRPC',
      status: 'NOT_REVIEWED',
      priority: 50,
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>tRPC - Type-Safe API</CardTitle>
          <CardDescription>
            Полная типобезопасность между клиентом и сервером без кодогенерации
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Статистика */}
          <div>
            <h3 className="text-sm font-medium mb-2">Статистика писем</h3>
            {statsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Загрузка...</span>
              </div>
            ) : stats ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Всего: {stats.total}</Badge>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <Badge key={status}>{status}: {count}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Нет данных</p>
            )}
          </div>

          {/* Список писем */}
          <div>
            <h3 className="text-sm font-medium mb-2">Письма в работе</h3>
            {lettersLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Загрузка...</span>
              </div>
            ) : lettersData?.letters.length ? (
              <div className="space-y-2">
                {lettersData.letters.slice(0, 3).map((letter) => (
                  <div
                    key={letter.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{letter.number}</p>
                      <p className="text-xs text-muted-foreground">{letter.org}</p>
                    </div>
                    <Badge variant="secondary">{letter.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Нет писем в работе</p>
            )}
          </div>

          {/* Действия */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleCreateLetter}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать тестовое письмо'
              )}
            </Button>

            <Button variant="outline" onClick={() => refetch()}>
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Преимущества tRPC</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert">
          <ul>
            <li>✅ <strong>End-to-end типобезопасность</strong> - TypeScript типы автоматически между клиентом и сервером</li>
            <li>✅ <strong>Автокомплит</strong> - IDE знает все доступные endpoints и их параметры</li>
            <li>✅ <strong>Нет кодогенерации</strong> - типы выводятся напрямую из кода</li>
            <li>✅ <strong>Zod валидация</strong> - используйте существующие схемы</li>
            <li>✅ <strong>React Query интеграция</strong> - кеширование, refetching, optimistic updates</li>
            <li>✅ <strong>superjson</strong> - поддержка Date, Map, Set, undefined и других типов</li>
          </ul>

          <div className="mt-4 p-4 rounded-md bg-muted">
            <p className="text-xs font-mono">
              // Пример типобезопасного вызова:<br />
              const {'{'} data {'}'} = trpc.letters.getAll.useQuery({'{'}<br />
              {'  '}status: 'IN_PROGRESS', // ✅ автокомплит<br />
              {'  '}limit: 10,<br />
              {'}'})<br />
              // data автоматически типизирован! 🎉
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
