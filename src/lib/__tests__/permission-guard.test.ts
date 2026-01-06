import { requirePermission } from '@/lib/permission-guard'

describe('requirePermission', () => {
  it('returns null for allowed permission', () => {
    const result = requirePermission('EMPLOYEE', 'VIEW_REQUESTS')
    expect(result).toBeNull()
  })

  it('returns 403 response for missing permission', () => {
    const result = requirePermission('EMPLOYEE', 'MANAGE_REQUESTS')
    expect(result?.status).toBe(403)
  })
})
