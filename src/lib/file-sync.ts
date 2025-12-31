import { prisma } from '@/lib/prisma'
import { findOrCreateDriveFolder, uploadFileToDrive } from '@/lib/google-drive'
import { deleteLocalFile, readLocalFile } from '@/lib/file-storage'
import { basename } from 'path'
import { FileStatus, FileStorageProvider } from '@prisma/client'

const ATTACHMENTS_ROOT_NAME = 'DMED Letter Attachments'

export async function ensureAttachmentsRootFolderId() {
  const envFolder =
    process.env.GOOGLE_DRIVE_ATTACHMENTS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_FOLDER_ID
  if (envFolder) {
    return envFolder
  }
  return findOrCreateDriveFolder({ name: ATTACHMENTS_ROOT_NAME })
}

export async function ensureLetterAttachmentsFolder(letterId: string) {
  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    select: { id: true, number: true, attachmentsFolderId: true },
  })
  if (!letter) {
    throw new Error('Letter not found')
  }

  if (letter.attachmentsFolderId) {
    return letter.attachmentsFolderId
  }

  const rootId = await ensureAttachmentsRootFolderId()
  const folderId = await findOrCreateDriveFolder({
    name: `letter_${letter.number || letter.id}`,
    parentId: rootId,
  })

  await prisma.letter.update({
    where: { id: letter.id },
    data: { attachmentsFolderId: folderId },
  })

  return folderId
}

function buildDriveFileName(storagePath: string | null, fallbackName: string) {
  if (storagePath) {
    return basename(storagePath)
  }
  const safeName = fallbackName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${Date.now()}_${safeName}`
}

export async function syncFileToDrive(fileId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { letter: { select: { id: true, number: true, attachmentsFolderId: true } } },
  })

  if (!file || file.storageProvider !== FileStorageProvider.LOCAL || !file.storagePath) {
    return null
  }

  await prisma.file.update({
    where: { id: fileId },
    data: {
      status: FileStatus.UPLOADING,
      syncAttempts: { increment: 1 },
      lastSyncAttemptAt: new Date(),
      uploadError: null,
    },
  })

  const buffer = await readLocalFile(file.storagePath)
  if (!buffer) {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.FAILED,
        uploadError: 'Local file not found for sync',
      },
    })
    return null
  }

  try {
    const folderId = file.letter.attachmentsFolderId
      ? file.letter.attachmentsFolderId
      : await ensureLetterAttachmentsFolder(file.letter.id)
    const driveName = buildDriveFileName(file.storagePath, file.name)
    const uploadResult = await uploadFileToDrive({
      buffer,
      name: driveName,
      mimeType: file.mimeType || 'application/octet-stream',
      folderId,
    })

    await prisma.file.update({
      where: { id: fileId },
      data: {
        driveFileId: uploadResult.fileId,
        url: uploadResult.url,
        storageProvider: FileStorageProvider.DRIVE,
        storagePath: null,
        status: FileStatus.READY,
        uploadError: null,
      },
    })

    await deleteLocalFile(file.storagePath)
    return uploadResult
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Drive sync failed'
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.FAILED,
        uploadError: message,
      },
    })
    return null
  }
}

export async function syncPendingFiles(limit = 5) {
  const pending = await prisma.file.findMany({
    where: {
      storageProvider: FileStorageProvider.LOCAL,
      status: { in: [FileStatus.PENDING_SYNC, FileStatus.FAILED] },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  let processed = 0
  for (const item of pending) {
    await syncFileToDrive(item.id)
    processed += 1
  }

  return processed
}
