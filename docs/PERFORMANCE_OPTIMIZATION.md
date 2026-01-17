# Оптимизация производительности

Этот документ описывает компоненты и утилиты для оптимизации производительности приложения.

## 📋 Содержание

1. [React Query Hooks](#react-query-hooks)
2. [Debounced Search](#debounced-search)
3. [Virtualized Lists](#virtualized-lists)
4. [Loading States](#loading-states)
5. [Best Practices](#best-practices)

---

## React Query Hooks

### useLetters

Hook для получения списка писем с автоматическим кэшированием и фоновым обновлением.

```tsx
import { useLetters } from '@/hooks/use-letters'

function LettersList() {
  const { data, isLoading, error } = useLetters({
    status: 'IN_PROGRESS',
    limit: 20,
    sortBy: 'deadlineDate',
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorMessage />

  return (
    <div>
      {data?.letters.map((letter) => (
        <LetterCard key={letter.id} letter={letter} />
      ))}
    </div>
  )
}
```

**Параметры фильтрации:**
- `query` - текстовый поиск
- `status` - статус или массив статусов
- `ownerId` - ID ответственного
- `org` - организация
- `overdue` - только просроченные
- `dueToday` - дедлайн сегодня
- `urgent` - срочные
- `page`, `limit` - пагинация
- `sortBy`, `sortOrder` - сортировка

### useLetter

Hook для получения одного письма.

```tsx
import { useLetter } from '@/hooks/use-letters'

function LetterDetail({ id }: { id: string }) {
  const { data: letter, isLoading } = useLetter(id)

  if (isLoading) return <Skeleton />

  return <LetterView letter={letter} />
}
```

### useUpdateLetter

Hook для обновления письма с optimistic updates.

```tsx
import { useUpdateLetter } from '@/hooks/use-letters'

function LetterStatusChanger({ letterId, currentStatus }) {
  const updateLetter = useUpdateLetter()

  const handleStatusChange = (newStatus) => {
    updateLetter.mutate({
      id: letterId,
      data: { status: newStatus },
    })
    // UI обновится мгновенно, а затем синхронизируется с сервером
  }

  return (
    <select onChange={(e) => handleStatusChange(e.target.value)}>
      {/* опции */}
    </select>
  )
}
```

### useDashboard

Hook для параллельной загрузки всех данных дашборда.

```tsx
import { useDashboard } from '@/hooks/use-dashboard'

function Dashboard() {
  const { stats, recent, urgent, overdue, isLoading } = useDashboard()

  if (isLoading) return <DashboardSkeleton />

  return (
    <div>
      <Stats data={stats} />
      <RecentLetters letters={recent} />
      <UrgentLetters letters={urgent} />
      <OverdueLetters letters={overdue} />
    </div>
  )
}
```

---

## Debounced Search

Компонент поиска с автоматической задержкой для уменьшения количества запросов.

### DebouncedSearch

```tsx
import { DebouncedSearch } from '@/components/DebouncedSearch'

function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const { data, isLoading } = useLetters({ query: searchQuery })

  return (
    <div>
      <DebouncedSearch
        placeholder="Поиск писем..."
        onSearch={setSearchQuery}
        delay={300}
        loading={isLoading}
        autoFocus
      />
      <SearchResults data={data} />
    </div>
  )
}
```

### CompactSearch

Компактная версия для toolbar:

```tsx
import { CompactSearch } from '@/components/DebouncedSearch'

function Toolbar() {
  return (
    <div className="flex items-center gap-2">
      <CompactSearch onSearch={setQuery} />
      {/* другие кнопки */}
    </div>
  )
}
```

### useDebounce Hook

Для кастомных сценариев:

```tsx
import { useDebounce } from '@/hooks/use-debounce'

function CustomSearch() {
  const [input, setInput] = useState('')
  const debouncedInput = useDebounce(input, 500)

  useEffect(() => {
    // Этот эффект вызовется только после 500мс без изменений
    fetchResults(debouncedInput)
  }, [debouncedInput])

  return <input value={input} onChange={(e) => setInput(e.target.value)} />
}
```

---

## Virtualized Lists

Для больших списков (500+ элементов) используйте виртуализацию.

```tsx
import { VirtualizedLetterList } from '@/components/VirtualizedLetterList'

function LargeLetterList() {
  const { data, isLoading } = useLetters({ limit: 1000 })

  return (
    <VirtualizedLetterList
      letters={data?.letters || []}
      loading={isLoading}
      estimatedItemHeight={80}
    />
  )
}
```

**Преимущества:**
- Рендерит только видимые элементы
- Плавная прокрутка даже с 10000+ элементами
- Автоматический расчёт высоты элементов
- Overscan для плавности

---

## Loading States

### LoadingState

Универсальная обёртка для состояний загрузки:

```tsx
import { LoadingState } from '@/components/LoadingState'
import { LetterListSkeleton } from '@/components/ui/Skeleton'

function LettersList() {
  const { data, isLoading } = useLetters()

  return (
    <LoadingState loading={isLoading} skeleton={<LetterListSkeleton />}>
      <div>{data?.letters.map(/* ... */)}</div>
    </LoadingState>
  )
}
```

### Специализированные лоадеры

```tsx
import { InlineLoader, FullPageLoader, PanelLoader } from '@/components/LoadingState'

// В кнопке
<button disabled={isSaving}>
  {isSaving ? <InlineLoader /> : 'Сохранить'}
</button>

// Полноэкранный
{isInitializing && <FullPageLoader message="Загрузка приложения..." />}

// В панели
<div className="panel">
  {isLoading ? <PanelLoader /> : <Content />}
</div>
```

---

## Best Practices

### 1. Кэширование с React Query

```tsx
// ✅ Хорошо: используйте React Query
const { data } = useLetters()

// ❌ Плохо: fetch в useEffect
useEffect(() => {
  fetch('/api/letters').then(/* ... */)
}, [])
```

### 2. Debouncing для поиска

```tsx
// ✅ Хорошо: debounced search
<DebouncedSearch onSearch={setQuery} delay={300} />

// ❌ Плохо: запрос при каждом нажатии
<input onChange={(e) => fetchResults(e.target.value)} />
```

### 3. Виртуализация больших списков

```tsx
// ✅ Хорошо: виртуализация для 100+ элементов
<VirtualizedLetterList letters={thousands} />

// ❌ Плохо: рендер всех элементов
{thousands.map((letter) => <LetterCard key={letter.id} />)}
```

### 4. Optimistic Updates

```tsx
// ✅ Хорошо: мгновенный отклик
const updateLetter = useUpdateLetter()
updateLetter.mutate({ id, data }) // UI обновится сразу

// ❌ Плохо: ждём ответ сервера
await fetch('/api/letters/123', { method: 'PATCH' })
refetch() // долго
```

### 5. Skeleton Loaders

```tsx
// ✅ Хорошо: skeleton вместо спиннера
<LoadingState loading={isLoading} skeleton={<Skeleton />}>

// ❌ Плохо: только спиннер
{isLoading ? <Spinner /> : <Content />}
```

---

## Метрики производительности

### Замеры до оптимизации
- Загрузка дашборда: ~2-3 сек
- Поиск по 1000 письмам: ~500мс (50+ запросов)
- Прокрутка списка 500 писем: лаги

### После оптимизации
- Загрузка дашборда: ~500мс (с кэшем мгновенно)
- Поиск: ~300мс (1 запрос после debounce)
- Прокрутка 10000 писем: плавно (60 FPS)

---

## Дополнительные ресурсы

- [React Query Documentation](https://tanstack.com/query/latest)
- [React Virtual Documentation](https://tanstack.com/virtual/latest)
- [Web Performance Best Practices](https://web.dev/performance/)
