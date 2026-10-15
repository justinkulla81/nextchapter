import { describe, it, expect, vi, afterEach } from 'vitest'
vi.mock('server-only', () => ({}))
import { listNewsletterMessages } from '@/lib/google/gmail'

afterEach(() => vi.unstubAllGlobals())

describe('listNewsletterMessages', () => {
  it('looks back a few days and does not require the mail to be unread', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'm1' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await listNewsletterMessages('tok', 'from:strictlyvc.com')).toEqual([{ id: 'm1' }])
    const q = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]).searchParams.get('q')
    expect(q).toBe('from:strictlyvc.com newer_than:3d')
    expect(q).not.toContain('is:unread')
  })
  it('is empty when Gmail finds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    expect(await listNewsletterMessages('tok', 'from:x.com')).toEqual([])
  })
})
