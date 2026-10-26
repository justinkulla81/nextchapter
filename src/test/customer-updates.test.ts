import { describe, expect, it } from 'vitest'
import { customerUpdatesBody, updatesSince } from '@/lib/mailing/customer-updates-body'
import type { CustomerUpdate } from '@/data/customer-updates'

const e = (date: string, title: string, audiences: CustomerUpdate['audiences'] = ['employer', 'recruiter', 'coach', 'institution']): CustomerUpdate =>
  ({ date, audiences, title, summary: 'It does a thing.' })

describe('updatesSince', () => {
  it('keeps only entries after the last send, newest first', () => {
    const out = updatesSince([e('2026-09-01', 'old'), e('2026-10-10', 'a'), e('2026-10-20', 'b')], new Date('2026-10-01T12:00:00Z'))
    expect(out.map((x) => x.title)).toEqual(['b', 'a'])
  })
  it('excludes an entry dated on the day of the last send', () => {
    expect(updatesSince([e('2026-10-01', 'same day')], new Date('2026-10-01T12:00:00Z'))).toEqual([])
  })
})

describe('customerUpdatesBody', () => {
  it('lists each change and still blocks sending until the closing marker is dealt with', () => {
    const html = customerUpdatesBody([e('2026-10-20', 'Reply by email')], 'October 2026')
    expect(html).toContain('Reply by email')
    expect(html).toContain('October 2026')
    expect(html).toContain('[[Write:')
  })
  it('labels changes that are not for everyone', () => {
    const html = customerUpdatesBody([e('2026-10-20', 'Coach thing', ['coach'])], null)
    expect(html).toContain('for coaches')
  })
  it('does not label changes for every audience', () => {
    expect(customerUpdatesBody([e('2026-10-20', 'For all')], null)).not.toContain('(for ')
  })
  it('asks for content when nothing shipped', () => {
    expect(customerUpdatesBody([], 'October 2026')).toContain('[[Write: what we added or changed')
  })
  it('escapes markup in titles and summaries', () => {
    const html = customerUpdatesBody([{ date: '2026-10-20', audiences: ['employer', 'recruiter', 'coach', 'institution'], title: '<script>x</script>', summary: 'a & b' }], null)
    expect(html).not.toContain('<script>')
    expect(html).toContain('a &amp; b')
  })
})
