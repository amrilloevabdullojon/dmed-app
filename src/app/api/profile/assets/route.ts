import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import {
  extractDriveFileId,
  findOrCreateDriveFolder,
  getDriveFileStream,
  uploadFileToDrive,
} from '@/lib/google-drive'
import { Readable } from 'stream'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function GET(request: NextRequest) {
  try {
    const fileIdParam = request.nextUrl.searchParams.get('fileId')
    const urlParam = request.nextUrl.searchParams.get('url')
    const fileId = fileIdParam || (urlParam ? extractDriveFileId(urlParam) : null)

    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    const profile = await prisma.userProfile.findFirst({
      where: {
        OR: [
          { avatarUrl: { contains: fileId } },
          { coverUrl: { contains: fileId } },
        ],
      },
      select: { publicProfileEnabled: true },
    })

    if (!profile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (!session && !profile.publicProfileEnabled) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stream: driveStream, contentType } = await getDriveFileStream(fileId)
    const stream = Readable.toWeb(driveStream as any)
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('GET /api/profile/assets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (type !== 'avatar' && type !== 'cover') {
      return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Max 5 MB' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) {
      folderId = await findOrCreateDriveFolder({
        name: 'DMED Profile Assets',
      })
    }

    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `profile_${type}_${session.user.id}_${timestamp}_${safeFileName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadResult = await uploadFileToDrive({
      buffer,
      name: fileName,
      mimeType: file.type || 'application/octet-stream',
      folderId,
    })

    const assetUrl = `/api/profile/assets?fileId=${encodeURIComponent(
      uploadResult.fileId
    )}&v=${timestamp}`
    const data = type === 'avatar' ? { avatarUrl: assetUrl } : { coverUrl: assetUrl }

    const profile = await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    })

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('POST /api/profile/assets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
