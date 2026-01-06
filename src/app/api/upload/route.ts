import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { FileStatus, FileStorageProvider } from '@prisma/client'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/constants'
import { saveLocalUpload } from '@/lib/file-storage'
import { syncFileToDrive } from '@/lib/file-sync'
import { hasPermission } from '@/lib/permissions'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

const UPLOAD_STRATEGY = process.env.FILE_UPLOAD_STRATEGY || 'async'
const ENABLE_ASYNC_SYNC = process.env.FILE_SYNC_ASYNC !== 'false'
// Максимальный размер файла (10 MB)
// POST /api/upload - загрузить файл
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
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
      return NextResponse.json({ error: 'File too large. Max 10 MB' }, { status: 400 })
    }

    // Проверить тип файла
    if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // Проверить, существует ли письмо
    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    const canManageLetters = hasPermission(session.user.role, 'MANAGE_LETTERS')
    const isOwner = letter.ownerId === session.user.id
    if (!canManageLetters && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Создать директорию для загрузок если не существует
    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storedFileName = `${timestamp}_${safeFileName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const localUpload = await saveLocalUpload({
      buffer,
      letterId,
      fileName: storedFileName,
    })

    let fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        url: localUpload.url,
        size: file.size,
        mimeType: file.type,
        letterId,
        storageProvider: FileStorageProvider.LOCAL,
        storagePath: localUpload.storagePath,
        status: FileStatus.PENDING_SYNC,
      },
    })

    const queueSync = () => {
      if (!ENABLE_ASYNC_SYNC) return
      setTimeout(() => {
        syncFileToDrive(fileRecord.id).catch((error) => {
          logger.error('Background drive sync failed', error, { fileId: fileRecord.id })
        })
      }, 0)
    }

    if (UPLOAD_STRATEGY === 'sync') {
      try {
        const uploadResult = await syncFileToDrive(fileRecord.id)
        if (uploadResult) {
          const refreshed = await prisma.file.findUnique({
            where: { id: fileRecord.id },
          })
          if (refreshed) {
            fileRecord = refreshed
          }
        } else {
          queueSync()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Drive upload failed'
        await prisma.file.update({
          where: { id: fileRecord.id },
          data: { uploadError: message, status: FileStatus.PENDING_SYNC },
        })
        queueSync()
      }
    } else {
      queueSync()
    }
    await prisma.history.create({
      data: {
        letterId,
        userId: session.user.id,
        field: 'file_added',
        newValue: file.name,
      },
    })

    return NextResponse.json(
      {
        success: true,
        file: fileRecord,
      },
      { status: UPLOAD_STRATEGY === 'sync' ? 200 : 202 }
    )
  } catch (error) {
    logger.error('POST /api/upload', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
