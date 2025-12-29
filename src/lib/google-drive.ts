import { google } from 'googleapis'
import { Readable } from 'stream'

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive']

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

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
    sendNotificationEmail: false,
  })

  const url =
    createRes.data.webViewLink ||
    createRes.data.webContentLink ||
    `https://drive.google.com/file/d/${fileId}/view`

  return { fileId, url }
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
