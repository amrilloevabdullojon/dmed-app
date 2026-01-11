import { LetterFormExample } from '@/components/examples/LetterFormExample'
import { LettersDataTableExample } from '@/components/examples/LettersDataTableExample'
import { LettersTableExample } from '@/components/examples/LettersTableExample'
import { ZustandExample } from '@/components/examples/ZustandExample'
import { OptimisticUpdatesExample } from '@/components/examples/OptimisticUpdatesExample'
import { TRPCExample } from '@/components/examples/TRPCExample'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export default function DemoPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">🚀 Демонстрация новых фреймворков</h1>
            <p className="text-muted-foreground mt-2">
              Интерактивные примеры всех внедренных технологий
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            v2.0
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Технологический стек</CardTitle>
            <CardDescription>Модернизированная архитектура проекта</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-semibold">Next.js 16</div>
                <div className="text-xs text-muted-foreground">React 19</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🎨</div>
                <div className="font-semibold">shadcn/ui</div>
                <div className="text-xs text-muted-foreground">Radix UI</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📝</div>
                <div className="font-semibold">React Hook Form</div>
                <div className="text-xs text-muted-foreground">+ Zod</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-semibold">TanStack Table</div>
                <div className="text-xs text-muted-foreground">v8</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🗄️</div>
                <div className="font-semibold">Zustand</div>
                <div className="text-xs text-muted-foreground">State</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🔐</div>
                <div className="font-semibold">tRPC</div>
                <div className="text-xs text-muted-foreground">Type-safe API</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs с примерами */}
      <Tabs defaultValue="trpc" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="trpc">tRPC</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="state">State</TabsTrigger>
        </TabsList>

        <TabsContent value="trpc" className="space-y-4 mt-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">tRPC - Type-Safe API</h2>
            <p className="text-muted-foreground">
              Полная типобезопасность между клиентом и сервером без кодогенерации
            </p>
          </div>
          <TRPCExample />
        </TabsContent>

        <TabsContent value="forms" className="space-y-4 mt-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">React Hook Form + Zod</h2>
            <p className="text-muted-foreground">
              Типобезопасные формы с валидацией и минимальными re-renders
            </p>
          </div>
          <LetterFormExample />
        </TabsContent>

        <TabsContent value="tables" className="space-y-4 mt-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">TanStack Table v8</h2>
            <p className="text-muted-foreground">
              Мощные таблицы с сортировкой, фильтрацией и пагинацией
            </p>
          </div>
          <div className="space-y-6">
            <LettersTableExample />
            <LettersDataTableExample />
          </div>
        </TabsContent>

        <TabsContent value="state" className="space-y-4 mt-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Zustand + Optimistic Updates</h2>
            <p className="text-muted-foreground">
              Легковесный state management с мгновенным откликом UI
            </p>
          </div>
          <div className="space-y-6">
            <OptimisticUpdatesExample />
            <ZustandExample />
          </div>
        </TabsContent>
      </Tabs>

      {/* Дополнительная информация */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Документация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>TRPC_GUIDE.md</strong> - Подробное руководство по использованию tRPC
          </div>
          <div>
            <strong>MODERNIZATION_REPORT.md</strong> - Полный отчет о модернизации проекта
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Совет:</strong> Откройте React Query DevTools (иконка внизу справа) для отладки запросов
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
