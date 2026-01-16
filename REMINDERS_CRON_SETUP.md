# Настройка Cron Jobs для системы напоминаний

Система напоминаний требует запуска двух фоновых задач по расписанию.

## 1. Генерация автоматических напоминаний

**Endpoint:** `POST /api/letters/reminders/generate`

**Назначение:** Анализирует все активные письма и создаёт автоматические напоминания на основе правил.

**Рекомендуемое расписание:** Каждый день в 9:00 утра

### Правила генерации напоминаний:

1. **DEADLINE_APPROACHING** - за 3 дня до дедлайна
2. **DEADLINE_OVERDUE** - если дедлайн просрочен
3. **NO_RESPONSE** - если письмо в работе 7+ дней без ответа
4. **STALLED** - если нет активности 14+ дней
5. **FOLLOW_UP** - через 5 дней после отправки ответа

### Crontab запись:

```bash
# Каждый день в 9:00
0 9 * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/letters/reminders/generate
```

### GitHub Actions (альтернатива):

```yaml
name: Generate Letter Reminders
on:
  schedule:
    - cron: '0 9 * * *' # Каждый день в 9:00 UTC
  workflow_dispatch: # Ручной запуск

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Generate reminders
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/letters/reminders/generate
```

---

## 2. Обработка и отправка напоминаний

**Endpoint:** `POST /api/letters/reminders/process`

**Назначение:** Находит просроченные напоминания и отправляет уведомления владельцам писем.

**Рекомендуемое расписание:** Каждые 15 минут

### Что происходит при обработке:

1. Находит все активные непросроченные напоминания с `triggerDate <= now`
2. Для каждого напоминания:
   - Создаёт in-app уведомление
   - Отправляет email уведомление
   - (Опционально) отправляет в Telegram
   - Отмечает напоминание как отправленное

### Crontab запись:

```bash
# Каждые 15 минут
*/15 * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/letters/reminders/process
```

### GitHub Actions (альтернатива):

```yaml
name: Process Letter Reminders
on:
  schedule:
    - cron: '*/15 * * * *' # Каждые 15 минут
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Process pending reminders
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/letters/reminders/process
```

---

## Настройка переменных окружения

Добавьте в `.env`:

```bash
# Секретный ключ для cron endpoints (генерируйте надёжный)
CRON_SECRET=your-secure-random-string-here

# URL приложения для ссылок в уведомлениях
NEXTAUTH_URL=https://your-domain.com
```

**Генерация безопасного CRON_SECRET:**

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Альтернативные способы запуска

### 1. Vercel Cron Jobs

Создайте `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/letters/reminders/generate",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/letters/reminders/process",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Vercel автоматически добавит заголовки авторизации для cron jobs.

### 2. Node-cron (в приложении)

Если вы запускаете сервер постоянно (не serverless), можно использовать node-cron:

```typescript
// src/lib/cron.ts
import cron from 'node-cron'

// Генерация напоминаний каждый день в 9:00
cron.schedule('0 9 * * *', async () => {
  await fetch('http://localhost:3000/api/letters/reminders/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  })
})

// Обработка напоминаний каждые 15 минут
cron.schedule('*/15 * * * *', async () => {
  await fetch('http://localhost:3000/api/letters/reminders/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  })
})
```

### 3. EasyCron / Cron-job.org (внешние сервисы)

Используйте внешние cron сервисы для отправки HTTP запросов:

- **URL генерации:** `https://your-domain.com/api/letters/reminders/generate`
- **URL обработки:** `https://your-domain.com/api/letters/reminders/process`
- **Метод:** POST
- **Заголовок:** `Authorization: Bearer YOUR_CRON_SECRET`

---

## Мониторинг и отладка

### Просмотр логов:

```bash
# Логи генерации
tail -f logs/app.log | grep "reminders/generate"

# Логи обработки
tail -f logs/app.log | grep "reminders/process"
```

### Ручной запуск для тестирования:

```bash
# Генерация напоминаний
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/letters/reminders/generate

# Обработка напоминаний
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/letters/reminders/process
```

### Проверка статистики:

Можно создать endpoint для мониторинга:

```typescript
// GET /api/letters/reminders/stats
import { getReminderStats } from '@/lib/letter-reminders'

export async function GET() {
  const stats = await getReminderStats()
  return NextResponse.json(stats)
}
```

---

## Настройка правил напоминаний

Отредактируйте `src/lib/letter-reminders.ts`:

```typescript
export const REMINDER_RULES = {
  DEADLINE_WARNING_DAYS: 3,    // За сколько дней напоминать о дедлайне
  NO_RESPONSE_DAYS: 7,          // Сколько дней без ответа = напоминание
  STALLED_DAYS: 14,             // Сколько дней без активности = застопорилось
  FOLLOW_UP_DAYS: 5,            // Через сколько дней follow-up после отправки
}
```

---

## Безопасность

1. **Никогда не коммитьте** `CRON_SECRET` в Git
2. Используйте **надёжные случайные строки** (32+ символа)
3. Ротируйте ключи периодически
4. Проверяйте логи на подозрительную активность
5. Ограничьте rate limiting для cron endpoints

---

## Troubleshooting

**Напоминания не создаются:**
- Проверьте расписание cron job для `/generate`
- Убедитесь, что есть активные письма
- Проверьте логи на ошибки

**Напоминания не отправляются:**
- Проверьте расписание cron job для `/process`
- Убедитесь, что настроена отправка email
- Проверьте настройки уведомлений пользователей

**401 Unauthorized:**
- Проверьте правильность `CRON_SECRET`
- Убедитесь, что заголовок `Authorization` передаётся

---

## Производительность

- **Генерация:** ~100-500ms на 100 писем
- **Обработка:** ~50-200ms на каждое напоминание
- **Рекомендуется:** Использовать индексы БД (уже настроены)
- **Масштабирование:** При >10,000 писем рассмотрите очередь (Redis Queue, BullMQ)
