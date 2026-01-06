import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { syncFileToDrive, syncPendingFiles } from '@/lib/file-sync'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger'

// POST /api/files/sync - вручную синхронизировать локальные файлы в Drive
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

    if (!hasPermission(session.user.role, 'MANAGE_LETTERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : 5

    if (fileId) {
      await syncFileToDrive(fileId)
      return NextResponse.json({ success: true, synced: 1 })
    }

    const processed = await syncPendingFiles(Number.isFinite(limit) ? limit : 5)
    return NextResponse.json({ success: true, synced: processed })
  } catch (error) {
    logger.error('POST /api/files/sync', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
