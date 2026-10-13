import { describe, it, expect } from 'vitest'
import { newsSignalFromEvent, officerRoleFromTitle } from '@/lib/likely-openings/news-signal'
import { signalSource, sourceLinkLabel } from '@/lib/likely-openings/roles'

const now = new Date('2026-10-13T12:00:00Z')
const base = { company: 'Automattic', summary: 'Automattic lost its interim CFO and is searching for a permanent one.', url: 'https://techcrunch.com/automattic-cfo' }

describe('officerRoleFromTitle', () => {
  it('names the seat and never a vice president', () => {
    expect(officerRoleFromTitle('interim CFO')).toBe('CFO')
    expect(officerRoleFromTitle('Chief People Officer')).toBe('CHRO')
    expect(officerRoleFromTitle('Vice President of Sales')).toBeNull()
    expect(officerRoleFromTitle(null)).toBeNull()
  })
})

describe('newsSignalFromEvent', () => {
  it('turns a CFO search into a likely opening marked as news', () => {
    const row = newsSignalFromEvent({ ...base, role: 'CFO', direction: 'search' }, now)!
    expect(row).toMatchObject({ signalType: 'EXEC_DEPARTURE', roles: ['CFO'], cik: 'news', companyNameNormalized: 'automattic', filingUrl: base.url })
    expect(row.accessionNumber).toMatch(/^news:/)
    expect(row.expiresAt.getTime()).toBeGreaterThan(now.getTime())
  })
  it('treats a permanent new leader as new leadership', () => {
    expect(newsSignalFromEvent({ ...base, role: 'CEO', direction: 'appointment' }, now)!.signalType).toBe('EXEC_APPOINTMENT')
  })
  it('is stable for the same event in the same month, so repeats are skipped', () => {
    const a = newsSignalFromEvent({ ...base, role: 'CFO', direction: 'departure' }, now)!
    const b = newsSignalFromEvent({ ...base, role: 'chief financial officer', direction: 'departure' }, new Date('2026-10-20T00:00:00Z'))!
    expect(a.accessionNumber).toBe(b.accessionNumber)
  })
  it('makes no signal without a seat, a direction or a story link', () => {
    expect(newsSignalFromEvent({ ...base, role: 'VP of Sales', direction: 'departure' }, now)).toBeNull()
    expect(newsSignalFromEvent({ ...base, role: 'CFO', direction: null }, now)).toBeNull()
    expect(newsSignalFromEvent({ ...base, role: 'CFO', direction: 'departure', url: null }, now)).toBeNull()
  })
})

describe('signal source', () => {
  it('tells news from SEC', () => {
    expect(signalSource('news')).toBe('news')
    expect(signalSource('1234567')).toBe('sec')
    expect(sourceLinkLabel('news')).toBe('Read the report')
    expect(sourceLinkLabel('sec')).toBe('Read the SEC filing')
  })
})
