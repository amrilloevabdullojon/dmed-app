/**
 * tRPC Client Configuration
 *
 * Настройка клиента для использования в React компонентах
 */

import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

// Создание typed hooks
export const trpc = createTRPCReact<AppRouter>()
