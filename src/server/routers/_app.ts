/**
 * Main tRPC Router
 *
 * Объединяет все sub-роутеры в один главный роутер
 */

import { router } from '../trpc'
import { lettersRouter } from './letters'
import { usersRouter } from './users'
import { requestsRouter } from './requests'

export const appRouter = router({
  letters: lettersRouter,
  users: usersRouter,
  requests: requestsRouter,
  // Можно добавить ещё роутеры:
  // notifications: notificationsRouter,
  // templates: templatesRouter,
  // stats: statsRouter,
  // etc.
})

// Экспорт типа роутера для использования на клиенте
export type AppRouter = typeof appRouter
