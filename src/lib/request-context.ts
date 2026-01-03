import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'crypto'

interface RequestContext {
  requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(fn: () => Promise<T> | T, requestId?: string) {
  const context: RequestContext = {
    requestId: requestId || randomUUID(),
  }
  return storage.run(context, fn)
}

export function getRequestContext() {
  return storage.getStore()
}
