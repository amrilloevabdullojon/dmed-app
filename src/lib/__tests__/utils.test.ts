import {
  formatDate,
  getDaysUntilDeadline,
  pluralizeDays,
  sanitizeInput,
  addWorkingDays,
  getPriorityLabel,
  isDoneStatus,
  cn,
} from '../utils'

describe('formatDate', () => {
  it('formats ISO date correctly', () => {
    expect(formatDate('2024-01-15')).toBe('15.01.2024')
  })

  it('formats Date object correctly', () => {
    const date = new Date(2024, 0, 15) // January 15, 2024
    expect(formatDate(date)).toBe('15.01.2024')
  })

  it('handles null', () => {
    expect(formatDate(null)).toBe('')
  })

  it('parses dot-separated date (DD.MM.YYYY)', () => {
    expect(formatDate('15.01.2024')).toBe('15.01.2024')
  })

  it('parses slash-separated date (DD/MM/YYYY)', () => {
    expect(formatDate('15/01/2024')).toBe('15.01.2024')
  })
})

describe('getDaysUntilDeadline', () => {
  it('returns positive days for future deadline', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    expect(getDaysUntilDeadline(futureDate)).toBe(5)
  })

  it('returns negative days for past deadline', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 3)
    expect(getDaysUntilDeadline(pastDate)).toBe(-3)
  })

  it('returns 0 for today', () => {
    const today = new Date()
    expect(getDaysUntilDeadline(today)).toBe(0)
  })
})

describe('pluralizeDays', () => {
  it('returns "день" for 1', () => {
    expect(pluralizeDays(1)).toBe('день')
    expect(pluralizeDays(21)).toBe('день')
    expect(pluralizeDays(101)).toBe('день')
  })

  it('returns "дня" for 2-4', () => {
    expect(pluralizeDays(2)).toBe('дня')
    expect(pluralizeDays(3)).toBe('дня')
    expect(pluralizeDays(4)).toBe('дня')
    expect(pluralizeDays(22)).toBe('дня')
  })

  it('returns "дней" for 5-20 and 0', () => {
    expect(pluralizeDays(0)).toBe('дней')
    expect(pluralizeDays(5)).toBe('дней')
    expect(pluralizeDays(11)).toBe('дней')
    expect(pluralizeDays(15)).toBe('дней')
    expect(pluralizeDays(20)).toBe('дней')
  })

  it('handles negative numbers', () => {
    expect(pluralizeDays(-1)).toBe('день')
    expect(pluralizeDays(-5)).toBe('дней')
  })
})

describe('sanitizeInput', () => {
  it('escapes HTML tags', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })

  it('escapes quotes', () => {
    expect(sanitizeInput('test "value"')).toBe('test &quot;value&quot;')
  })

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('handles null and undefined', () => {
    expect(sanitizeInput(null)).toBe('')
    expect(sanitizeInput(undefined)).toBe('')
  })

  it('truncates to max length', () => {
    const longText = 'a'.repeat(100)
    expect(sanitizeInput(longText, 10)).toBe('aaaaaaaaaa')
  })
})

describe('addWorkingDays', () => {
  it('adds working days correctly (skips weekends)', () => {
    // Monday + 5 working days = next Monday
    const monday = new Date(2024, 0, 8) // Monday, Jan 8, 2024
    const result = addWorkingDays(monday, 5)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getDate()).toBe(15) // Jan 15
  })

  it('skips weekends', () => {
    // Friday + 1 working day = Monday
    const friday = new Date(2024, 0, 12) // Friday, Jan 12, 2024
    const result = addWorkingDays(friday, 1)
    expect(result.getDay()).toBe(1) // Monday
  })
})

describe('getPriorityLabel', () => {
  it('returns high priority for 70+', () => {
    expect(getPriorityLabel(70)).toEqual({ label: 'Высокий', color: 'text-red-600' })
    expect(getPriorityLabel(100)).toEqual({ label: 'Высокий', color: 'text-red-600' })
  })

  it('returns medium priority for 40-69', () => {
    expect(getPriorityLabel(40)).toEqual({ label: 'Средний', color: 'text-yellow-600' })
    expect(getPriorityLabel(69)).toEqual({ label: 'Средний', color: 'text-yellow-600' })
  })

  it('returns low priority for 0-39', () => {
    expect(getPriorityLabel(0)).toEqual({ label: 'Низкий', color: 'text-green-600' })
    expect(getPriorityLabel(39)).toEqual({ label: 'Низкий', color: 'text-green-600' })
  })
})

describe('isDoneStatus', () => {
  it('returns true for READY and DONE', () => {
    expect(isDoneStatus('READY')).toBe(true)
    expect(isDoneStatus('DONE')).toBe(true)
  })

  it('returns false for other statuses', () => {
    expect(isDoneStatus('NOT_REVIEWED')).toBe(false)
    expect(isDoneStatus('IN_PROGRESS')).toBe(false)
    expect(isDoneStatus('ACCEPTED')).toBe(false)
    expect(isDoneStatus('CLARIFICATION')).toBe(false)
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
