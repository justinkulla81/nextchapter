import { describe, expect, it } from 'vitest'
import { checkSlug, socFromSlug } from '@/lib/ai-check/slug'
import { pickBets, skillsGap, type Alt } from '@/lib/ai-check/better-bets'

describe('ai check slugs', () => {
  it('ends in the 6-digit SOC code and round-trips', () => {
    const slug = checkSlug('Computer Systems Analysts & Architects', '15-1211')
    expect(slug).toBe('computer-systems-analysts-and-architects-15-1211')
    expect(socFromSlug(slug)).toBe('15-1211')
  })

  it('returns null when there is no code', () => {
    expect(socFromSlug('software-developers')).toBeNull()
    expect(socFromSlug('software-developers-15-12')).toBeNull()
  })
})

const alt = (soc6: string, o: Partial<Alt> = {}): Alt => ({ soc6, title: soc6, similarity: 0.8, exposure: 0.3, medianWage: 100_000, ...o })

describe('pickBets', () => {
  const current = { soc6: '00-0000', exposure: 0.3, medianWage: 100_000 }

  it('keeps jobs that pay more or are less exposed, and tags why', () => {
    const bets = pickBets(current, [alt('a', { medianWage: 120_000 }), alt('b', { exposure: 0.1 }), alt('c', { medianWage: 120_000, exposure: 0.1 })])
    expect(bets.map((b) => [b.soc6, b.reasons])).toEqual([
      ['c', ['pays_more', 'less_exposed']],
      ['a', ['pays_more']],
      ['b', ['less_exposed']],
    ])
    expect(bets[1].payDelta).toBe(20_000)
  })

  it('drops jobs that are neither, the visitor’s own job and duplicates', () => {
    const bets = pickBets(current, [alt('same-ish', { medianWage: 103_000, exposure: 0.28 }), alt('00-0000', { medianWage: 200_000 }), alt('d', { medianWage: 150_000 }), alt('d', { medianWage: 150_000 })])
    expect(bets.map((b) => b.soc6)).toEqual(['d'])
  })

  it('does not recommend a less-exposed job that pays materially less, or whose pay is unknown', () => {
    const bets = pickBets(current, [alt('cut', { exposure: 0.05, medianWage: 70_000 }), alt('unknown', { exposure: 0.05, medianWage: null }), alt('ok', { exposure: 0.05, medianWage: 95_000 })])
    expect(bets.map((b) => b.soc6)).toEqual(['ok'])
  })

  it('never claims a reason it cannot back when a number is missing', () => {
    expect(pickBets({ ...current, medianWage: null }, [alt('e', { medianWage: 500_000 })])).toEqual([])
    expect(pickBets({ ...current, exposure: null }, [alt('f', { exposure: 0 })])).toEqual([])
  })

  it('ranks by shared reasons, then similarity, and caps the list', () => {
    const many = Array.from({ length: 9 }, (_, i) => alt(`m${i}`, { medianWage: 150_000, similarity: i / 10 }))
    const bets = pickBets(current, many)
    expect(bets).toHaveLength(5)
    expect(bets[0].soc6).toBe('m8')
  })
})

describe('skillsGap', () => {
  it('lists skills the targets need that the current job lacks, biggest gap first', () => {
    const mine = new Map([['Writing', 70], ['Excel', 65]])
    const t1 = new Map([['Writing', 72], ['Python', 80], ['Statistics', 70], ['Excel', 66]])
    const t2 = new Map([['Python', 76], ['Statistics', 64]])
    expect(skillsGap(mine, [t1, t2])).toEqual(['Python', 'Statistics'])
  })

  it('ignores skills the targets only lightly need, and returns nothing without targets', () => {
    expect(skillsGap(new Map(), [new Map([['Minor', 40]])])).toEqual([])
    expect(skillsGap(new Map(), [])).toEqual([])
  })
})

import { capDecision, limitsFromEnv, DEFAULT_LIMITS, dayKey } from '@/lib/ai-spend/cap'

describe('free AI spend cap', () => {
  const limits = { dailyCalls: 10, monthlyCalls: 100, perIpPerDay: 3 }

  it('allows a call up to and including the limit and refuses the next', () => {
    expect(capDecision({ day: 10, month: 10 }, limits)).toEqual({ ok: true })
    expect(capDecision({ day: 11, month: 11 }, limits)).toEqual({ ok: false, reason: 'daily' })
  })

  it('refuses on the monthly backstop even when the day is fine', () => {
    expect(capDecision({ day: 1, month: 101 }, limits)).toEqual({ ok: false, reason: 'monthly' })
  })

  it('reads limits from the environment and ignores junk', () => {
    expect(limitsFromEnv({ FREE_AI_DAILY_CALLS: '50', FREE_AI_MONTHLY_CALLS: 'abc', FREE_AI_PER_IP_PER_DAY: '-2' })).toEqual({ ...DEFAULT_LIMITS, dailyCalls: 50 })
    expect(limitsFromEnv({})).toEqual(DEFAULT_LIMITS)
  })

  it('keys the day in New York time', () => {
    expect(dayKey(new Date('2026-10-31T02:30:00Z'))).toBe('2026-10-30')
  })
})

import { parseAnswer, parseBullets } from '@/lib/ai-tools/prompts'

describe('free AI reply parsing', () => {
  it('reads bullets out of a fenced or chatty reply and drops malformed rows', () => {
    const reply = 'Here you go:\n```json\n{"rewrites":[{"original":"Did stuff","better":"Cut close time by two days.","tip":"add: how many reports"},{"original":"","better":"x"},{"better":"no original"}]}\n```'
    expect(parseBullets(reply)).toEqual([{ original: 'Did stuff', better: 'Cut close time by two days.', tip: 'add: how many reports' }])
  })

  it('returns null for text with no JSON, and an empty list when the model finds nothing to rewrite', () => {
    expect(parseBullets('Sorry, I cannot help with that.')).toBeNull()
    expect(parseBullets('{"rewrites":[]}')).toEqual([])
  })

  it('caps bullets at four', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ original: `o${i}`, better: `b${i}` }))
    expect(parseBullets(JSON.stringify({ rewrites: rows }))).toHaveLength(4)
  })

  it('needs a stronger answer and at least one note', () => {
    expect(parseAnswer('{"strengths":["Specific result"],"improvements":[],"stronger":"I led..."}')).toEqual({ strengths: ['Specific result'], improvements: [], stronger: 'I led...' })
    expect(parseAnswer('{"strengths":[],"improvements":[],"stronger":"I led..."}')).toBeNull()
    expect(parseAnswer('{"strengths":["x"],"improvements":[]}')).toBeNull()
    expect(parseAnswer('not json')).toBeNull()
  })
})
