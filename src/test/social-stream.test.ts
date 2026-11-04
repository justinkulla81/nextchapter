import { describe, expect, it } from 'vitest'
import { aiPayFacts, factLink, rankingFacts, skillFacts, topicOrder, type Fact } from '@/lib/social/facts'
import { BASELINE_STORIES_PER_DAY, GAP_MINUTES, gapPassed, inWindow, nextKind, storyDue, streamDay } from '@/lib/social/pace'
import { checkDraft, LINK_TOKEN } from '@/lib/social/validate'
import type { SkillMarket } from '@/lib/skills/market'
import type { RankingIndexEntry } from '@/lib/rankings/types'

const at = (iso: string) => new Date(iso)

const fact: Fact = {
  key: 'k',
  topic: 'skill',
  lines: ['Skill: SQL', 'Named in 22% of the job postings that list skills', 'Open postings that name it: 12,431', 'Median posted yearly pay of postings that name it: $98k'],
  path: '/skills/sql',
  campaign: 'skill-story',
  fallback: (link) => `SQL is everywhere. ${link}`,
}

describe('checkDraft', () => {
  const good = `SQL shows up in 22% of the postings that list skills, with 12,431 open right now. Median posted pay is $98k. ${LINK_TOKEN}`
  it('accepts a draft that keeps to the facts', () => expect(checkDraft(good, fact)).toEqual({ ok: true }))

  it('rejects a number that is not in the facts', () => {
    const r = checkDraft(good.replace('22%', '25%'), fact)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toContain('25')
  })
  it('needs the link placeholder exactly once, and no web address', () => {
    expect(checkDraft(good.replace(LINK_TOKEN, ''), fact).ok).toBe(false)
    expect(checkDraft(`${good} ${LINK_TOKEN}`, fact).ok).toBe(false)
    expect(checkDraft(good.replace(LINK_TOKEN, 'https://x.com/a'), fact).ok).toBe(false)
  })
  it('rejects hashtags, emojis, dashes and exclamation marks', () => {
    for (const bad of [`#jobs ${good}`, `${good} 🚀`, good.replace('right now', 'right now — wow'), good.replace('SQL shows', 'SQL shows!')]) {
      expect(checkDraft(bad, fact).ok).toBe(false)
    }
  })
  it('rejects a draft too long to fit Bluesky with the longest link', () => {
    const long = `${'SQL is in a lot of postings and keeps showing up. '.repeat(5)}${LINK_TOKEN}`
    const r = checkDraft(long, fact)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toContain('too long')
  })
  it('treats 12431 and 12,431 as the same number', () => {
    expect(checkDraft(good.replace('12,431', '12431'), fact).ok).toBe(true)
  })
})

describe('factLink', () => {
  it('tags the channel and the campaign', () => {
    expect(factLink(fact, 'bluesky')).toBe('https://launchyournextchapter.com/skills/sql?utm_source=bluesky&utm_medium=social&utm_campaign=skill-story')
  })
})

describe('ranking facts', () => {
  const now = at('2026-11-10T15:00:00Z')
  const entry = (slug: string, extra: Partial<RankingIndexEntry> = {}): RankingIndexEntry => ({
    slug, edition: '2026-11', title: `Best ${slug}`, family: 'Entry-level', measure: 'junior', scopeKind: 'national', scopeId: 'us', scopeName: 'United States',
    topName: 'Austin', topValueLabel: '12.0%', places: 80, editions: ['2026-11'], ...extra,
  })
  it('keeps the newest edition of employment lists, national first', () => {
    const f = rankingFacts([entry('a', { scopeKind: 'state', places: 200 }), entry('b'), entry('old', { edition: '2026-08', editions: ['2026-08'] }), entry('c', { group: 'college' }), entry('d', { editions: ['2026-12', '2026-11'] })], now)
    expect(f.map((x) => x.key)).toEqual(['story-ranking-b-2026-11', 'story-ranking-a-2026-11'])
    expect(f[0].path).toBe('/rankings/b')
    expect(f[0].lines).toContain('Number one: Austin (12.0%)')
  })
  it('has a template that fits Bluesky even with a long title', () => {
    const f = rankingFacts([entry('x', { title: 'The best mid-size cities in the whole country for entry-level jobs that pay above the local cost of living' })], now)[0]
    expect(f.fallback(factLink(f, 'bluesky'), false).length).toBeLessThanOrEqual(300)
  })
})

describe('AI pay facts', () => {
  const row = (fn: string, pct: number | null, withAi = 40, withoutAi = 90) => ({ function: fn, withAi, withoutAi, premiumPct: pct, medianWithAi: 150_000, medianWithoutAi: 130_000 })
  it('skips thin or missing comparisons and carries the caveat', () => {
    const f = aiPayFacts([row('Engineering', 12), row('Sales', null), row('Legal', 30, 5, 90)], at('2026-11-10T15:00:00Z'))
    expect(f).toHaveLength(1)
    expect(f[0].lines.join(' ')).toContain('12% higher')
    expect(f[0].lines.join(' ')).toContain('not what people are paid')
    expect(f[0].key).toBe('story-aipay-engineering-2026-11')
  })
  it('says lower for a negative difference', () => {
    expect(aiPayFacts([row('Design', -7)], at('2026-11-10T15:00:00Z'))[0].lines.join(' ')).toContain('7% lower')
  })
})

describe('skill facts', () => {
  const market = (n: number): SkillMarket => ({
    asOf: '2026-11-09', live: 50_000, withSkills: 40_000, fresh: 9000, totals: { industry: {}, function: {}, state: {}, level: {} }, labels: { industry: {}, function: {}, state: {}, level: {} },
    skills: [{ slug: 'sql', name: 'SQL', n, fresh: 100, exposure: null, exposureN: 0, aiPair: 0, by: { industry: {}, function: {}, state: {}, level: {} }, pay: { n: 80, median: 98_000 } }],
    payBaseline: { n: 900, median: 90_000 },
  })
  it('posts only skills with enough postings, with pay against the baseline', () => {
    expect(skillFacts(market(100))).toHaveLength(0)
    const f = skillFacts(market(8000))[0]
    expect(f.key).toBe('story-skill-sql-2026-11')
    expect(f.lines.join(' ')).toContain('$98k, against $90k')
  })
  it('returns nothing when the market is not loaded', () => expect(skillFacts(null)).toEqual([]))
})

describe('topicOrder', () => {
  it('tries the topic posted longest ago first, never-posted before any', () => {
    expect(topicOrder([])).toEqual(['ranking', 'skill', 'ai-pay'])
    expect(topicOrder(['ranking', 'skill'])).toEqual(['ai-pay', 'ranking', 'skill'])
    expect(topicOrder(['skill', 'ai-pay', 'ranking'])).toEqual(['skill', 'ai-pay', 'ranking'])
  })
})

describe('pacing', () => {
  it('posts only between 12:00 and 02:00 UTC', () => {
    expect(inWindow(at('2026-11-10T11:59:00Z'))).toBe(false)
    expect(inWindow(at('2026-11-10T12:00:00Z'))).toBe(true)
    expect(inWindow(at('2026-11-11T01:59:00Z'))).toBe(true)
    expect(inWindow(at('2026-11-11T02:00:00Z'))).toBe(false)
  })
  it('counts the early hours with the day that started the window', () => {
    expect(streamDay(at('2026-11-11T01:00:00Z'))).toBe('2026-11-10')
    expect(streamDay(at('2026-11-10T12:00:00Z'))).toBe('2026-11-10')
  })
  it('keeps a gap between posts', () => {
    const now = at('2026-11-10T15:00:00Z')
    expect(gapPassed(now, null)).toBe(true)
    expect(gapPassed(now, new Date(now.getTime() - (GAP_MINUTES - 1) * 60_000).toISOString())).toBe(false)
    expect(gapPassed(now, new Date(now.getTime() - GAP_MINUTES * 60_000).toISOString())).toBe(true)
  })
  it('follows every layoff with a story, however many layoffs wait', () => {
    expect(nextKind({ lastKind: 'layoff', layoffWaiting: true, storyIsDue: false })).toBe('story')
    expect(nextKind({ lastKind: 'story', layoffWaiting: true, storyIsDue: false })).toBe('layoff')
    expect(nextKind({ lastKind: null, layoffWaiting: true, storyIsDue: false })).toBe('layoff')
  })
  it('posts a baseline story only when one is due, and waits otherwise', () => {
    expect(nextKind({ lastKind: 'story', layoffWaiting: false, storyIsDue: true })).toBe('story')
    expect(nextKind({ lastKind: 'story', layoffWaiting: false, storyIsDue: false })).toBeNull()
  })
  it('spreads the baseline stories across the window', () => {
    expect(storyDue(at('2026-11-10T12:05:00Z'), 0)).toBe(true)
    expect(storyDue(at('2026-11-10T12:05:00Z'), 1)).toBe(false)
    expect(storyDue(at('2026-11-10T16:00:00Z'), 1)).toBe(false)
    expect(storyDue(at('2026-11-10T17:30:00Z'), 1)).toBe(true)
    expect(storyDue(at('2026-11-11T01:30:00Z'), BASELINE_STORIES_PER_DAY)).toBe(false)
  })
})
