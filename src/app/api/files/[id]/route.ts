import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { deleteDriveFile, extractDriveFileId, getDriveFileStream } from '@/lib/google-drive'
import { deleteLocalFile, getLocalFileAbsolutePath } from '@/lib/file-storage'
import { hasPermission } from '@/lib/permissions'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger'
import { FileStorageProvider, FileStatus } from '@prisma/client'
import { createReadStream, existsSync } from 'fs'
import { Readable } from 'stream'

// GET /api/files/[id] - скачать файл через backend
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewLetters = hasPermission(session.user.role, 'VIEW_LETTERS')
    if (!canViewLetters) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: { letter: { select: { id: true, ownerId: true, deletedAt: true } } },
    })

    if (!file || file.letter.deletedAt) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.storageProvider === FileStorageProvider.LOCAL && file.storagePath) {
      const absolutePath = getLocalFileAbsolutePath(file.storagePath)
      if (!existsSync(absolutePath)) {
        await prisma.file.update({
          where: { id: file.id },
          data: {
            status: FileStatus.FAILED,
            uploadError: 'Local file missing',
          },
        })
        return NextResponse.json({ error: 'File missing' }, { status: 404 })
      }

      const stream = Readable.toWeb(createReadStream(absolutePath) as any)
      return new NextResponse(stream as any, {
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename=\"${encodeURIComponent(file.name)}\"`,
        },
      })
    }

    const driveFileId = file.driveFileId || extractDriveFileId(file.url)
    if (!driveFileId) {
      return NextResponse.json({ error: 'File location unknown' }, { status: 404 })
    }

    const { stream: driveStream, contentType } = await getDriveFileStream(driveFileId)
    const stream = Readable.toWeb(driveStream as any)
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': contentType || file.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename=\"${encodeURIComponent(file.name)}\"`,
      },
    })
  } catch (error) {
    logger.error('GET /api/files/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/files/[id] - удалить файл
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const canViewLetters = hasPermission(session.user.role, 'VIEW_LETTERS')
    if (!canViewLetters) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: { letter: { select: { id: true, ownerId: true, deletedAt: true } } },
    })

    if (!file || file.letter.deletedAt) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const canManageLetters = hasPermission(session.user.role, 'MANAGE_LETTERS')
    const isOwner = file.letter.ownerId === session.user.id
    if (!canManageLetters && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Удалить физический файл
    const driveFileId = file.driveFileId || extractDriveFileId(file.url)
    if (driveFileId && file.storageProvider !== FileStorageProvider.LOCAL) {
      try {
        await deleteDriveFile(driveFileId)
      } catch (error) {
        logger.error('Drive delete failed', error, { fileId: file.id })
      }
    } else if (file.storageProvider === FileStorageProvider.LOCAL && file.storagePath) {
      await deleteLocalFile(file.storagePath)
    } else if (file.url.startsWith('/uploads/')) {
      await deleteLocalFile(file.url.replace('/uploads/', ''))
    }

    // Удалить запись из базы данных
    await prisma.file.delete({
      where: { id: params.id },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId: file.letterId,
        userId: session.user.id,
        field: 'file_deleted',
        oldValue: file.name,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/files/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
