import { GoogleGenAI } from '@google/genai'
import { logger } from '@/lib/logger.server'

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const MAX_AI_RETRIES = 2
const AI_RETRY_BASE_DELAY_MS = 600

export interface ExtractedLetterData {
  number: string | null
  date: string | null
  organization: string | null
  region: string | null
  district: string | null
  contentSummary: string | null
  contentRussian: string | null
}

const EXTRACTION_PROMPT = `Extract letter data from the PDF.
Return clean JSON only (no markdown, no code fences).

Format:
{
  "number": "letter number from the document text (usually after the number sign). Do not use document code or filename. If multiple numbers exist, choose the letter/incoming/outgoing number.",
  "date": "letter date in YYYY-MM-DD or null",
  "organization": "sender organization, translate to Russian if it is not already",
  "region": "region/oblast, translate to Russian if it is not already",
  "district": "district, translate to Russian if it is not already",
  "contentSummary": "short summary in Russian (1-2 sentences) or null",
  "contentRussian": "full translation of the letter text into Russian (if possible) or null"
}

Rules:
- Do not invent data.
- If a field is missing, use null.
- Output JSON only.`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRateLimitError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const err = error as {
    status?: number
    code?: number
    message?: string
    error?: { code?: number; status?: string; message?: string }
  }
  if (err.status === 429 || err.code === 429 || err.error?.code === 429) return true
  const message = [err.message, err.error?.status, err.error?.message].filter(Boolean).join(' ')
  return /RESOURCE_EXHAUSTED|429/i.test(message)
}

const withRetry = async <T>(label: string, action: () => Promise<T>): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      if (!isRateLimitError(error) || attempt === MAX_AI_RETRIES) {
        throw error
      }
      const jitter = Math.floor(Math.random() * 200)
      const delay = AI_RETRY_BASE_DELAY_MS * 2 ** attempt + jitter
      console.warn(`[AI] rate limited, retrying ${label} in ${delay}ms`)
      await sleep(delay)
    }
  }
  throw lastError
}

/**
 * Извлекает данные из PDF напрямую с помощью Gemini Vision
 */
export async function extractLetterDataFromPdf(
  pdfBase64: string
): Promise<ExtractedLetterData | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not configured')
    return null
  }

  try {
    const response = await withRetry('extractLetterDataFromPdf', () =>
      genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      })
    )

    const content = response.text
    if (!content) return null

    // Парсим JSON ответ
    let jsonStr = content.trim()

    // Убираем markdown code blocks если есть
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const data = JSON.parse(jsonStr) as ExtractedLetterData
    return data
  } catch (error) {
    logger.error('AI', error, { action: 'extractLetterDataFromPdf' })
    return null
  }
}

/**
 * Извлекает данные из текста письма с помощью Gemini AI (legacy)
 */
export async function extractLetterDataWithAI(
  pdfText: string
): Promise<ExtractedLetterData | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not configured')
    return null
  }

  try {
    const response = await withRetry('extractLetterDataWithAI', () =>
      genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: EXTRACTION_PROMPT + '\n\nТекст письма:\n' + pdfText.substring(0, 4000),
      })
    )

    const content = response.text
    if (!content) return null

    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7)
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3)
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3)
    jsonStr = jsonStr.trim()

    return JSON.parse(jsonStr) as ExtractedLetterData
  } catch (error) {
    logger.error('AI', error, { action: 'extractLetterDataWithAI' })
    return null
  }
}

/**
 * Переводит текст на русский с помощью Gemini
 */
export async function translateToRussian(text: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null

  try {
    const response = await withRetry('translateToRussian', () =>
      genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Translate to Russian. Return only the translation:

  ${text}`,
      })
    )
    return response.text || null
  } catch (error) {
    logger.error('AI', error, { action: 'translateToRussian' })
    return null
  }
}

/**
 * Создаёт краткое содержание письма
 */
export async function summarizeLetter(text: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null

  try {
    const response = await withRetry('summarizeLetter', () =>
      genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Summarize in Russian (1-2 sentences):

  ${text}`,
      })
    )
    return response.text || null
  } catch (error) {
    logger.error('AI', error, { action: 'summarizeLetter' })
    return null
  }
}
