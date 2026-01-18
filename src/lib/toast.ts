import { toast as sonnerToast } from 'sonner'

/**
 * Утилиты для работы с toast уведомлениями
 * Обёртка над Sonner для консистентного использования
 */

export const toast = {
  /**
   * Успешное уведомление
   */
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      duration: 3000,
    })
  },

  /**
   * Уведомление об ошибке
   */
  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      duration: 5000,
    })
  },

  /**
   * Информационное уведомление
   */
  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      duration: 4000,
    })
  },

  /**
   * Предупреждение
   */
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      duration: 4000,
    })
  },

  /**
   * Promise-based уведомление
   * Автоматически показывает loading, success или error
   */
  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: any) => string)
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
    })
  },

  /**
   * Загрузочное уведомление
   * Возвращает функцию dismiss для закрытия
   */
  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    })
  },

  /**
   * Закрыть конкретное уведомление
   */
  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId)
  },

  /**
   * Закрыть все уведомления
   */
  dismissAll: () => {
    sonnerToast.dismiss()
  },
}

/**
 * Обработчик ошибок для API запросов
 */
export function handleApiError(error: any, customMessage?: string) {
  console.error('API Error:', error)

  const message = customMessage || 'Произошла ошибка'
  const description =
    error?.response?.data?.message || error?.message || 'Попробуйте еще раз'

  toast.error(message, description)
}

/**
 * Успешная операция с данными
 */
export function toastSuccess(action: string, entity?: string) {
  const entityText = entity ? ` ${entity}` : ''
  toast.success(`${action}${entityText} успешно выполнено`)
}

/**
 * Провальная операция
 */
export function toastError(action: string, entity?: string, error?: any) {
  const entityText = entity ? ` ${entity}` : ''
  const description = error?.message || 'Попробуйте еще раз'
  toast.error(`Не удалось ${action}${entityText}`, description)
}

/**
 * Операция удаления
 */
export function toastDelete(entity: string) {
  toast.success(`${entity} удалено`)
}

/**
 * Операция создания
 */
export function toastCreate(entity: string) {
  toast.success(`${entity} создано`)
}

/**
 * Операция обновления
 */
export function toastUpdate(entity: string) {
  toast.success(`${entity} обновлено`)
}

/**
 * Операция копирования
 */
export function toastCopy(what: string = 'Скопировано') {
  toast.success(what, 'Скопировано в буфер обмена')
}
