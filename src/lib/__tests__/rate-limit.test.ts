import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '../rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear cache between tests by using unique identifiers
  })

  it('allows requests within limit', async () => {
    const identifier = `test-${Date.now()}-1`
    const result = await checkRateLimit(identifier, 5, 60000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests exceeding limit', async () => {
    const identifier = `test-${Date.now()}-2`

    // Make 5 requests (limit)
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(identifier, 5, 60000)
    }

    // 6th request should be blocked
    const result = await checkRateLimit(identifier, 5, 60000)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after window expires', async () => {
    const identifier = `test-${Date.now()}-3`

    // Use up the limit with a very short window
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(identifier, 3, 50) // 50ms window
    }

    // Should be blocked
    expect((await checkRateLimit(identifier, 3, 50)).success).toBe(false)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Should be allowed again
    const result = await checkRateLimit(identifier, 3, 50)
    expect(result.success).toBe(true)
  })

  it('tracks remaining requests correctly', async () => {
    const identifier = `test-${Date.now()}-4`

    const r1 = await checkRateLimit(identifier, 5, 60000)
    expect(r1.remaining).toBe(4)

    const r2 = await checkRateLimit(identifier, 5, 60000)
    expect(r2.remaining).toBe(3)

    const r3 = await checkRateLimit(identifier, 5, 60000)
    expect(r3.remaining).toBe(2)
  })
})

describe('getClientIdentifier', () => {
  it('returns x-forwarded-for header when present', () => {
    const headers = new Headers()
    headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1')

    expect(getClientIdentifier(headers)).toBe('192.168.1.1')
  })

  it('returns x-real-ip when x-forwarded-for is missing', () => {
    const headers = new Headers()
    headers.set('x-real-ip', '192.168.1.2')

    expect(getClientIdentifier(headers)).toBe('192.168.1.2')
  })

  it('returns anonymous when no headers present', () => {
    const headers = new Headers()
    expect(getClientIdentifier(headers)).toBe('anonymous')
  })
})

describe('RATE_LIMITS presets', () => {
  it('has standard preset', () => {
    expect(RATE_LIMITS.standard).toEqual({
      limit: 100,
      windowMs: 60000,
    })
  })

  it('has sensitive preset', () => {
    expect(RATE_LIMITS.sensitive).toEqual({
      limit: 10,
      windowMs: 900000, // 15 minutes
    })
  })

  it('has heavy preset', () => {
    expect(RATE_LIMITS.heavy).toEqual({
      limit: 5,
      windowMs: 60000,
    })
  })
})
