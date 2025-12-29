import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { uploadFileToDrive } from '@/lib/google-drive'

// Максимальный размер файла (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Допустимые типы файлов
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

// POST /api/upload - загрузить файл
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const letterId = formData.get('letterId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!letterId) {
      return NextResponse.json({ error: 'Letter ID required' }, { status: 400 })
    }

    // Проверить размер файла
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Max 10 MB' },
        { status: 400 }
      )
    }

    // Проверить тип файла
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Проверить, существует ли письмо
    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Создать директорию для загрузок если не существует
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) {
      return NextResponse.json(
        { error: 'Google Drive folder is not configured' },
        { status: 500 }
      )
    }

    // Сгенерировать уникальное имя файла
    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${safeFileName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadResult = await uploadFileToDrive({
      buffer,
      name: fileName,
      mimeType: file.type || 'application/octet-stream',
      folderId,
    })

    // Создать запись в базе данных
    const fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        url: uploadResult.url,
        size: file.size,
        mimeType: file.type,
        letterId,
      },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId,
        userId: session.user.id,
        field: 'file_added',
        newValue: file.name,
      },
    })

    return NextResponse.json({
      success: true,
      file: fileRecord,
    })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
