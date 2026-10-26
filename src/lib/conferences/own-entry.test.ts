import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() })
  return { conferenceEvent: m(), conferenceEdition: m(), conferenceOpportunity: m(), userConference: m() }
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { removeOwnOpportunity, updateOwnEntry } from './own-entry'
import { canEditEntry } from './entry-rules'

const mine = { id: 's1', name: 'Old', addedBy: 'c1', published: false, rejectedAt: null }
beforeEach(() => {
  vi.clearAllMocks()
  db.conferenceEvent.findUnique.mockResolvedValue(mine)
  db.conferenceEdition.upsert.mockResolvedValue({ id: 'ed' })
})

describe('canEditEntry', () => {
  it('is only the member who added it, and only until it is approved or rejected', () => {
    expect(canEditEntry(mine, 'c1')).toBe(true)
    expect(canEditEntry(mine, 'c2')).toBe(false)
    expect(canEditEntry({ ...mine, published: true }, 'c1')).toBe(false)
    expect(canEditEntry({ ...mine, rejectedAt: new Date() }, 'c1')).toBe(false)
    expect(canEditEntry({ ...mine, addedBy: null }, 'c1')).toBe(false)
  })
})

describe('updateOwnEntry', () => {
  const form = { name: 'Future Summit', url: 'https://www.future.org/?utm_source=x', organizer: 'Future Org', startDate: '2027-05-04', endDate: '2027-05-05', city: 'Austin', state: 'tx', format: 'HYBRID', costLow: 495, costHigh: 995, costNote: 'Student rate', industries: ['hacked'] }

  it('saves the corrections, canonicalises the link, and puts the dates on the edition', async () => {
    expect(await updateOwnEntry('c1', 's1', form)).toBe(true)
    const data = db.conferenceEvent.update.mock.calls[0][0].data
    expect(data).toMatchObject({ name: 'Future Summit', organizer: 'Future Org', urlKey: 'future.org', state: 'TX', format: 'HYBRID', costLow: 495, costHigh: 995, datesConfirmed: true })
    expect(data).not.toHaveProperty('industries') // members edit the facts of the event, never its catalog tags
    expect(db.conferenceEdition.upsert.mock.calls[0][0].where).toEqual({ seriesId_year: { seriesId: 's1', year: 2027 } })
    expect(db.userConference.updateMany.mock.calls[0][0]).toMatchObject({ where: { seriesId: 's1' }, data: { editionId: 'ed' } })
  })

  it('keeps the old name when the name is cleared, and clears the other fields', async () => {
    await updateOwnEntry('c1', 's1', { name: '', url: '', city: '', startDate: '' })
    const data = db.conferenceEvent.update.mock.calls[0][0].data
    expect(data).toMatchObject({ name: 'Old', city: null, startDate: null, datesConfirmed: false })
    expect(data).not.toHaveProperty('url')
  })

  it('does nothing for someone else, an approved entry, or a rejected one', async () => {
    expect(await updateOwnEntry('c2', 's1', form)).toBe(false)
    db.conferenceEvent.findUnique.mockResolvedValue({ ...mine, published: true })
    expect(await updateOwnEntry('c1', 's1', form)).toBe(false)
    db.conferenceEvent.findUnique.mockResolvedValue({ ...mine, rejectedAt: new Date() })
    expect(await updateOwnEntry('c1', 's1', form)).toBe(false)
    expect(db.conferenceEvent.update).not.toHaveBeenCalled()
  })

  it('ignores a bad link instead of saving it', async () => {
    await updateOwnEntry('c1', 's1', { ...form, url: 'javascript:alert(1)' })
    expect(db.conferenceEvent.update.mock.calls[0][0].data).not.toHaveProperty('url')
  })
})

describe('removeOwnOpportunity', () => {
  it('lets the member remove something we read wrongly from their own pending entry', async () => {
    db.conferenceOpportunity.findUnique.mockResolvedValue({ id: 'o1', seriesId: 's1', type: 'PRESENTATION' })
    expect(await removeOwnOpportunity('c1', 'o1')).toBe(true)
    expect(db.conferenceOpportunity.delete).toHaveBeenCalledWith({ where: { id: 'o1' } })
  })
  it('refuses on an entry that is not theirs or is already approved', async () => {
    db.conferenceOpportunity.findUnique.mockResolvedValue({ id: 'o1', seriesId: 's1', type: 'PRESENTATION' })
    expect(await removeOwnOpportunity('c2', 'o1')).toBe(false)
    db.conferenceEvent.findUnique.mockResolvedValue({ ...mine, published: true })
    expect(await removeOwnOpportunity('c1', 'o1')).toBe(false)
    expect(db.conferenceOpportunity.delete).not.toHaveBeenCalled()
  })
})
