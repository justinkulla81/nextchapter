import { describe, it, expect, vi, afterEach } from 'vitest'
vi.mock('server-only', () => ({}))
import { fetchGoogleDocText, listCalendarEvents, NotesFetchError } from '@/lib/google/admin-calendar'

const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

afterEach(() => vi.restoreAllMocks())

describe('fetchGoogleDocText', () => {
  const kindOf = async (res: Response) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res)
    return fetchGoogleDocText('tok', 'doc1').then(() => 'ok', (e) => (e instanceof NotesFetchError ? e.kind : 'other'))
  }
  it('treats a 401 as needing a reconnect', async () => {
    expect(await kindOf(reply(401, {}))).toBe('needs_reconnect')
  })
  it('treats insufficient scopes as needing a reconnect', async () => {
    expect(await kindOf(reply(403, { error: { details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }))).toBe('needs_reconnect')
  })
  it('recognises the Docs API being switched off in the Cloud project', async () => {
    expect(await kindOf(reply(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } }))).toBe('api_disabled')
    expect(await kindOf(reply(403, 'Google Docs API has not been used in project 123 before or it is disabled.'))).toBe('api_disabled')
  })
  it('treats a plain 403 or 404 as one inaccessible doc, not a reconnect', async () => {
    expect(await kindOf(reply(403, { error: { status: 'PERMISSION_DENIED' } }))).toBe('inaccessible')
    expect(await kindOf(reply(404, {}))).toBe('inaccessible')
  })
  it('treats a server error as retryable', async () => {
    expect(await kindOf(reply(500, {}))).toBe('failed')
  })
  it('returns the doc text on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      reply(200, { body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Hello\n' } }] } }] } }),
    )
    expect(await fetchGoogleDocText('tok', 'doc1')).toBe('Hello')
  })
})

describe('listCalendarEvents paging', () => {
  it('follows nextPageToken so a long window is not cut off', async () => {
    const item = (id: string) => ({ id, start: { dateTime: '2026-10-01T10:00:00Z' }, attendees: [] })
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply(200, { items: [item('a'), item('b')], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(reply(200, { items: [item('c')] }))
    const events = await listCalendarEvents('tok', new Date('2026-09-01'), new Date('2026-11-01'))
    expect(events.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(String(spy.mock.calls[1][0])).toContain('pageToken=p2')
  })
})
