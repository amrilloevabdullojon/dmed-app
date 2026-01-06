import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculateDeadline } from '@/lib/parsePdfLetter'
import { extractLetterDataFromPdf, translateToRussian } from '@/lib/ai'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не предоставлен' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Файл должен быть в формате PDF' }, { status: 400 })
    }

    // Читаем файл как base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Извлекаем данные из имени файла как fallback
    const filenameMatch = file.name.match(/^(\d+)[_-].*\.pdf$/i)
    const filenameNumber = filenameMatch ? filenameMatch[1] : null

    const fullFilenameMatch = file.name.match(/^(\d+)[_-](\d{2})\.(\d{2})\.(\d{4})[_-](.+)\.pdf$/i)
    let filenameData: { number?: string; date?: Date; description?: string } = {}

    if (fullFilenameMatch) {
      filenameData = {
        number: fullFilenameMatch[1],
        date: new Date(
          parseInt(fullFilenameMatch[4]),
          parseInt(fullFilenameMatch[3]) - 1,
          parseInt(fullFilenameMatch[2])
        ),
        description: fullFilenameMatch[5].replace(/[_-]/g, ' '),
      }
    } else if (filenameNumber) {
      filenameData.number = filenameNumber
    }

    // Отправляем PDF напрямую в Gemini AI
    // eslint-disable-next-line no-console
    console.log('Sending PDF to Gemini AI...')
    const aiData = await extractLetterDataFromPdf(base64)
    // eslint-disable-next-line no-console
    console.log('AI response:', JSON.stringify(aiData, null, 2))

    const normalizeNumber = (value: string | null): string | null => {
      if (!value) return null
      const trimmed = value.trim()
      const match = trimmed.match(/(?:no\.?|num\.?|number|#)[\s:]*([A-Za-z0-9-]+)/i)
      return match ? match[1] : trimmed
    }

    const translateIfNeeded = async (value: string | null) => {
      if (!value) return null
      if (!/[A-Za-z]/.test(value)) return value
      return (await translateToRussian(value)) || value
    }

    // Объединяем данные (приоритет: AI > filename)
    const number = normalizeNumber(aiData?.number || filenameData.number || null)
    const dateStr = aiData?.date || null
    const filenameDate = filenameData.date

    let finalDate: Date | null = null
    if (dateStr) {
      finalDate = new Date(dateStr)
    } else if (filenameDate) {
      finalDate = filenameDate
    }

    // Дедлайн +7 рабочих дней
    const deadline = finalDate ? calculateDeadline(finalDate, 7) : null

    const organization = await translateIfNeeded(aiData?.organization || null)
    const region = await translateIfNeeded(aiData?.region || null)
    const district = await translateIfNeeded(aiData?.district || null)

    return NextResponse.json({
      success: true,
      data: {
        number,
        date: finalDate?.toISOString() || null,
        deadline: deadline?.toISOString() || null,
        organization,
        content: aiData?.contentSummary || filenameData.description || null,
        contentRussian: aiData?.contentRussian || null,
        region,
        district,
      },
      meta: {
        filename: file.name,
        extractedFrom: {
          ai: !!aiData,
          filename: !!filenameData.number,
        },
      },
    })
  } catch (error) {
    logger.error('POST /api/parse-pdf', error)
    return NextResponse.json(
      {
        error: 'Ошибка при обработке PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
