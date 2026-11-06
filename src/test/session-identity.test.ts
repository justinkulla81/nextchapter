import { beforeEach, describe, expect, it, vi } from 'vitest'

const getClaims = vi.fn()
const getUser = vi.fn()
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getClaims, getUser } }) }))
vi.mock('@/lib/admin/mfa', () => ({ aalOf: () => null }))

import { getSessionIdentity } from '@/lib/supabase/get-current-user'

describe('getSessionIdentity', () => {
  beforeEach(() => {
    getClaims.mockReset()
    getUser.mockReset()
  })

  it('reads the member from the verified claims without asking the Auth server', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'u1', email: 'a@example.com', is_anonymous: false } }, error: null })
    expect(await getSessionIdentity()).toEqual({ id: 'u1', email: 'a@example.com', isAnonymous: false })
    expect(getUser).not.toHaveBeenCalled()
  })

  it('knows an anonymous session by its claim and gives it no email', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'u2', email: '', is_anonymous: true } }, error: null })
    expect(await getSessionIdentity()).toEqual({ id: 'u2', email: null, isAnonymous: true })
  })

  it('falls back to the full lookup when the claims cannot be read, so a bad token never looks like no session', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('bad jwt') })
    getUser.mockResolvedValue({ data: { user: { id: 'u3', email: 'b@example.com', is_anonymous: false } } })
    expect(await getSessionIdentity()).toEqual({ id: 'u3', email: 'b@example.com', isAnonymous: false })
  })

  it('is null when there is no session at all', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('no session') })
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await getSessionIdentity()).toBeNull()
  })
})
