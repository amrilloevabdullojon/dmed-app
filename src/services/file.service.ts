import { prisma } from '@/lib/prisma'
import { saveLocalUpload } from '@/lib/file-storage'
import { syncFileToDrive } from '@/lib/file-sync'
import { logger } from '@/lib/logger.server'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/constants'
import type { File, FileStatus, FileStorageProvider, Prisma } from '@prisma/client'
import { env } from '@/lib/env.validation'

/**
 * File Service - Централизованный сервис для работы с файлами
 *
 * Функции:
 * - Загрузка файлов
 * - Синхронизация с Google Drive
 * - Получение файлов письма
 * - Удаление файлов
 */

export class FileServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'FileServiceError'
  }
}

export type UploadFileInput = {
  file: File | Blob
  letterId: string
  userId: string
  fileName: string
}

export type FileFilters = {
  letterId?: string
  status?: FileStatus
  mimeType?: string
}

const UPLOAD_STRATEGY = env.FILE_UPLOAD_STRATEGY || 'async'
const ENABLE_ASYNC_SYNC = env.FILE_SYNC_ASYNC !== false

export class FileService {
  /**
   * Загрузить файл и прикрепить к письму
   *
   * @example
   * const file = await FileService.upload({
   *   file: formFile,
   *   letterId: 'letter123',
   *   userId: 'user1',
   *   fileName: 'document.pdf'
   * })
   */
  static async upload(input: UploadFileInput): Promise<File> {
    const startTime = logger.startTimer()

    try {
      // Validate file
      await this.validateFile(input.file)

      // Verify letter exists
      const letter = await prisma.letter.findUnique({
        where: { id: input.letterId },
        select: { id: true, ownerId: true },
      })

      if (!letter) {
        throw new FileServiceError('Письмо не найдено', 'LETTER_NOT_FOUND', 404)
      }

      // Create safe file name
      const timestamp = Date.now()
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storedFileName = `${timestamp}_${safeFileName}`

      // Save file locally
      const bytes = await input.file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const localUpload = await saveLocalUpload({
        buffer,
        letterId: input.letterId,
        fileName: storedFileName,
      })

      // Create file record in database
      const fileRecord = await prisma.file.create({
        data: {
          name: input.fileName,
          url: localUpload.url,
          size: input.file.size,
          mimeType: input.file.type,
          letterId: input.letterId,
          storageProvider: 'LOCAL',
          storagePath: localUpload.storagePath,
          status: 'PENDING_SYNC',
        },
      })

      // Queue sync to Drive based on strategy
      if (UPLOAD_STRATEGY === 'sync') {
        // Synchronous upload
        await this.syncToDrive(fileRecord.id)
      } else if (ENABLE_ASYNC_SYNC) {
        // Async upload
        this.queueSyncToDrive(fileRecord.id)
      }

      logger.performance('file.service', 'File uploaded', startTime, {
        fileId: fileRecord.id,
        size: fileRecord.size,
        strategy: UPLOAD_STRATEGY,
      })

      return fileRecord
    } catch (error) {
      if (error instanceof FileServiceError) {
        throw error
      }
      logger.error('file.service', error, {
        letterId: input.letterId,
        fileName: input.fileName,
      })
      throw new FileServiceError(
        'Ошибка при загрузке файла',
        'UPLOAD_FAILED',
        500
      )
    }
  }

  /**
   * Валидация файла перед загрузкой
   */
  private static async validateFile(file: File | Blob): Promise<void> {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new FileServiceError(
        `Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        'FILE_TOO_LARGE',
        400
      )
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
      throw new FileServiceError(
        'Тип файла не поддерживается',
        'INVALID_FILE_TYPE',
        400
      )
    }
  }

  /**
   * Синхронизировать файл с Google Drive (синхронно)
   */
  private static async syncToDrive(fileId: string): Promise<void> {
    try {
      await syncFileToDrive(fileId)
      logger.info('file.service', 'File synced to Drive', { fileId })
    } catch (error) {
      logger.error('file.service', error, { fileId, operation: 'sync' })
      throw new FileServiceError(
        'Ошибка при синхронизации с Drive',
        'SYNC_FAILED',
        500
      )
    }
  }

  /**
   * Поставить синхронизацию файла в очередь (асинхронно)
   */
  private static queueSyncToDrive(fileId: string): void {
    setTimeout(() => {
      syncFileToDrive(fileId).catch((error) => {
        logger.error('file.service', error, {
          fileId,
          operation: 'background_sync',
        })
      })
    }, 0)
  }

  /**
   * Получить файлы письма
   *
   * @example
   * const files = await FileService.getByLetter('letter123')
   */
  static async getByLetter(letterId: string): Promise<File[]> {
    try {
      return await prisma.file.findMany({
        where: { letterId },
        orderBy: { createdAt: 'desc' },
      })
    } catch (error) {
      logger.error('file.service', error, { letterId })
      throw new FileServiceError(
        'Ошибка при получении файлов',
        'FETCH_FAILED',
        500
      )
    }
  }

  /**
   * Получить файл по ID
   *
   * @example
   * const file = await FileService.getById('file123')
   */
  static async getById(fileId: string): Promise<File | null> {
    try {
      return await prisma.file.findUnique({
        where: { id: fileId },
      })
    } catch (error) {
      logger.error('file.service', error, { fileId })
      throw new FileServiceError(
        'Ошибка при получении файла',
        'FETCH_FAILED',
        500
      )
    }
  }

  /**
   * Удалить файл
   *
   * @example
   * await FileService.delete('file123', 'user1')
   */
  static async delete(fileId: string, userId: string): Promise<void> {
    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
        include: {
          letter: {
            select: { ownerId: true },
          },
        },
      })

      if (!file) {
        throw new FileServiceError('Файл не найден', 'NOT_FOUND', 404)
      }

      // TODO: Add proper permission check
      // For now, only letter owner can delete files
      if (file.letter.ownerId !== userId) {
        throw new FileServiceError('Доступ запрещен', 'FORBIDDEN', 403)
      }

      await prisma.file.delete({
        where: { id: fileId },
      })

      logger.info('file.service', 'File deleted', { fileId, userId })
    } catch (error) {
      if (error instanceof FileServiceError) {
        throw error
      }
      logger.error('file.service', error, { fileId, userId })
      throw new FileServiceError(
        'Ошибка при удалении файла',
        'DELETE_FAILED',
        500
      )
    }
  }

  /**
   * Обновить статус файла
   *
   * @example
   * await FileService.updateStatus('file123', 'SYNCED', 'https://drive.google.com/...')
   */
  static async updateStatus(
    fileId: string,
    status: FileStatus,
    driveUrl?: string
  ): Promise<void> {
    try {
      await prisma.file.update({
        where: { id: fileId },
        data: {
          status,
          ...(driveUrl && { url: driveUrl }),
        },
      })

      logger.info('file.service', 'File status updated', {
        fileId,
        status,
      })
    } catch (error) {
      logger.error('file.service', error, { fileId, status })
      throw new FileServiceError(
        'Ошибка при обновлении статуса',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Получить статистику по файлам
   *
   * @example
   * const stats = await FileService.getStats('letter123')
   */
  static async getStats(letterId?: string): Promise<{
    total: number
    synced: number
    pending: number
    failed: number
    totalSize: number
  }> {
    try {
      const where = letterId ? { letterId } : {}

      const [files, aggregation] = await Promise.all([
        prisma.file.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.file.aggregate({
          where,
          _sum: {
            size: true,
          },
          _count: true,
        }),
      ])

      const statusCounts = {
        total: aggregation._count,
        synced: 0,
        pending: 0,
        failed: 0,
        totalSize: aggregation._sum.size || 0,
      }

      files.forEach((group) => {
        if (group.status === 'SYNCED') {
          statusCounts.synced = group._count
        } else if (group.status === 'PENDING_SYNC') {
          statusCounts.pending = group._count
        } else if (group.status === 'SYNC_FAILED') {
          statusCounts.failed = group._count
        }
      })

      return statusCounts
    } catch (error) {
      logger.error('file.service', error, { letterId })
      throw new FileServiceError(
        'Ошибка при получении статистики',
        'STATS_FAILED',
        500
      )
    }
  }

  /**
   * Повторить синхронизацию неудачных файлов
   *
   * @example
   * const retried = await FileService.retryFailedSyncs()
   */
  static async retryFailedSyncs(letterId?: string): Promise<number> {
    try {
      const where: Prisma.FileWhereInput = {
        status: 'SYNC_FAILED',
        ...(letterId && { letterId }),
      }

      const failedFiles = await prisma.file.findMany({
        where,
        select: { id: true },
      })

      let retriedCount = 0
      for (const file of failedFiles) {
        try {
          await this.syncToDrive(file.id)
          retriedCount++
        } catch (error) {
          logger.error('file.service', error, {
            fileId: file.id,
            operation: 'retry_sync',
          })
          // Continue with other files
        }
      }

      logger.info('file.service', 'Failed syncs retried', {
        total: failedFiles.length,
        succeeded: retriedCount,
      })

      return retriedCount
    } catch (error) {
      logger.error('file.service', error, { letterId })
      throw new FileServiceError(
        'Ошибка при повторной синхронизации',
        'RETRY_FAILED',
        500
      )
    }
  }
}
