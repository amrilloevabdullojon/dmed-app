# Optimistic UI System

Полная система для реализации Optimistic UI обновлений - мгновенная реакция интерфейса с автоматическим откатом при ошибках.

## Концепция Optimistic UI

**Optimistic UI** - подход, при котором интерфейс мгновенно обновляется до завершения серверной операции, предполагая успешный результат. Если операция завершается ошибкой, изменения автоматически откатываются.

### Преимущества

- ⚡ **Мгновенная реакция** - UI обновляется без задержки
- 🔄 **Автоматический откат** - при ошибках состояние восстанавливается
- 🎨 **Улучшенный UX** - приложение кажется быстрее и отзывчивее
- 📱 **Идеально для мобильных** - скрывает сетевую задержку

---

## Компоненты системы

### 1. useOptimistic Hook

Базовый хук для optimistic updates любых данных.

```tsx
import { useOptimistic } from '@/hooks/useOptimistic'

function MyComponent() {
  const { data, mutate, pending, error, setData, reset } = useOptimistic(
    initialData,
    {
      optimisticUpdate: (current, input) => {
        // Как обновить данные оптимистично
        return { ...current, ...input }
      },
      mutationFn: async (input) => {
        // Фактическая серверная операция
        const res = await fetch('/api/endpoint', {
          method: 'POST',
          body: JSON.stringify(input)
        })
        return res.json()
      },
      onSuccess: (result) => {
        toast.success('Сохранено!')
      },
      onError: (error, rollback) => {
        toast.error(`Ошибка: ${error.message}`)
      },
      delay: 0, // Задержка перед применением optimistic update (для debounce)
    }
  )

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <button onClick={() => mutate({ field: 'value' })} disabled={pending}>
        Обновить
      </button>
    </div>
  )
}
```

**API**:
- `data` - текущее состояние данных
- `pending` - флаг выполнения операции
- `error` - ошибка (если есть)
- `mutate(input)` - выполнить optimistic update
- `setData(data)` - обновить данные без операции
- `reset()` - сбросить к начальному состоянию

---

### 2. useOptimisticList Hook

Хук для работы со списками - add, update, remove.

```tsx
import { useOptimisticList } from '@/hooks/useOptimistic'

interface Todo {
  id: string
  text: string
  completed: boolean
}

function TodoList() {
  const { items, add, update, remove, pending, setItems } = useOptimisticList<Todo>(
    initialTodos,
    {
      addFn: async (item) => {
        const res = await fetch('/api/todos', {
          method: 'POST',
          body: JSON.stringify(item)
        })
        return res.json()
      },
      updateFn: async (id, data) => {
        const res = await fetch(`/api/todos/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        })
        return res.json()
      },
      removeFn: async (id) => {
        await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      },
      getId: (item) => item.id,
      onError: (error, operation) => {
        toast.error(`Failed to ${operation}: ${error.message}`)
      }
    }
  )

  return (
    <div>
      {items.map(todo => (
        <div key={todo.id} className={pending.has(todo.id) ? 'opacity-50' : ''}>
          <span>{todo.text}</span>
          <button onClick={() => update(todo.id, { completed: !todo.completed })}>
            Toggle
          </button>
          <button onClick={() => remove(todo.id)}>
            Delete
          </button>
        </div>
      ))}
      <button onClick={() => add({ text: 'New todo', completed: false })}>
        Add Todo
      </button>
    </div>
  )
}
```

**API**:
- `items` - массив элементов
- `add(item)` - добавить элемент
- `update(id, data)` - обновить элемент
- `remove(id)` - удалить элемент
- `pending` - Set с ID элементов в процессе обновления
- `setItems(items)` - установить весь массив

---

### 3. OptimisticWrapper Component

Визуальный индикатор optimistic состояния.

```tsx
import { OptimisticWrapper } from '@/components/OptimisticWrapper'

function Card() {
  const { data, mutate, pending } = useOptimistic(...)

  return (
    <OptimisticWrapper
      isOptimistic={pending}
      showLoader={true}
      opacity={0.6}
    >
      <div className="card">
        <h3>{data.title}</h3>
        <p>{data.description}</p>
      </div>
    </OptimisticWrapper>
  )
}
```

**Props**:
- `isOptimistic` - показывать ли индикатор
- `isPending` - альтернативный флаг (для React.useTransition)
- `showLoader` - показывать спиннер (default: true)
- `opacity` - прозрачность overlay (default: 0.6)
- `className` - дополнительные CSS классы

---

### 4. OptimisticListItem Component

Компонент для элементов списка с индикацией pending состояния.

```tsx
import { OptimisticListItem } from '@/components/OptimisticWrapper'

function TodoItem({ todo, pending }) {
  return (
    <OptimisticListItem
      id={todo.id}
      pendingIds={pending}
      showPulse={true}
    >
      <div className="todo-item">
        {todo.text}
      </div>
    </OptimisticListItem>
  )
}
```

**Props**:
- `id` - ID элемента
- `pendingIds` - Set с pending IDs
- `showPulse` - показывать пульсацию (default: true)
- `className` - дополнительные CSS классы

---

### 5. OptimisticButton Component

Кнопка с индикатором загрузки для optimistic операций.

```tsx
import { OptimisticButton } from '@/components/OptimisticWrapper'

function SaveButton() {
  const { mutate, pending } = useOptimistic(...)

  return (
    <OptimisticButton
      isOptimistic={pending}
      loadingText="Сохранение..."
      onClick={() => mutate(data)}
      className="btn-primary"
    >
      Сохранить
    </OptimisticButton>
  )
}
```

**Props**:
- `isOptimistic` - показывать загрузку
- `loadingText` - текст при загрузке (опционально)
- Все стандартные props кнопки

---

### 6. OptimisticBadge Component

Бейдж-индикатор для показа сохранения.

```tsx
import { OptimisticBadge } from '@/components/OptimisticWrapper'

function AutoSaveIndicator() {
  const { pending } = useOptimistic(...)

  return <OptimisticBadge show={pending} label="Автосохранение..." />
}
```

**Props**:
- `show` - показывать бейдж
- `label` - текст (default: "Сохранение...")
- `className` - дополнительные CSS классы

---

## Утилиты (optimisticHelpers)

```tsx
import { optimisticHelpers } from '@/components/OptimisticWrapper'

// Добавить элемент с временным ID
const newArray = optimisticHelpers.addToArray(items, { text: 'New item' })

// Обновить элемент
const updated = optimisticHelpers.updateInArray(items, '123', { completed: true })

// Удалить элемент
const removed = optimisticHelpers.removeFromArray(items, '123')

// Переместить элемент
const reordered = optimisticHelpers.moveInArray(items, 0, 3)

// Обновить вложенное свойство
const obj = optimisticHelpers.updateNested(data, 'user.profile.name', 'John')

// Генерировать временный ID
const tempId = optimisticHelpers.generateTempId()

// Проверить, временный ли ID
if (optimisticHelpers.isTempId(item.id)) {
  // Это временный элемент
}
```

---

## Примеры использования

### Пример 1: Форма с автосохранением

```tsx
import { useOptimistic } from '@/hooks/useOptimistic'
import { OptimisticBadge } from '@/components/OptimisticWrapper'

function ProfileForm({ initialData }) {
  const { data, mutate, pending } = useOptimistic(
    initialData,
    {
      optimisticUpdate: (current, input) => ({ ...current, ...input }),
      mutationFn: async (input) => {
        await fetch('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify(input)
        })
        return { ...data, ...input }
      },
      delay: 1000, // Debounce 1 секунда
      onSuccess: () => toast.success('Профиль обновлён'),
      onError: (error) => toast.error(error.message)
    }
  )

  const handleChange = (field: string, value: string) => {
    mutate({ [field]: value })
  }

  return (
    <form>
      <OptimisticBadge show={pending} />

      <input
        value={data.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      <input
        value={data.email}
        onChange={(e) => handleChange('email', e.target.value)}
      />
    </form>
  )
}
```

### Пример 2: Todo List

```tsx
import { useOptimisticList } from '@/hooks/useOptimistic'
import { OptimisticListItem } from '@/components/OptimisticWrapper'

function TodoApp() {
  const { items, add, update, remove, pending } = useOptimisticList(
    [],
    {
      addFn: async (todo) => {
        const res = await fetch('/api/todos', {
          method: 'POST',
          body: JSON.stringify(todo)
        })
        return res.json()
      },
      updateFn: async (id, data) => {
        const res = await fetch(`/api/todos/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        })
        return res.json()
      },
      removeFn: async (id) => {
        await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      },
      onError: (error) => enhancedToast.error('Ошибка', error.message)
    }
  )

  return (
    <div>
      {items.map(todo => (
        <OptimisticListItem
          key={todo.id}
          id={todo.id}
          pendingIds={pending}
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => update(todo.id, { completed: !todo.completed })}
            />
            <span className={todo.completed ? 'line-through' : ''}>
              {todo.text}
            </span>
            <button onClick={() => remove(todo.id)}>Delete</button>
          </div>
        </OptimisticListItem>
      ))}

      <button onClick={() => add({ text: 'New Task', completed: false })}>
        Add Todo
      </button>
    </div>
  )
}
```

### Пример 3: Лайки/Реакции

```tsx
function LikeButton({ postId, initialLikes, isLiked }) {
  const { data, mutate, pending } = useOptimistic(
    { likes: initialLikes, isLiked },
    {
      optimisticUpdate: (current) => ({
        likes: current.isLiked ? current.likes - 1 : current.likes + 1,
        isLiked: !current.isLiked
      }),
      mutationFn: async () => {
        const res = await fetch(`/api/posts/${postId}/like`, {
          method: 'POST'
        })
        return res.json()
      },
      onError: (error) => toast.error('Не удалось поставить лайк')
    }
  )

  return (
    <button
      onClick={() => mutate({})}
      disabled={pending}
      className={data.isLiked ? 'text-red-500' : 'text-gray-400'}
    >
      <Heart className={data.isLiked ? 'fill-current' : ''} />
      <span>{data.likes}</span>
    </button>
  )
}
```

### Пример 4: Drag & Drop с optimistic reorder

```tsx
function DraggableList() {
  const { data, mutate, pending } = useOptimistic(
    initialItems,
    {
      optimisticUpdate: (current, { fromIndex, toIndex }) => {
        return optimisticHelpers.moveInArray(current, fromIndex, toIndex)
      },
      mutationFn: async ({ fromIndex, toIndex }) => {
        const newOrder = optimisticHelpers.moveInArray(data, fromIndex, toIndex)
        await fetch('/api/items/reorder', {
          method: 'POST',
          body: JSON.stringify({ order: newOrder.map(i => i.id) })
        })
        return newOrder
      }
    }
  )

  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    mutate({ fromIndex, toIndex })
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <OptimisticWrapper isOptimistic={pending}>
        {/* Draggable items */}
      </OptimisticWrapper>
    </DragDropContext>
  )
}
```

### Пример 5: Переключатель настроек

```tsx
function SettingsToggle() {
  const { data, mutate, pending } = useOptimistic(
    { notifications: true, darkMode: false },
    {
      optimisticUpdate: (current, { field }) => ({
        ...current,
        [field]: !current[field]
      }),
      mutationFn: async ({ field }) => {
        await fetch('/api/settings', {
          method: 'PATCH',
          body: JSON.stringify({ [field]: !data[field] })
        })
        return { ...data, [field]: !data[field] }
      }
    }
  )

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={data.notifications}
          onChange={() => mutate({ field: 'notifications' })}
          disabled={pending}
        />
        Уведомления
      </label>
      <label>
        <input
          type="checkbox"
          checked={data.darkMode}
          onChange={() => mutate({ field: 'darkMode' })}
          disabled={pending}
        />
        Тёмная тема
      </label>
    </div>
  )
}
```

---

## Best Practices

### 1. Всегда обрабатывайте ошибки

```tsx
const { mutate } = useOptimistic(data, {
  // ...
  onError: (error, rollback) => {
    // Показать уведомление
    enhancedToast.error('Ошибка', error.message)

    // Логировать
    console.error('Optimistic update failed:', error)

    // Опционально: дополнительные действия
    analytics.track('optimistic_update_failed', { error: error.message })
  }
})
```

### 2. Используйте временные ID правильно

```tsx
// ✅ Правильно - используем helper
const tempId = optimisticHelpers.generateTempId()

// ✅ Проверяем временный ID перед операциями
if (!optimisticHelpers.isTempId(item.id)) {
  // Безопасно использовать ID для API вызовов
}

// ❌ Неправильно - жёстко заданный ID
const tempId = 'temp-123'
```

### 3. Debounce для частых обновлений

```tsx
const { mutate } = useOptimistic(data, {
  // ...
  delay: 500, // 500ms debounce для автосохранения
})
```

### 4. Показывайте pending состояния

```tsx
// Для отдельных элементов
<OptimisticListItem id={item.id} pendingIds={pending}>
  {/* ... */}
</OptimisticListItem>

// Для всего контейнера
<OptimisticWrapper isOptimistic={pending}>
  {/* ... */}
</OptimisticWrapper>

// Для кнопок
<OptimisticButton isOptimistic={pending}>
  Save
</OptimisticButton>
```

### 5. Комбинируйте с toast уведомлениями

```tsx
const { mutate } = useOptimistic(data, {
  mutationFn: async (input) => {
    const toastId = enhancedToast.loading('Сохранение...')

    try {
      const result = await saveData(input)
      enhancedToast.update(toastId, {
        type: 'success',
        title: 'Сохранено!',
        duration: 3000
      })
      return result
    } catch (error) {
      // Ошибка обработается в onError
      throw error
    }
  },
  onError: (error) => {
    enhancedToast.error('Ошибка сохранения', error.message)
  }
})
```

---

## Производительность

- **Минимальные ре-рендеры** - используется `useCallback` и `useRef`
- **Lazy state updates** - только изменённые части обновляются
- **Automatic cleanup** - таймеры очищаются при размонтировании
- **Batched updates** - React автоматически батчит обновления

---

## Accessibility

- Disabled состояния для pending операций
- ARIA labels для индикаторов загрузки
- Визуальные индикаторы (opacity, pulse) для pending состояний
- Screen reader friendly - объявления об ошибках

---

## Интеграция с существующим кодом

Вместо прямых API вызовов:

```tsx
// ❌ Старый подход
const handleSave = async () => {
  setLoading(true)
  try {
    const result = await saveData(data)
    setData(result)
    toast.success('Saved!')
  } catch (error) {
    toast.error(error.message)
  } finally {
    setLoading(false)
  }
}

// ✅ Новый подход с optimistic UI
const { mutate, pending } = useOptimistic(data, {
  optimisticUpdate: (current, input) => ({ ...current, ...input }),
  mutationFn: async (input) => saveData(input),
  onSuccess: () => toast.success('Saved!'),
  onError: (error) => toast.error(error.message)
})

const handleSave = () => mutate(updates)
```

---

## TypeScript Support

Все hooks и компоненты полностью типизированы:

```tsx
interface User {
  id: string
  name: string
  email: string
}

const { data, mutate } = useOptimistic<User, Partial<User>>(
  initialUser,
  {
    optimisticUpdate: (current, input) => ({ ...current, ...input }),
    mutationFn: async (input) => updateUser(input)
  }
)

// TypeScript знает типы
data.name // string
data.email // string
mutate({ name: 'John' }) // ✅ OK
mutate({ invalid: true }) // ❌ TypeScript error
```
