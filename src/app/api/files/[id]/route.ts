import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { deleteDriveFile, extractDriveFileId } from '@/lib/google-drive'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// DELETE /api/files/[id] - удалить файл
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: { letter: true },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Удалить физический файл
    const driveFileId = extractDriveFileId(file.url)
    if (driveFileId) {
      try {
        await deleteDriveFile(driveFileId)
      } catch (error) {
        console.error('Drive delete failed:', error)
      }
    } else if (file.url.startsWith('/uploads/')) {
      const filePath = join(process.cwd(), 'public', file.url)
      if (existsSync(filePath)) {
        await unlink(filePath)
      }
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
    console.error('DELETE /api/files/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
