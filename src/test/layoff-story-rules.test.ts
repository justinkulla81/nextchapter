import { describe, expect, it } from 'vitest'
import { checkStory, checkStoryText, storyNumbers, validMonth } from '@/lib/layoff-stories/rules'

const NOW = new Date('2026-11-03T12:00:00Z')
const base = { companyName: 'Acme', toldMonth: '2026-10', fn: 'engineering', title: 'Staff engineer', level: 'ic' }

describe('validMonth', () => {
  it('accepts this month and five years back, not the future or older', () => {
    expect(validMonth('2026-11', NOW)).toBe(true)
    expect(validMonth('2021-11', NOW)).toBe(true)
    expect(validMonth('2026-12', NOW)).toBe(false)
    expect(validMonth('2021-10', NOW)).toBe(false)
    expect(validMonth('2026-13', NOW)).toBe(false)
  })
})

describe('checkStoryText', () => {
  it('allows blank, rejects short, links, emails, phones and brackets', () => {
    expect(checkStoryText('  ')).toEqual({ ok: true, text: '' })
    expect(checkStoryText('too short').ok).toBe(false)
    const long = 'We were told on a Tuesday morning in a short all hands call. '
    expect(checkStoryText(long + 'See https://x.io').ok).toBe(false)
    expect(checkStoryText(long + 'mail me a@b.co').ok).toBe(false)
    expect(checkStoryText(long + 'call 415 555 0100 now').ok).toBe(false)
    expect(checkStoryText(long + '<b>').ok).toBe(false)
    expect(checkStoryText(long).ok).toBe(true)
  })
})

describe('checkStory', () => {
  it('accepts the required fields with no email as a private story', () => {
    const r = checkStory(base, false, NOW)
    expect(r.ok && r.value.visibility).toBe('PRIVATE')
  })
  it('requires the core fields', () => {
    expect(checkStory({ ...base, fn: 'astronaut' }, false, NOW).ok).toBe(false)
    expect(checkStory({ ...base, title: '' }, false, NOW).ok).toBe(false)
    expect(checkStory({ ...base, toldMonth: '2031-01' }, false, NOW).ok).toBe(false)
  })
  it('rejects an answer outside the list', () => {
    expect(checkStory({ ...base, severance: 'a lot' }, false, NOW).ok).toBe(false)
  })
  it('refuses public visibility while publishing is closed', () => {
    expect(checkStory({ ...base, visibility: 'ANONYMOUS', email: 'a@b.co', body: 'x'.repeat(60) }, false, NOW).ok).toBe(false)
  })
  it('needs a story and email to publish, and a full name for named', () => {
    const pub = { ...base, body: 'x'.repeat(60) }
    expect(checkStory({ ...pub, visibility: 'ANONYMOUS' }, true, NOW).ok).toBe(false)
    expect(checkStory({ ...pub, visibility: 'ANONYMOUS', email: 'A@B.co' }, true, NOW)).toMatchObject({ ok: true, value: { email: 'a@b.co' } })
    expect(checkStory({ ...pub, visibility: 'NAMED', email: 'a@b.co', name: 'Pat' }, true, NOW).ok).toBe(false)
    expect(checkStory({ ...pub, visibility: 'NAMED', email: 'a@b.co', name: 'Pat Lee' }, true, NOW).ok).toBe(true)
    expect(checkStory({ ...base, visibility: 'ANONYMOUS', email: 'a@b.co' }, true, NOW).ok).toBe(false)
  })
})

describe('storyNumbers', () => {
  const row = (o: Partial<Record<string, string>> = {}) => ({ fn: 'sales', foundOut: '', noticeGiven: '', severance: '', whereNow: '', ...o })
  it('leaves out a question below five answers', () => {
    const n = storyNumbers([row({ severance: 'none' }), row({ severance: 'lt4' })])
    expect(n.total).toBe(2)
    expect(n.questions.severance).toBeUndefined()
    expect(n.questions.fn).toBeUndefined()
  })
  it('counts and sorts once five answered, ignoring blanks', () => {
    const rows = [row({ severance: 'none' }), row({ severance: 'lt4' }), row({ severance: 'lt4' }), row({ severance: 'lt4' }), row({ severance: '4to8' }), row()]
    const n = storyNumbers(rows)
    expect(n.questions.severance?.answered).toBe(5)
    expect(n.questions.severance?.counts[0]).toMatchObject({ key: 'lt4', n: 3 })
  })
})
