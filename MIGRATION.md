# Инструкция по миграции системы уведомлений

## Проблема

При деплое возникает ошибка из-за добавления новой таблицы `PushSubscription` в Prisma схему.

## Решение 1: Использовать флаг --accept-data-loss (рекомендуется для первого деплоя)

Если у вас **новая база данных** или **нет критичных данных**, просто обновите скрипт сборки:

### В `package.json` измените:

```json
"build": "prisma generate && prisma db push --accept-data-loss && next build"
```

## Решение 2: Создать миграцию вручную (для production)

Если у вас **production база с данными**:

### 1. Создайте миграцию локально:

```bash
npx prisma migrate dev --name add_push_subscriptions
```

### 2. Примените миграцию на production:

```bash
npx prisma migrate deploy
```

### 3. Обновите `package.json`:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

## Решение 3: Временно отключить новые возможности

Если нужно срочно задеплоить без миграции, временно закомментируйте изменения в `schema.prisma`:

```prisma
// pushSubscriptions  PushSubscription[]  // Временно отключено
```

И:

```prisma
// model PushSubscription {
//   id             String    @id @default(cuid())
//   userId         String
//   user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
//   endpoint       String
//   p256dh         String
//   auth           String
//   expirationTime DateTime?
//   createdAt      DateTime  @default(now())
//   updatedAt      DateTime  @updatedAt
//
//   @@unique([userId, endpoint])
//   @@index([userId])
// }
```

Затем задеплойте и раскомментируйте позже.

## Рекомендуемый подход для вашего проекта

Так как это внутренний проект и таблица `PushSubscription` новая (не существует в базе), используйте **Решение 1**:

```json
"build": "prisma generate && prisma db push --accept-data-loss && next build"
```

Это безопасно, потому что:
1. Таблица PushSubscription новая - нет данных для потери
2. Существующие таблицы не изменяются
3. Только добавляется новая таблица

## После успешного деплоя

1. Сгенерируйте VAPID ключи:
```bash
npx web-push generate-vapid-keys
```

2. Добавьте их в переменные окружения (Vercel/Railway/etc):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com
CRON_SECRET=random_secret_here
```

3. Установите зависимость (добавьте в package.json если ещё нет):
```bash
npm install web-push
```
