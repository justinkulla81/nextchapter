import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  publicPageContent: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  publicOrgPage: { findMany: vi.fn(async () => [{ kind: 'WORKFORCE_BOARD', sourceId: 'b1' }]), findUnique: vi.fn() },
  crmOrganization: { findUnique: vi.fn(async () => ({ name: 'KentuckianaWorks' })), findMany: vi.fn() },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: cache.revalidateTag, unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
const mail = vi.hoisted(() => ({ review: vi.fn(async () => true) }))
vi.mock('@/lib/email/send-org-claim-email', () => ({ sendPublicPageReviewEmail: mail.review }))

import { EMPTY_CONTENT, formValues, hasAnything, parsePublicPageForm, upcomingEvents } from '@/lib/public-page/content'
import { approvePageEdit, declinePageEdit, savePublicPage } from '@/lib/public-page/store'

const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

describe('the public page form', () => {
  it('reads an intro, highlights one per line, dated events and contact details', () => {
    const r = parsePublicPageForm(form({
      intro: 'We help people in Louisville find work.', highlights: '- Career coaching\n• Training money\n\n', 'event-title-0': 'Hiring fair', 'event-date-0': '2026-12-03',
      'event-url-0': 'example.org/fair', website: 'kentuckianaworks.org', email: 'Info@Example.org', phone: '(502) 574-2500',
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.content.highlights).toEqual(['Career coaching', 'Training money'])
    expect(r.content.events).toEqual([{ title: 'Hiring fair', date: '2026-12-03', url: 'https://example.org/fair' }])
    expect(r.content.contact).toMatchObject({ website: 'https://kentuckianaworks.org/', email: 'info@example.org' })
  })
  it('says plainly what is wrong', () => {
    expect(parsePublicPageForm(form({ intro: 'x'.repeat(701) }))).toMatchObject({ ok: false, error: expect.stringContaining('700') })
    expect(parsePublicPageForm(form({ highlights: Array(7).fill('a').join('\n') }))).toMatchObject({ ok: false })
    expect(parsePublicPageForm(form({ 'event-title-0': 'Fair' }))).toMatchObject({ ok: false, error: 'Event 1 needs a date.' })
    expect(parsePublicPageForm(form({ email: 'nope' }))).toMatchObject({ ok: false })
    expect(parsePublicPageForm(form({ website: 'javascript:alert(1)' }))).toMatchObject({ ok: false })
  })
  it('keeps what was typed, drops past events, and knows an empty section', () => {
    expect(formValues(form({ intro: 'Hi' }))).toEqual({ intro: 'Hi' })
    const c = { ...EMPTY_CONTENT, events: [{ title: 'Old', date: '2026-01-01', url: null }, { title: 'New', date: '2026-12-01', url: null }] }
    expect(upcomingEvents(c, '2026-11-17').map((e) => e.title)).toEqual(['New'])
    expect(hasAnything(EMPTY_CONTENT)).toBe(false)
  })
})

describe('saving and review', () => {
  const content = { ...EMPTY_CONTENT, intro: 'Hello' }
  beforeEach(() => vi.clearAllMocks())
  it('the first version waits for review and emails the team; nothing on the page changes', async () => {
    db.publicPageContent.findUnique.mockResolvedValue(null)
    expect(await savePublicPage({ crmOrgId: 'o1', kind: 'WORKFORCE', content, by: 'pat@board.gov', distinctId: 'u1' })).toEqual({ status: 'PENDING' })
    expect(db.publicPageContent.upsert.mock.calls[0][0].create).toMatchObject({ status: 'PENDING' })
    expect(db.publicPageContent.upsert.mock.calls[0][0].create.published).toBeUndefined()
    expect(mail.review).toHaveBeenCalledOnce()
    expect(cache.revalidateTag).not.toHaveBeenCalled()
  })
  it('after one approval, saving publishes and refreshes only that organization’s pages', async () => {
    db.publicPageContent.findUnique.mockResolvedValue({ firstApprovedAt: new Date() })
    expect(await savePublicPage({ crmOrgId: 'o1', kind: 'WORKFORCE', content, by: 'a', distinctId: 'u1' })).toEqual({ status: 'PUBLISHED' })
    expect(db.publicPageContent.upsert.mock.calls[0][0].update).toMatchObject({ status: 'PUBLISHED' })
    expect(cache.revalidateTag.mock.calls.map((c) => c[0])).toEqual(['public-page:o1', 'public-page-src:WORKFORCE_BOARD:b1'])
  })
  it('approving publishes the version under review; asking for a change needs a note', async () => {
    db.publicPageContent.findUnique.mockResolvedValue({ id: 'e1', crmOrganizationId: 'o1', draft: content, status: 'PENDING', kind: 'COLLEGE' })
    expect(await approvePageEdit('e1', 'owner')).toEqual({ ok: true })
    expect(db.publicPageContent.update.mock.calls[0][0].data).toMatchObject({ status: 'PUBLISHED', published: content, reviewedBy: 'owner' })
    expect((await declinePageEdit('e1', '  ', 'owner')).ok).toBe(false)
    db.publicPageContent.updateMany.mockResolvedValue({ count: 1 })
    expect(await declinePageEdit('e1', 'Shorten the intro', 'owner')).toEqual({ ok: true })
  })
})
