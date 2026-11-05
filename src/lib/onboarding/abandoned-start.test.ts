import { describe, expect, it } from 'vitest'
import { abandonedContent, dueAbandonedStep, abandonedRef } from './abandoned-start'

const H = 3600_000
const D = 24 * H
const t0 = new Date('2026-11-05T12:00:00Z')
const at = (ms: number) => new Date(t0.getTime() + ms)
const base = { now: at(0), lastActivityAt: at(-3 * H), savedForLaterAt: null, sent: {}, lastAnyEmailAt: null }

describe('dueAbandonedStep', () => {
  it('waits two hours after the last activity', () => {
    expect(dueAbandonedStep({ ...base, lastActivityAt: at(-1 * H) })).toBeNull()
    expect(dueAbandonedStep(base)).toBe('finish_1')
  })
  it('skips a first email that is past its window, so switching on never mails a back catalogue', () => {
    expect(dueAbandonedStep({ ...base, lastActivityAt: at(-5 * D) })).toBeNull()
  })
  it('sends the second email three days after the first, once', () => {
    expect(dueAbandonedStep({ ...base, sent: { finish_1: at(-2 * D) } })).toBeNull()
    expect(dueAbandonedStep({ ...base, sent: { finish_1: at(-4 * D) }, lastAnyEmailAt: at(-4 * D) })).toBe('finish_2')
    expect(dueAbandonedStep({ ...base, sent: { finish_1: at(-4 * D), finish_2: at(-1 * D) } })).toBeNull()
  })
  it('keeps two days between any two emails from us', () => {
    expect(dueAbandonedStep({ ...base, lastAnyEmailAt: at(-1 * D) })).toBeNull()
    expect(dueAbandonedStep({ ...base, lastAnyEmailAt: at(-3 * D) })).toBe('finish_1')
  })
  it('sends at once to someone who asked for the link', () => {
    expect(dueAbandonedStep({ ...base, lastActivityAt: at(-1000), savedForLaterAt: at(-1000), lastAnyEmailAt: at(-H) })).toBe('finish_1')
  })
})

describe('abandonedContent', () => {
  it('names the page they stopped on and uses their first name', () => {
    const c = abandonedContent('finish_1', 'Ana', 'Résumé')
    expect(c.paragraphs[0]).toBe('Hi Ana,')
    expect(c.paragraphs[1]).toContain('Résumé')
  })
  it('falls back without a name or a stop', () => {
    expect(abandonedContent('finish_2', null, null).paragraphs[0]).toBe('Hi,')
  })
})

describe('abandonedRef', () => {
  it('is per step and lower-cased', () => {
    expect(abandonedRef('finish_1', ' A@B.co ')).toBe('onboarding:finish_1:a@b.co')
  })
})
