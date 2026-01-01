import { logger } from '../logger'

describe('logger', () => {
  let consoleSpy: {
    info: jest.SpyInstance
    warn: jest.SpyInstance
    error: jest.SpyInstance
    debug: jest.SpyInstance
  }

  beforeEach(() => {
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('info', () => {
    it('logs info messages with context', () => {
      logger.info('TestContext', 'Test message')

      expect(consoleSpy.info).toHaveBeenCalled()
      const logOutput = consoleSpy.info.mock.calls[0][0]
      expect(logOutput).toContain('[INFO]')
      expect(logOutput).toContain('[TestContext]')
      expect(logOutput).toContain('Test message')
    })

    it('includes meta data when provided', () => {
      logger.info('TestContext', 'Test message', { userId: '123' })

      const logOutput = consoleSpy.info.mock.calls[0][0]
      expect(logOutput).toContain('"userId":"123"')
    })
  })

  describe('warn', () => {
    it('logs warning messages', () => {
      logger.warn('TestContext', 'Warning message')

      expect(consoleSpy.warn).toHaveBeenCalled()
      const logOutput = consoleSpy.warn.mock.calls[0][0]
      expect(logOutput).toContain('[WARN]')
    })
  })

  describe('error', () => {
    it('logs error messages', () => {
      logger.error('TestContext', 'Error message')

      expect(consoleSpy.error).toHaveBeenCalled()
      const logOutput = consoleSpy.error.mock.calls[0][0]
      expect(logOutput).toContain('[ERROR]')
    })

    it('handles Error objects with stack trace', () => {
      const error = new Error('Test error')
      logger.error('TestContext', error)

      const logOutput = consoleSpy.error.mock.calls[0][0]
      expect(logOutput).toContain('Test error')
      expect(logOutput).toContain('Error') // Stack trace contains "Error"
    })

    it('includes meta data with errors', () => {
      const error = new Error('Test error')
      logger.error('TestContext', error, { requestId: 'abc123' })

      const logOutput = consoleSpy.error.mock.calls[0][0]
      expect(logOutput).toContain('"requestId":"abc123"')
    })
  })

  describe('timestamp', () => {
    it('includes ISO timestamp in all logs', () => {
      logger.info('TestContext', 'Test message')

      const logOutput = consoleSpy.info.mock.calls[0][0]
      // Check for ISO date format pattern
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })
})
