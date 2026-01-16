# Быстрая настройка системы уведомлений

## Шаг 1: Установка зависимостей

```bash
npm install
```

## Шаг 2: Генерация VAPID ключей для Push-уведомлений

```bash
npx web-push generate-vapid-keys
```

Скопируйте полученные ключи.

## Шаг 3: Настройка переменных окружения

Добавьте в `.env` (локально) или в настройки платформы (production):

```env
# Push-уведомления (обязательно)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=ваш_публичный_ключ
VAPID_PRIVATE_KEY=ваш_приватный_ключ
VAPID_SUBJECT=mailto:your-email@example.com

# Cron секрет для email дайджестов (опционально)
CRON_SECRET=случайная_строка_для_защиты

# SMTP уже должен быть настроен для email
# SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM
```

## Шаг 4: Обновление базы данных

Локально:
```bash
npx prisma db push
```

На production это произойдет автоматически при деплое (уже настроено в package.json).

## Шаг 5: Деплой

```bash
git add .
git commit -m "Add notification improvements"
git push
```

## Шаг 6: Настройка Cron (опционально, для email дайджестов)

### Vercel

Создайте `vercel.json` в корне:

```json
{
  "crons": [
    {
      "path": "/api/cron/digest?type=daily",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/digest?type=weekly",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### Другие платформы

Настройте cron задачи для вызова:
- `POST https://your-domain.com/api/cron/digest?type=daily` (каждый день в 9:00)
- `POST https://your-domain.com/api/cron/digest?type=weekly` (каждый понедельник в 9:00)

С заголовком: `Authorization: Bearer YOUR_CRON_SECRET`

## Готово!

Теперь пользователи могут:
1. Перейти в **Настройки** → **Уведомления**
2. Включить Push-уведомления
3. Настроить звуки
4. Выбрать частоту email дайджестов

## Что было добавлено

✅ Web Push-уведомления (работают даже когда приложение закрыто)
✅ Звуковые уведомления с разными тонами
✅ Email дайджесты (ежедневные/еженедельные)
✅ Batch операции над уведомлениями
✅ Улучшенная фильтрация и группировка

## Документация

- Подробная документация: `NOTIFICATIONS.md`
- Решение проблем с миграцией: `MIGRATION.md`
