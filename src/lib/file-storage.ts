import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, join } from 'path'

const DEFAULT_UPLOADS_ROOT = process.env.VERCEL
  ? join(process.env.TMPDIR || '/tmp', 'dmed-uploads')
  : join(process.cwd(), 'public', 'uploads')

const LOCAL_UPLOADS_ROOT = process.env.LOCAL_UPLOADS_DIR || DEFAULT_UPLOADS_ROOT

export function getLocalUploadsRoot() {
  return LOCAL_UPLOADS_ROOT
}

export function buildLocalStoragePath(letterId: string, fileName: string) {
  return join('letters', letterId, fileName).replace(/\\/g, '/')
}

export function buildRequestStoragePath(requestId: string, fileName: string) {
  return join('requests', requestId, fileName).replace(/\\/g, '/')
}

export function getLocalFileAbsolutePath(storagePath: string) {
  return join(LOCAL_UPLOADS_ROOT, storagePath)
}

export async function saveLocalUpload(params: {
  buffer: Buffer
  letterId: string
  fileName: string
}) {
  const storagePath = buildLocalStoragePath(params.letterId, params.fileName)
  const absolutePath = getLocalFileAbsolutePath(storagePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, params.buffer)
  return {
    storagePath,
    absolutePath,
    url: `/uploads/${storagePath}`.replace(/\\/g, '/'),
  }
}

export async function saveLocalRequestUpload(params: {
  buffer: Buffer
  requestId: string
  fileName: string
}) {
  const storagePath = buildRequestStoragePath(params.requestId, params.fileName)
  const absolutePath = getLocalFileAbsolutePath(storagePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, params.buffer)
  return {
    storagePath,
    absolutePath,
    url: `/uploads/${storagePath}`.replace(/\\/g, '/'),
  }
}

export async function readLocalFile(storagePath: string) {
  const absolutePath = getLocalFileAbsolutePath(storagePath)
  if (!existsSync(absolutePath)) {
    return null
  }
  return readFile(absolutePath)
}

export async function deleteLocalFile(storagePath: string) {
  const absolutePath = getLocalFileAbsolutePath(storagePath)
  if (!existsSync(absolutePath)) {
    return
  }
  await unlink(absolutePath)
}
