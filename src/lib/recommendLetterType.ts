import { LETTER_TYPES } from '@/lib/constants'

interface RecommendTypeInput {
  content?: string | null
  contentRussian?: string | null
  organization?: string | null
  filename?: string | null
}

type LetterTypeOption = { value: string; label?: string }

const STOP_WORDS = new Set([
  'и',
  'в',
  'на',
  'по',
  'к',
  'о',
  'об',
  'от',
  'для',
  'из',
  'с',
  'про',
  'при',
  'до',
  'или',
  'без',
  'над',
])

const normalizeText = (value: string) => value.toLowerCase().replace(/ё/g, 'е')

const tokenize = (value: string) =>
  normalizeText(value)
    .split(/[^A-Za-z0-9\u0400-\u04FF]+/)
    .filter(Boolean)

const buildTypeTokens = (label: string) =>
  tokenize(label).filter((token) => token.length > 2 && !STOP_WORDS.has(token))

const tokenMatches = (token: string, words: string[]) => {
  const needle = token.length > 6 ? token.slice(0, 6) : token
  return words.some((word) => word.startsWith(needle))
}

export function recommendLetterType(input: RecommendTypeInput): string {
  const sourceText = [input.contentRussian, input.content, input.organization, input.filename]
    .filter(Boolean)
    .join(' ')

  if (!sourceText.trim()) return ''

  const normalizedSource = normalizeText(sourceText)
  const words = tokenize(sourceText)
  let bestType = ''
  let bestScore = 0

  const letterTypes = LETTER_TYPES as ReadonlyArray<LetterTypeOption>

  for (const type of letterTypes) {
    if (type.value === 'all') continue

    const label = type.label || type.value
    const tokens = buildTypeTokens(label)
    let score = 0

    if (normalizedSource.includes(normalizeText(label))) {
      score += 3
    }

    for (const token of tokens) {
      if (tokenMatches(token, words)) {
        score += 1
      }
    }

    const minScore = tokens.length <= 1 ? 1 : 2
    if (score >= minScore && score > bestScore) {
      bestScore = score
      bestType = type.value
    }
  }

  return bestType
}
