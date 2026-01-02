'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * State for optimistic updates
 */
interface OptimisticState<T> {
  data: T
  pending: boolean
  error: Error | null
}

/**
 * Options for optimistic mutation
 */
interface OptimisticOptions<T, TInput> {
  /** Function to apply optimistic update */
  optimisticUpdate: (current: T, input: TInput) => T

  /** Function to perform actual mutation */
  mutationFn: (input: TInput) => Promise<T>

  /** Callback on success */
  onSuccess?: (result: T) => void

  /** Callback on error */
  onError?: (error: Error, rollback: T) => void

  /** Delay before applying optimistic update (for debouncing) */
  delay?: number
}

/**
 * Hook for optimistic updates with automatic rollback on error.
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const { data, mutate, pending } = useOptimistic(
 *     initialTodos,
 *     {
 *       optimisticUpdate: (todos, newTodo) => [...todos, { ...newTodo, id: 'temp' }],
 *       mutationFn: async (newTodo) => {
 *         const res = await fetch('/api/todos', { method: 'POST', body: JSON.stringify(newTodo) })
 *         return res.json()
 *       },
 *       onSuccess: (result) => toast.success('Todo added!'),
 *       onError: (error) => toast.error(error.message)
 *     }
 *   )
 *
 *   return (
 *     <ul>
 *       {data.map(todo => <li key={todo.id}>{todo.text}</li>)}
 *       <button onClick={() => mutate({ text: 'New todo' })} disabled={pending}>
 *         Add
 *       </button>
 *     </ul>
 *   )
 * }
 * ```
 */
export function useOptimistic<T, TInput = T>(
  initialData: T,
  options: OptimisticOptions<T, TInput>
): {
  data: T
  pending: boolean
  error: Error | null
  mutate: (input: TInput) => Promise<T | null>
  setData: (data: T | ((prev: T) => T)) => void
  reset: () => void
} {
  const { optimisticUpdate, mutationFn, onSuccess, onError, delay } = options

  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    pending: false,
    error: null,
  })

  const rollbackRef = useRef<T>(initialData)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const mutate = useCallback(
    async (input: TInput): Promise<T | null> => {
      // Clear any pending delayed updates
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Store current state for potential rollback
      rollbackRef.current = state.data

      // Apply optimistic update
      const applyOptimistic = () => {
        const optimisticData = optimisticUpdate(state.data, input)
        setState((prev) => ({
          ...prev,
          data: optimisticData,
          pending: true,
          error: null,
        }))
      }

      if (delay && delay > 0) {
        timeoutRef.current = setTimeout(applyOptimistic, delay)
      } else {
        applyOptimistic()
      }

      try {
        const result = await mutationFn(input)

        // Clear delayed update if still pending
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        setState({
          data: result,
          pending: false,
          error: null,
        })

        onSuccess?.(result)
        return result
      } catch (error) {
        // Clear delayed update if still pending
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        const err = error instanceof Error ? error : new Error(String(error))

        // Rollback to previous state
        setState({
          data: rollbackRef.current,
          pending: false,
          error: err,
        })

        onError?.(err, rollbackRef.current)
        return null
      }
    },
    [state.data, optimisticUpdate, mutationFn, onSuccess, onError, delay]
  )

  const setData = useCallback((dataOrFn: T | ((prev: T) => T)) => {
    setState((prev) => ({
      ...prev,
      data: typeof dataOrFn === 'function' ? (dataOrFn as (prev: T) => T)(prev.data) : dataOrFn,
    }))
  }, [])

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setState({
      data: initialData,
      pending: false,
      error: null,
    })
  }, [initialData])

  return {
    data: state.data,
    pending: state.pending,
    error: state.error,
    mutate,
    setData,
    reset,
  }
}

/**
 * Hook for optimistic list operations (add, update, remove).
 *
 * @example
 * ```tsx
 * const { items, add, update, remove, pending } = useOptimisticList(
 *   initialItems,
 *   {
 *     addFn: (item) => fetch('/api/items', { method: 'POST', body: JSON.stringify(item) }),
 *     updateFn: (id, data) => fetch(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
 *     removeFn: (id) => fetch(`/api/items/${id}`, { method: 'DELETE' }),
 *     getId: (item) => item.id
 *   }
 * )
 * ```
 */
export function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
  options: {
    addFn?: (item: Omit<T, 'id'>) => Promise<T>
    updateFn?: (id: string, data: Partial<T>) => Promise<T>
    removeFn?: (id: string) => Promise<void>
    getId?: (item: T) => string
    onError?: (error: Error, operation: string) => void
  }
): {
  items: T[]
  add: (item: Omit<T, 'id'>) => Promise<T | null>
  update: (id: string, data: Partial<T>) => Promise<T | null>
  remove: (id: string) => Promise<boolean>
  pending: Set<string>
  setItems: (items: T[] | ((prev: T[]) => T[])) => void
} {
  const { addFn, updateFn, removeFn, getId = (item) => item.id, onError } = options

  const [items, setItems] = useState<T[]>(initialItems)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const rollbackRef = useRef<T[]>(initialItems)

  const add = useCallback(
    async (item: Omit<T, 'id'>): Promise<T | null> => {
      if (!addFn) return null

      const tempId = `temp-${Date.now()}`
      const optimisticItem = { ...item, id: tempId } as T

      rollbackRef.current = items
      setItems((prev) => [...prev, optimisticItem])
      setPending((prev) => new Set(prev).add(tempId))

      try {
        const result = await addFn(item)
        setItems((prev) => prev.map((i) => (getId(i) === tempId ? result : i)))
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(tempId)
          return next
        })
        return result
      } catch (error) {
        setItems(rollbackRef.current)
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(tempId)
          return next
        })
        onError?.(error instanceof Error ? error : new Error(String(error)), 'add')
        return null
      }
    },
    [items, addFn, getId, onError]
  )

  const update = useCallback(
    async (id: string, data: Partial<T>): Promise<T | null> => {
      if (!updateFn) return null

      const originalItem = items.find((i) => getId(i) === id)
      if (!originalItem) return null

      rollbackRef.current = items
      setItems((prev) => prev.map((i) => (getId(i) === id ? { ...i, ...data } : i)))
      setPending((prev) => new Set(prev).add(id))

      try {
        const result = await updateFn(id, data)
        setItems((prev) => prev.map((i) => (getId(i) === id ? result : i)))
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        return result
      } catch (error) {
        setItems(rollbackRef.current)
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        onError?.(error instanceof Error ? error : new Error(String(error)), 'update')
        return null
      }
    },
    [items, updateFn, getId, onError]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!removeFn) return false

      rollbackRef.current = items
      setItems((prev) => prev.filter((i) => getId(i) !== id))
      setPending((prev) => new Set(prev).add(id))

      try {
        await removeFn(id)
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        return true
      } catch (error) {
        setItems(rollbackRef.current)
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        onError?.(error instanceof Error ? error : new Error(String(error)), 'remove')
        return false
      }
    },
    [items, removeFn, getId, onError]
  )

  return {
    items,
    add,
    update,
    remove,
    pending,
    setItems,
  }
}
