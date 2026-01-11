'use client'

/**
 * Пример использования React Hook Form + Zod + shadcn/ui
 *
 * Этот компонент демонстрирует современный подход к формам:
 * - React Hook Form для управления состоянием формы
 * - Zod для валидации
 * - shadcn/ui для UI компонентов
 * - TypeScript для типобезопасности
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// Zod схема для валидации
const letterFormSchema = z.object({
  number: z.string().min(1, 'Номер письма обязателен'),
  org: z.string().min(1, 'Организация обязательна'),
  content: z.string().min(10, 'Содержание должно быть не менее 10 символов'),
  status: z.enum(['NOT_REVIEWED', 'ACCEPTED', 'IN_PROGRESS', 'CLARIFICATION', 'READY', 'DONE']),
  priority: z.number().min(0).max(100),
})

// TypeScript тип автоматически выводится из Zod схемы
type LetterFormValues = z.infer<typeof letterFormSchema>

export function LetterFormExample() {
  // Инициализация формы с React Hook Form
  const form = useForm<LetterFormValues>({
    resolver: zodResolver(letterFormSchema),
    defaultValues: {
      number: '',
      org: '',
      content: '',
      status: 'NOT_REVIEWED',
      priority: 50,
    },
  })

  // Обработка отправки формы
  async function onSubmit(data: LetterFormValues) {
    try {
      // Здесь будет API вызов
      console.log('Form data:', data)

      // Пример успешного сабмита
      toast.success('Письмо создано успешно!')

      // Сброс формы
      form.reset()
    } catch (error) {
      toast.error('Ошибка при создании письма')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Номер письма</FormLabel>
              <FormControl>
                <Input placeholder="123/2024" {...field} />
              </FormControl>
              <FormDescription>
                Уникальный номер входящего письма
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="org"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Организация</FormLabel>
              <FormControl>
                <Input placeholder="ООО Компания" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Статус</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите статус" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="NOT_REVIEWED">Не рассмотрен</SelectItem>
                  <SelectItem value="ACCEPTED">Принят</SelectItem>
                  <SelectItem value="IN_PROGRESS">Взято в работу</SelectItem>
                  <SelectItem value="CLARIFICATION">На уточнении</SelectItem>
                  <SelectItem value="READY">Готово</SelectItem>
                  <SelectItem value="DONE">Сделано</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Содержание</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Опишите содержание письма..."
                  className="resize-none"
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Краткое содержание письма
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Приоритет (0-100)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Создание...' : 'Создать письмо'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Сбросить
          </Button>
        </div>

        {/* Debug: показать состояние формы */}
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-4 rounded-md bg-slate-950 p-4 text-xs">
            <code>{JSON.stringify(form.formState, null, 2)}</code>
          </pre>
        )}
      </form>
    </Form>
  )
}
