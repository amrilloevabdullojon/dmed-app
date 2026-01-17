# Исправление ошибок базы данных - Уведомления

## Проблема

На production сервере отсутствуют таблицы и колонки для системы уведомлений:

```
❌ Notification.actorId - колонка не существует
❌ NotificationPreference - таблица не существует
❌ NotificationSubscription - таблица не существует
```

## Решение

### Вариант 1: Автоматическое применение через Prisma Migrate (Рекомендуется)

```bash
# 1. Подключитесь к production серверу или используйте DATABASE_URL

# 2. Примените все pending миграции
npx prisma migrate deploy

# 3. Проверьте статус
npx prisma migrate status
```

### Вариант 2: Ручное применение SQL миграции

Если автоматический способ не работает, примените SQL миграцию вручную:

```bash
# 1. Подключитесь к PostgreSQL базе данных
psql $DATABASE_URL

# 2. Выполните SQL файл
\i prisma/migrations/20260118000000_ensure_notification_fields/migration.sql

# 3. Проверьте результат
\dt
\d "Notification"
```

### Вариант 3: Через администратор базы данных (pgAdmin, DBeaver и т.д.)

1. Откройте SQL редактор
2. Скопируйте содержимое файла `prisma/migrations/20260118000000_ensure_notification_fields/migration.sql`
3. Выполните SQL
4. Проверьте что таблицы созданы

## Что делает миграция

### 1. Добавляет колонку actorId в Notification

```sql
ALTER TABLE "Notification" ADD COLUMN "actorId" TEXT;
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL;
```

**Зачем:** Хранит информацию о том, кто вызвал уведомление (например, кто оставил комментарий)

### 2. Создаёт таблицу NotificationPreference

```sql
CREATE TABLE "NotificationPreference" (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE NOT NULL,
    settings JSONB NOT NULL,
    createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL,
    FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
);
```

**Зачем:** Хранит персональные настройки уведомлений для каждого пользователя

### 3. Создаёт таблицу NotificationSubscription

```sql
CREATE TABLE "NotificationSubscription" (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    event TEXT DEFAULT 'ALL',
    scope TEXT NOT NULL,
    value TEXT,
    createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TYPE "NotificationSubscriptionScope" AS ENUM ('ROLE', 'USER', 'ALL');
```

**Зачем:** Управляет подписками пользователей на различные типы уведомлений

## Проверка после применения

### Проверьте что таблицы созданы:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('NotificationPreference', 'NotificationSubscription');
```

Ожидаемый результат:
```
         table_name
-----------------------------
 NotificationPreference
 NotificationSubscription
```

### Проверьте что колонка actorId добавлена:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Notification'
AND column_name = 'actorId';
```

Ожидаемый результат:
```
 column_name | data_type
-------------+-----------
 actorId     | text
```

### Проверьте индексы:

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('NotificationPreference', 'NotificationSubscription');
```

## После применения миграции

1. **Перезапустите приложение:**
   ```bash
   # Если используете PM2
   pm2 restart dmed-app

   # Если используете Docker
   docker-compose restart app

   # Vercel/Platform - автоматически при деплое
   ```

2. **Проверьте API endpoints:**
   ```bash
   # Проверьте что уведомления работают
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app.com/api/notifications

   # Проверьте настройки уведомлений
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app.com/api/notification-settings
   ```

3. **Мониторьте логи:**
   ```bash
   # Убедитесь что ошибки исчезли
   tail -f logs/app.log | grep -i notification
   ```

## Откат (Rollback)

Если что-то пошло не так, откатите изменения:

```sql
-- Удалить добавленную колонку
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "actorId";

-- Удалить таблицы
DROP TABLE IF EXISTS "NotificationSubscription";
DROP TABLE IF EXISTS "NotificationPreference";

-- Удалить enum
DROP TYPE IF EXISTS "NotificationSubscriptionScope";
```

## Предотвращение в будущем

Чтобы избежать подобных проблем в будущем:

1. **Всегда применяйте миграции на production:**
   ```bash
   npx prisma migrate deploy
   ```

2. **Используйте CI/CD pipeline:**
   ```yaml
   # .github/workflows/deploy.yml
   - name: Apply database migrations
     run: npx prisma migrate deploy
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL }}
   ```

3. **Проверяйте статус миграций перед деплоем:**
   ```bash
   npx prisma migrate status
   ```

## Дополнительная информация

- Миграция использует `IF NOT EXISTS` проверки, поэтому безопасна для повторного применения
- Все операции идемпотентны - можно запускать несколько раз
- Foreign keys настроены с CASCADE для автоматического удаления связанных данных

## Связанные файлы

- Prisma схема: `prisma/schema.prisma`
- SQL миграция: `prisma/migrations/20260118000000_ensure_notification_fields/migration.sql`
- API уведомлений: `src/app/api/notifications/route.ts`
- Настройки: `src/app/api/notification-settings/route.ts`

## Контакты

Если возникли проблемы при применении миграции:
1. Проверьте логи базы данных
2. Убедитесь что DATABASE_URL правильный
3. Проверьте права доступа пользователя БД
4. Создайте issue в репозитории с логами ошибки
