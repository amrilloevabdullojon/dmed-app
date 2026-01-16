# Улучшения модуля заявок

## 1. SLA система (Service Level Agreements)

### Что добавить:

**Схема Prisma:**
```prisma
model Request {
  // ... существующие поля
  slaDeadline      DateTime?
  firstResponseAt  DateTime?
  resolvedAt       DateTime?
  slaStatus        SlaStatus @default(ON_TIME)
}

enum SlaStatus {
  ON_TIME       // В срок
  AT_RISK       // Под угрозой нарушения
  BREACHED      // Нарушен
}
```

**Правила SLA по приоритетам:**
- URGENT: 1 час на первый ответ, 4 часа на решение
- HIGH: 4 часа на первый ответ, 24 часа на решение
- NORMAL: 24 часа на первый ответ, 72 часа на решение
- LOW: 48 часов на первый ответ, 7 дней на решение

**Функциональность:**
- Автоматический расчет дедлайнов при создании заявки
- Визуальные индикаторы в UI (цветовое кодирование)
- Уведомления при приближении к дедлайну
- Отчеты по выполнению SLA

---

## 2. Автоматическое распределение (Auto-Assignment)

### Алгоритмы распределения:

**1. Round Robin:**
- Заявки распределяются по очереди между доступными операторами
- Учитывается текущая загрузка

**2. По категориям:**
- У каждого оператора есть специализация
- Заявки автоматически назначаются экспертам в категории

**3. По загруженности:**
- Оператору с наименьшим количеством активных заявок

**Реализация:**
```typescript
// src/lib/request-assignment.ts
type AssignmentStrategy = 'round-robin' | 'by-category' | 'by-load'

interface OperatorStats {
  userId: string
  activeRequests: number
  categories: RequestCategory[]
  isAvailable: boolean
}

async function autoAssignRequest(
  requestId: string,
  strategy: AssignmentStrategy = 'by-load'
): Promise<string | null>
```

---

## 3. Шаблоны ответов (Response Templates)

### Функциональность:

**Схема:**
```prisma
model RequestResponseTemplate {
  id          String          @id @default(cuid())
  name        String
  content     String          @db.Text
  category    RequestCategory?
  isPublic    Boolean         @default(false)
  createdById String
  createdBy   User           @relation(fields: [createdById], references: [id])
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([category])
  @@index([createdById])
}
```

**UI:**
- Выпадающий список шаблонов при добавлении комментария
- Быстрые кнопки для частых ответов
- Поддержка переменных: `{{contactName}}`, `{{organization}}`, `{{requestId}}`
- Личные и публичные шаблоны

---

## 4. Теги и метки (Tags & Labels)

### Для лучшей организации:

**Схема:**
```prisma
model RequestTag {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String   @default("#6B7280")
  requests  Request[]
  createdAt DateTime @default(now())
}
```

**Функциональность:**
- Пользовательские теги (например: "VIP", "Повторная", "Требует эскалации")
- Цветовое кодирование
- Фильтрация по тегам
- Автоматические теги на основе ключевых слов

---

## 5. Аналитика и отчеты

### Dashboard для заявок:

**Метрики:**
- Общее количество заявок (по периодам)
- По статусам (NEW, IN_REVIEW, DONE, etc.)
- Среднее время ответа
- Среднее время решения
- Показатели SLA (% выполнения)
- Топ категорий
- Загрузка операторов
- Тренды (недельные, месячные)

**Графики:**
- Линейные графики динамики
- Круговые диаграммы распределения
- Heatmap загрузки по дням недели

**Экспорт:**
- CSV/Excel
- PDF отчеты
- Автоматическая отправка еженедельных отчетов

---

## 6. Workflow и автоматизация

### Правила автоматизации:

**Примеры:**
1. **Автоматическое закрытие:**
   - Если заявка в статусе DONE более 7 дней без активности → закрыть

2. **Эскалация:**
   - Если нарушен SLA → изменить приоритет на URGENT
   - Если URGENT без ответа 30 мин → уведомить менеджера

3. **Автоответы:**
   - При создании заявки → отправить подтверждение на email
   - При изменении статуса → уведомить заявителя

4. **Категоризация через AI:**
   - Анализ описания → автоматическое определение категории
   - Анализ тональности → определение приоритета

**Схема:**
```prisma
model RequestAutomation {
  id          String   @id @default(cuid())
  name        String
  trigger     Json     // условия запуска
  actions     Json     // действия
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 7. Уведомления заявителя

### Email уведомления для внешних пользователей:

**События:**
- Заявка создана (с номером для отслеживания)
- Статус изменен
- Добавлен комментарий от оператора
- Заявка закрыта

**Шаблоны:**
- HTML шаблоны с брендингом
- Кнопка "Отследить заявку" (ссылка на портал)
- Возможность ответить по email (Reply-to интеграция)

---

## 8. Улучшения портала отслеживания

### Текущий портал очень базовый, добавить:

**Функциональность:**
1. **Интерактивная временная шкала:**
   - Визуализация этапов обработки
   - Иконки для каждого этапа
   - Прогресс-бар

2. **Добавление комментариев:**
   - Заявитель может добавлять комментарии
   - Загрузка дополнительных файлов
   - Оценка качества обслуживания

3. **Подписка на обновления:**
   - Email уведомления
   - SMS уведомления (опционально)
   - Telegram бот для отслеживания

4. **QR код:**
   - Генерация QR кода для быстрого доступа к заявке
   - Отправка на email при создании

---

## 9. Интеграция с внешними системами

### Webhook система:

**Для интеграции с:**
- Jira
- Slack
- Microsoft Teams
- Zendesk
- Freshdesk

**Схема:**
```prisma
model RequestWebhook {
  id          String   @id @default(cuid())
  url         String
  events      String[] // ['created', 'updated', 'commented', 'closed']
  secret      String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

**Payload:**
```json
{
  "event": "request.created",
  "timestamp": "2024-01-16T12:00:00Z",
  "data": {
    "request": {...},
    "triggeredBy": {...}
  }
}
```

---

## 10. Улучшение поиска

### Full-text search:

**Текущий поиск:** простой LIKE запрос

**Улучшения:**
1. **PostgreSQL Full-Text Search:**
   ```sql
   CREATE INDEX requests_search_idx ON "Request"
   USING GIN (to_tsvector('russian', description || ' ' || organization || ' ' || "contactName"));
   ```

2. **Поиск по:**
   - Описанию
   - Организации
   - Контактам
   - Комментариям
   - Файлам (названия)

3. **Продвинутые фильтры:**
   - Диапазон дат создания
   - Назначенный оператор
   - Теги
   - Наличие файлов/комментариев

4. **Сохраненные фильтры:**
   - Пользователь может сохранять комбинации фильтров
   - Быстрый доступ к частым запросам

---

## 11. Оценка качества обслуживания

### CSAT (Customer Satisfaction Score):

**После закрытия заявки:**
1. Отправка email с просьбой оценить
2. Простая форма: 1-5 звезд + комментарий
3. Сохранение оценки в БД

**Схема:**
```prisma
model RequestRating {
  id          String   @id @default(cuid())
  requestId   String   @unique
  request     Request  @relation(fields: [requestId], references: [id])
  rating      Int      // 1-5
  comment     String?  @db.Text
  createdAt   DateTime @default(now())
}
```

**Аналитика:**
- Средняя оценка по операторам
- Средняя оценка по категориям
- Тренды удовлетворенности

---

## 12. Массовые операции (Bulk Actions)

### Для операторов:

**Функции:**
- Выбрать несколько заявок
- Массово изменить статус
- Массово назначить оператора
- Массово добавить тег
- Массово экспортировать

**UI:**
- Чекбоксы для выбора
- Панель действий сверху/снизу
- Подтверждение перед применением

---

## 13. Напоминания и таймеры

### Автоматические напоминания:

**Типы:**
1. **Напоминание оператору:**
   - Если заявка не обновлялась X часов
   - Уведомление в приложении + email

2. **Следующее действие (Follow-up):**
   - Оператор может установить дату/время напоминания
   - "Связаться с клиентом через 3 дня"

**Схема:**
```prisma
model RequestReminder {
  id          String   @id @default(cuid())
  requestId   String
  request     Request  @relation(fields: [requestId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  remindAt    DateTime
  note        String?
  isCompleted Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([remindAt, isCompleted])
}
```

---

## 14. Mobile-оптимизация

### Текущее состояние: базовая адаптивность

**Улучшения:**
1. **Swipe actions:**
   - Свайп влево → удалить
   - Свайп вправо → изменить статус

2. **Оффлайн режим:**
   - Просмотр закешированных заявок
   - Создание заявок оффлайн (sync при подключении)

3. **PWA:**
   - Push-уведомления на мобильных
   - Установка как приложение
   - Быстрый доступ с домашнего экрана

---

## 15. Приоритизация улучшений

### Quick Wins (1-2 недели):
1. ✅ Шаблоны ответов
2. ✅ Теги и метки
3. ✅ Email уведомления заявителю
4. ✅ Улучшение портала (временная шкала)

### Medium (3-4 недели):
5. ✅ SLA система
6. ✅ Автоматическое распределение
7. ✅ Аналитика dashboard
8. ✅ Оценка качества

### Long-term (1-2 месяца):
9. ✅ Workflow и автоматизация
10. ✅ AI категоризация
11. ✅ Webhook интеграции
12. ✅ Full-text search

---

## Технические детали реализации

### Необходимые зависимости:
```json
{
  "@google/generative-ai": "^1.34.0",  // Уже есть - для AI
  "chart.js": "^4.4.0",                 // Для графиков
  "react-chartjs-2": "^5.2.0",
  "date-fns": "^3.6.0",                 // Уже есть
  "xlsx": "^0.18.5"                     // Для Excel экспорта
}
```

### Структура файлов:
```
src/
├── lib/
│   ├── request-sla.ts           # SLA расчеты
│   ├── request-assignment.ts    # Автоматическое распределение
│   ├── request-automation.ts    # Workflow engine
│   └── request-analytics.ts     # Аналитика
├── app/
│   ├── requests/
│   │   ├── analytics/
│   │   │   └── page.tsx        # Dashboard
│   │   └── templates/
│   │       └── page.tsx        # Управление шаблонами
│   └── api/
│       ├── requests/
│       │   └── analytics/
│       │       └── route.ts
│       └── webhooks/
│           └── requests/
│               └── route.ts
└── components/
    ├── requests/
    │   ├── RequestAnalytics.tsx
    │   ├── RequestTemplates.tsx
    │   ├── RequestTags.tsx
    │   └── RequestTimeline.tsx
    └── charts/
        └── ... (график компоненты)
```

---

## Оценка трудозатрат

| Улучшение | Сложность | Время | Приоритет |
|-----------|-----------|-------|-----------|
| Шаблоны ответов | Low | 3-5 дней | High |
| Теги | Low | 2-3 дня | High |
| Email уведомления | Medium | 5-7 дней | High |
| Портал улучшения | Medium | 5-7 дней | High |
| SLA система | Medium | 7-10 дней | Medium |
| Автораспределение | Medium | 5-7 дней | Medium |
| Аналитика | High | 10-14 дней | Medium |
| Оценка качества | Low | 3-5 дней | Medium |
| Workflow | High | 14-21 день | Low |
| AI категоризация | High | 10-14 дней | Low |
| Webhooks | Medium | 7-10 дней | Low |
| Full-text search | Medium | 5-7 дней | Medium |

**Общая оценка для всех улучшений:** 2-3 месяца работы

---

## Рекомендации по внедрению

### Фаза 1 (Sprint 1-2): Quick Wins
- Шаблоны ответов
- Теги
- Email уведомления
- Улучшение портала

**Результат:** Значительное улучшение UX для операторов и заявителей

### Фаза 2 (Sprint 3-4): Автоматизация
- SLA система
- Автораспределение
- Напоминания

**Результат:** Повышение эффективности обработки

### Фаза 3 (Sprint 5-6): Аналитика и качество
- Dashboard
- Оценка качества
- Улучшенный поиск

**Результат:** Понимание метрик и улучшение качества сервиса

### Фаза 4 (Sprint 7+): Продвинутые функции
- Workflow
- AI интеграция
- Webhooks

**Результат:** Полная автоматизация и интеграция
