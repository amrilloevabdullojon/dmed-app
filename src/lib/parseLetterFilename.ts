/**
 * Парсинг имени файла письма
 * Формат: НОМЕР_ДД.ММ.ГГГГ_СОДЕРЖАНИЕ.расширение
 * Пример: 7941_28.10.2025_DMEDda xatoni tog'irlash.pdf
 */

export interface ParsedLetterFile {
  number: string
  date: Date
  content: string
  originalFilename: string
  isValid: boolean
  error?: string
}

export function parseLetterFilename(filename: string): ParsedLetterFile {
  const result: ParsedLetterFile = {
    number: '',
    date: new Date(),
    content: '',
    originalFilename: filename,
    isValid: false,
  }

  try {
    // Убираем расширение файла
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '')

    // Разбиваем по первому и второму подчёркиванию
    const parts = nameWithoutExt.split('_')

    if (parts.length < 3) {
      result.error = 'Неверный формат. Ожидается: НОМЕР_ДД.ММ.ГГГГ_СОДЕРЖАНИЕ'
      return result
    }

    // Номер письма (первая часть)
    const number = parts[0].trim()
    if (!number) {
      result.error = 'Не удалось определить номер письма'
      return result
    }
    result.number = number

    // Дата (вторая часть)
    const dateStr = parts[1].trim()
    const dateMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (!dateMatch) {
      result.error = `Неверный формат даты: ${dateStr}. Ожидается ДД.ММ.ГГГГ`
      return result
    }

    const day = parseInt(dateMatch[1], 10)
    const month = parseInt(dateMatch[2], 10) - 1 // месяцы 0-11
    const year = parseInt(dateMatch[3], 10)

    const parsedDate = new Date(year, month, day)
    if (isNaN(parsedDate.getTime())) {
      result.error = 'Неверная дата'
      return result
    }
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month ||
      parsedDate.getDate() !== day
    ) {
      result.error = 'Invalid date in filename'
      return result
    }
    result.date = parsedDate

    // Содержание (всё после второго подчёркивания)
    const content = parts.slice(2).join('_').trim()
    result.content = content || 'Без темы'

    result.isValid = true
    return result
  } catch (error) {
    result.error = 'Ошибка парсинга имени файла'
    return result
  }
}

/**
 * Определяет организацию по содержимому (эвристика)
 */
export function guessOrganization(content: string): string {
  const lower = content.toLowerCase()

  // Известные организации/ключевые слова
  const orgPatterns: Record<string, string[]> = {
    DMED: ['dmed', 'дмед'],
    Минздрав: ['минздрав', 'minzdrav', 'ssv', 'ссв'],
    Хокимият: ['хокимият', 'hokimiyat', 'hokim'],
    Прокуратура: ['прокуратура', 'prokuratura'],
    Налоговая: ['налог', 'soliq', 'gni'],
  }

  for (const [org, patterns] of Object.entries(orgPatterns)) {
    if (patterns.some((p) => lower.includes(p))) {
      return org
    }
  }

  return '' // Пустая строка - пользователь введёт вручную
}

/**
 * Рассчитывает дедлайн (по умолчанию +7 рабочих дней)
 */
export function calculateDeadline(date: Date, workingDays: number = 7): Date {
  const result = new Date(date)
  let added = 0

  while (added < workingDays) {
    result.setDate(result.getDate() + 1)
    const dayOfWeek = result.getDay()
    // Пропускаем субботу (6) и воскресенье (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++
    }
  }

  return result
}

/**
 * Форматирование даты для input[type="date"]
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
