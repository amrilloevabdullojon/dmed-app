# PWA (Progressive Web App) для DMED Letters

Приложение DMED Letters теперь является полноценным Progressive Web App с поддержкой offline режима, push уведомлений и установки на устройства.

## Возможности PWA

### 📱 Установка на устройства
- **Android**: Браузер автоматически предложит установку
- **iOS**: Инструкции для добавления на домашний экран
- **Desktop**: Chrome, Edge показывают иконку установки в адресной строке

### 🔄 Offline поддержка
- Кеширование статических ресурсов
- Работа без интернета для просмотренных страниц
- Автоматическая синхронизация при восстановлении связи

### 📲 Push уведомления
- Готовность к push уведомлениям
- Запрос разрешений через `usePushNotifications` hook
- Обработка кликов по уведомлениям

### ⚡ Производительность
- Мгновенная загрузка повторных посещений
- Стратегии кеширования для разных типов контента
- Prefetching критических ресурсов

---

## Архитектура

### Компоненты

#### 1. PWAProvider
Главный провайдер для PWA функционала.

```tsx
// src/components/PWAProvider.tsx
<PWAProvider>
  <App />
</PWAProvider>
```

**Функции:**
- Регистрация Service Worker
- Показ уведомлений об обновлениях
- Индикация online/offline статуса
- Управление Install Prompt

#### 2. PWAInstallPrompt
Компонент для предложения установки приложения.

**Особенности:**
- Автоматическое определение платформы (iOS/Android/Desktop)
- Разные UI для разных платформ
- Cooldown 7 дней после отклонения
- Хранение состояния в localStorage

**iOS:**
- Показывает пошаговые инструкции
- Обнаруживает Safari автоматически

**Android/Desktop:**
- Использует нативный API `beforeinstallprompt`
- Кнопка "Установить" / "Позже"

#### 3. usePWA Hook
Основной hook для работы с PWA.

```tsx
import { usePWA } from '@/hooks/usePWA'

function MyComponent() {
  const {
    isInstalled,        // Установлено ли приложение
    isUpdateAvailable,  // Доступно ли обновление
    isOnline,           // Статус сети
    registration,       // Service Worker registration
    updateServiceWorker,
    unregisterServiceWorker,
    cacheUrls,
    clearCache,
  } = usePWA()
}
```

#### 4. usePushNotifications Hook
Hook для работы с push уведомлениями.

```tsx
import { usePushNotifications } from '@/hooks/usePWA'

function NotificationSettings() {
  const {
    permission,         // 'granted' | 'denied' | 'default'
    subscription,       // PushSubscription или null
    requestPermission,
    subscribe,
    unsubscribe,
  } = usePushNotifications()

  const handleEnable = async () => {
    const granted = await requestPermission()
    if (granted) {
      const sub = await subscribe(VAPID_PUBLIC_KEY)
      // Отправить subscription на сервер
    }
  }
}
```

---

## Service Worker

### Стратегии кеширования

#### Cache First
Используется для: статические ресурсы, изображения, шрифты
```
Cache → Network (если не в кеше) → Cache (сохранить)
```

#### Network First
Используется для: API запросы, динамический контент
```
Network → Cache (сохранить) → Cache (если сеть недоступна)
```

#### Stale While Revalidate
Используется для: JS/CSS файлы
```
Cache (отдать сразу) → Network (обновить в фоне)
```

### Файлы и паттерны

```javascript
// sw.js
const ROUTE_STRATEGIES = [
  {
    pattern: /\/_next\/static\//,
    strategy: 'cache-first',
    cacheName: 'dmed-letters-static',
  },
  {
    pattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
    strategy: 'cache-first',
    cacheName: 'dmed-letters-images',
  },
  {
    pattern: /\/api\//,
    strategy: 'network-first',
    cacheName: 'dmed-letters-api',
  },
]
```

---

## Manifest.json

### Основные поля

```json
{
  "name": "DMED Letters",
  "short_name": "DMED",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#14b8a6",
  "background_color": "#0f172a"
}
```

### Иконки
Приложение использует SVG иконки:
- `/favicon.svg` - основная иконка
- `/apple-touch-icon.svg` - для iOS
- `/logo-mark.svg` - для maskable icon

### Shortcuts
Быстрые действия с домашнего экрана:
- Новое письмо → `/letters/new`
- Все письма → `/letters`
- Отчёты → `/reports`

### Share Target
Позволяет принимать файлы из других приложений:
```json
{
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{
        "name": "file",
        "accept": ["image/*", "application/pdf", ".doc", ".docx"]
      }]
    }
  }
}
```

---

## Использование

### 1. Установка приложения

**На Android:**
1. Откройте сайт в Chrome
2. Нажмите на баннер "Установить приложение" или
3. Меню → "Установить приложение"

**На iOS:**
1. Откройте сайт в Safari
2. Нажмите кнопку "Поделиться"
3. Выберите "На экран Домой"
4. Нажмите "Добавить"

**На Desktop:**
1. Нажмите на иконку установки в адресной строке или
2. Откроется автоматический prompt

### 2. Обновление приложения

Когда доступна новая версия:
1. Появится уведомление "Доступно обновление"
2. Нажмите "Обновить"
3. Приложение перезагрузится с новой версией

### 3. Offline режим

Приложение автоматически:
- Кеширует посещённые страницы
- Показывает индикатор "Нет подключения"
- Позволяет просматривать кешированный контент
- Синхронизирует данные при восстановлении связи

### 4. Push уведомления

```tsx
// В компоненте настроек
import { usePushNotifications } from '@/hooks/usePWA'

function Settings() {
  const { permission, requestPermission, subscribe } = usePushNotifications()

  const enableNotifications = async () => {
    // 1. Запросить разрешение
    const granted = await requestPermission()

    if (granted) {
      // 2. Подписаться на push
      const subscription = await subscribe(process.env.NEXT_PUBLIC_VAPID_KEY!)

      // 3. Отправить subscription на сервер
      await fetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription)
      })
    }
  }

  return (
    <button
      onClick={enableNotifications}
      disabled={permission === 'denied'}
    >
      {permission === 'granted' ? 'Включены' : 'Включить уведомления'}
    </button>
  )
}
```

---

## API для разработчиков

### Кеширование пользовательских URL

```tsx
import { usePWA } from '@/hooks/usePWA'

function MyComponent() {
  const { cacheUrls } = usePWA()

  useEffect(() => {
    // Предзагрузить важные страницы
    cacheUrls([
      '/letters',
      '/reports',
      '/settings'
    ])
  }, [])
}
```

### Очистка кеша

```tsx
import { usePWA } from '@/hooks/usePWA'

function Settings() {
  const { clearCache } = usePWA()

  const handleClearCache = async () => {
    await clearCache()
    alert('Кеш очищен')
  }
}
```

### Ручная проверка обновлений

```tsx
import { usePWA } from '@/hooks/usePWA'

function Header() {
  const { registration } = usePWA()

  const checkForUpdates = async () => {
    if (registration) {
      await registration.update()
    }
  }
}
```

---

## Best Practices

### 1. Не кешировать чувствительные данные
```javascript
// В sw.js - исключить авторизационные endpoints
if (url.pathname.includes('/api/auth')) {
  return fetch(request) // Network only
}
```

### 2. Версионирование кеша
```javascript
const CACHE_VERSION = 'v1.0.0'
const CACHE_NAME = `dmed-letters-${CACHE_VERSION}`
```

### 3. Лимит размера кеша
Периодически очищайте старые кеши:
```javascript
// Удалить кеши старше 30 дней
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000
```

### 4. Показывать статус сети
Всегда информировать пользователя о статусе подключения.

### 5. Graceful degradation
Приложение должно работать даже если Service Worker не поддерживается.

---

## Тестирование PWA

### Chrome DevTools

1. **Application tab**:
   - Проверить manifest
   - Просмотреть Service Workers
   - Инспектировать Cache Storage

2. **Lighthouse**:
   - Запустить PWA audit
   - Проверить все критерии
   - Цель: 100% по PWA категории

3. **Network tab**:
   - Включить "Offline"
   - Проверить работу без сети

### Тестирование на устройствах

**Android:**
- Chrome DevTools Remote Debugging
- Проверка через USB

**iOS:**
- Safari Web Inspector
- Проверка на реальном устройстве

---

## Troubleshooting

### Service Worker не регистрируется

**Проверьте:**
1. HTTPS подключение (обязательно для SW)
2. Путь к sw.js корректный
3. Консоль браузера на ошибки

```javascript
// Добавить логирование
navigator.serviceWorker.register('/sw.js')
  .then(reg => console.log('SW registered:', reg))
  .catch(err => console.error('SW registration failed:', err))
```

### Кеш не обновляется

**Решение:**
1. Увеличить CACHE_VERSION в sw.js
2. Вызвать `updateServiceWorker()`
3. Перезагрузить страницу

### iOS не показывает install prompt

**iOS не поддерживает `beforeinstallprompt`**
- Используется компонент с инструкциями
- Пользователь добавляет вручную

### Push уведомления не работают

**Проверьте:**
1. VAPID ключи настроены
2. Разрешение получено
3. Service Worker активен
4. HTTPS подключение

---

## Производительность

### Метрики

- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

### Оптимизации

1. **Precaching**: Критические ресурсы кешируются при установке
2. **Lazy Loading**: Некритические ресурсы загружаются по требованию
3. **Code Splitting**: Next.js автоматически разбивает код
4. **Image Optimization**: WebP формат + lazy loading

---

## Безопасность

### HTTPS обязателен
Service Workers работают только по HTTPS (кроме localhost).

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'">
```

### Scope ограничения
Service Worker имеет доступ только к своему scope (по умолчанию `/`).

---

## Roadmap

- [ ] Добавить фоновую синхронизацию
- [ ] Реализовать периодическую синхронизацию
- [ ] Добавить Web Share API
- [ ] Реализовать Badging API для уведомлений
- [ ] Добавить скриншоты в manifest
- [ ] Создать иконки разных размеров (PNG)

---

## Полезные ссылки

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA](https://web.dev/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox (Google)](https://developers.google.com/web/tools/workbox)
