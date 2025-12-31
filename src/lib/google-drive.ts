import { google } from 'googleapis'
import { Readable } from 'stream'

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive']
const DRIVE_SHARE_MODE = (process.env.GOOGLE_DRIVE_SHARE_MODE || 'private').toLowerCase()
const DRIVE_SHARE_DOMAIN = process.env.GOOGLE_DRIVE_SHARE_DOMAIN || ''

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: DRIVE_SCOPES,
  })

  return google.drive({ version: 'v3', auth })
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/'/g, "\\'")
}

export async function findOrCreateDriveFolder(params: {
  name: string
  parentId?: string | null
}) {
  const drive = getDriveClient()
  const parentFilter = params.parentId
    ? `'${params.parentId}' in parents`
    : "'root' in parents"
  const name = escapeDriveQueryValue(params.name)

  const listRes = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and ${parentFilter} and trashed=false`,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const existingId = listRes.data.files?.[0]?.id
  if (existingId) {
    return existingId
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: params.name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: params.parentId ? [params.parentId] : undefined,
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  const folderId = createRes.data.id
  if (!folderId) {
    throw new Error('Drive folder create failed')
  }
  return folderId
}

export async function uploadFileToDrive(params: {
  buffer: Buffer
  name: string
  mimeType: string
  folderId: string
}) {
  const drive = getDriveClient()

  const createRes = await drive.files.create({
    requestBody: {
      name: params.name,
      parents: [params.folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.buffer),
    },
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  })

  const fileId = createRes.data.id
  if (!fileId) {
    throw new Error('Drive upload failed')
  }

  try {
    if (DRIVE_SHARE_MODE === 'public') {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
          allowFileDiscovery: false,
        },
        supportsAllDrives: true,
        sendNotificationEmail: false,
      })
    } else if (DRIVE_SHARE_MODE === 'domain' && DRIVE_SHARE_DOMAIN) {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'domain',
          domain: DRIVE_SHARE_DOMAIN,
        },
        supportsAllDrives: true,
        sendNotificationEmail: false,
      })
    }
  } catch (error) {
    console.warn('Drive share skipped:', error)
  }

  const url =
    createRes.data.webViewLink ||
    createRes.data.webContentLink ||
    `https://drive.google.com/file/d/${fileId}/view`

  return { fileId, url }
}

export async function getDriveFileStream(fileId: string) {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )
  const headerType = res.headers['content-type']
  const contentType = Array.isArray(headerType) ? headerType[0] : headerType
  return { stream: res.data, contentType }
}

export async function deleteDriveFile(fileId: string) {
  const drive = getDriveClient()
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  })
}

export function extractDriveFileId(url: string) {
  const directMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (directMatch?.[1]) return directMatch[1]

  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch?.[1]) return idMatch[1]

  return null
}
