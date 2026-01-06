import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, dirname, join } from 'path'

const DEFAULT_UPLOADS_ROOT = process.env.VERCEL
  ? join(process.env.TMPDIR || '/tmp', 'dmed-uploads')
  : join(process.cwd(), 'public', 'uploads')

const LOCAL_UPLOADS_ROOT = process.env.LOCAL_UPLOADS_DIR || DEFAULT_UPLOADS_ROOT

const MAX_SAFE_NAME_LENGTH = 200
const FALLBACK_FILE_NAME = 'file'

function sanitizeStorageFileName(fileName: string) {
  const baseName = basename(fileName || '')
  const normalized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').trim()
  const stripped = normalized.replace(/^\.+/, '')
  const safeName = stripped || FALLBACK_FILE_NAME
  return safeName.slice(0, MAX_SAFE_NAME_LENGTH)
}

export function getLocalUploadsRoot() {
  return LOCAL_UPLOADS_ROOT
}

export function buildLocalStoragePath(letterId: string, fileName: string) {
  const safeName = sanitizeStorageFileName(fileName)
  return join('letters', letterId, safeName).replace(/\\/g, '/')
}

export function buildRequestStoragePath(requestId: string, fileName: string) {
  const safeName = sanitizeStorageFileName(fileName)
  return join('requests', requestId, safeName).replace(/\\/g, '/')
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
