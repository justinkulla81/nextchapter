import { describe, expect, it } from 'vitest'
import { aiPayFacts, factLink, rankingFacts, skillFacts, stableShuffle, topicOrder, type Fact } from '@/lib/social/facts'
import { BASELINE_STORIES_PER_DAY, baselineStories, GAP_MINUTES, gapMinutes, gapPassed, inWindow, nextKind, storyDue, streamDay, tickSlot } from '@/lib/social/pace'
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
    expect(topicOrder([])).toEqual(['ranking', 'skill', 'ai-pay', 'help'])
    expect(topicOrder(['ranking', 'skill'])).toEqual(['ai-pay', 'help', 'ranking', 'skill'])
    expect(topicOrder(['skill', 'ai-pay', 'help', 'ranking'])).toEqual(['skill', 'ai-pay', 'help', 'ranking'])
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

describe('per-channel streams', () => {
  it('starts each channel on a different topic, then rotates by what it posted last', () => {
    expect(topicOrder([], 0)).toEqual(['ranking', 'skill', 'ai-pay', 'help'])
    expect(topicOrder([], 1)).toEqual(['skill', 'ai-pay', 'help', 'ranking'])
    expect(topicOrder([], 5)).toEqual(topicOrder([], 1))
    expect(topicOrder(['skill'], 1)[0]).not.toBe('skill')
  })
  it('picks different filler for different channels from one pool, and the same for the same channel and day', () => {
    const pool = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}` }))
    const a = stableShuffle(pool, 'x:2026-11-10').map((p) => p.key)
    expect(a).toEqual(stableShuffle(pool, 'x:2026-11-10').map((p) => p.key))
    expect(a).not.toEqual(stableShuffle(pool, 'bluesky:2026-11-10').map((p) => p.key))
    expect([...a].sort()).toEqual(pool.map((p) => p.key).sort())
  })
  it('keeps X to a longer gap and one story a day, and takes turns on the ticks', () => {
    expect(gapMinutes('x')).toBe(30)
    expect(gapMinutes('bluesky')).toBe(GAP_MINUTES)
    expect(baselineStories('x')).toBe(1)
    expect(baselineStories('bluesky')).toBe(BASELINE_STORIES_PER_DAY)
    const t = (m: number) => at(`2026-11-10T15:${String(m).padStart(2, '0')}:00Z`)
    for (const m of [0, 5, 10, 15, 20, 25]) expect(tickSlot(t(m), 0)).not.toBe(tickSlot(t(m), 7))
  })
  it('lets a longer gap hold a channel back', () => {
    const now = at('2026-11-10T15:00:00Z')
    const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString()
    expect(gapPassed(now, ago(25), 30)).toBe(false)
    expect(gapPassed(now, ago(30), 30)).toBe(true)
  })
  it('gives X fewer baseline stories', () => {
    expect(storyDue(at('2026-11-10T12:05:00Z'), 0, 1)).toBe(true)
    expect(storyDue(at('2026-11-10T20:00:00Z'), 1, 1)).toBe(false)
  })
})

describe('help facts', () => {
  const now = at('2026-11-10T15:00:00Z')
  it('gives states that have data a post with the state benefit figures, big states first, linking the benefits page', async () => {
    const { helpFacts } = await import('@/lib/social/facts')
    const facts = helpFacts(now)
    expect(facts.length).toBeGreaterThan(30)
    expect(facts[0].state).toBe('CA')
    const tx = facts.find((f) => f.state === 'TX')!
    expect(tx.key).toBe('story-help-TX-2026-11')
    expect(tx.path).toBe('/unemployment-benefits/texas')
    expect(tx.lines[0]).toBe('State: Texas')
    expect(tx.lines.some((l) => l.startsWith('Maximum weekly unemployment benefit: $'))).toBe(true)
    expect(tx.lines.at(-1)).toContain('the state decides')
  })
  it('has a template that fits Bluesky for every state', async () => {
    const { helpFacts } = await import('@/lib/social/facts')
    for (const f of helpFacts(now)) expect(f.fallback(factLink(f, 'facebook'), false).length).toBeLessThanOrEqual(300)
  })
})

describe('press weekly fact', () => {
  it('carries the index, the year change and its source, and links /press', async () => {
    const { pressWeeklyFact } = await import('@/lib/social/facts')
    const f = pressWeeklyFact({ latest: { month: '2026-08', index: 161.6, ltuShare: 33.44 }, yearAgo: { index: 128.2 } }, '2026-W45')
    expect(f.key).toBe('press-weekly-2026-W45')
    expect(f.path).toBe('/press')
    expect(f.lines[0]).toContain('162')
    expect(f.lines).toContain('Up 33 points from a year ago')
    expect(f.lines.join(' ')).toContain('33.4%')
    expect(f.lines.join(' ')).toContain('Census Bureau Current Population Survey')
    expect(f.fallback(factLink(f, 'facebook'), false).length).toBeLessThanOrEqual(300)
  })
  it('is on Tuesday at 14:00 UTC only', async () => {
    const { isPressSlot } = await import('@/lib/social/pace')
    expect(isPressSlot(at('2026-11-10T14:10:00Z'))).toBe(true)
    expect(isPressSlot(at('2026-11-10T15:10:00Z'))).toBe(false)
    expect(isPressSlot(at('2026-11-11T14:10:00Z'))).toBe(false)
  })
})

describe('tags', () => {
  const registry = { dol: { name: 'Labor', bluesky: 'dol.gov', x: 'USDOL' }, solo: { name: 'Bluesky only', bluesky: 'solo.org' } }
  const link = 'https://launchyournextchapter.com/press?utm_source=bluesky&utm_medium=social&utm_campaign=press-weekly'
  it('tags only the handles the registry holds for that channel, never an unknown key', async () => {
    const { tagsFor } = await import('@/lib/social/tags')
    expect(tagsFor(['dol', 'solo', 'nobody'], 'bluesky', registry)).toEqual(['@dol.gov', '@solo.org'])
    expect(tagsFor(['dol', 'solo'], 'x', registry)).toEqual(['@USDOL'])
    expect(tagsFor(['dol'], 'mastodon', registry)).toEqual([])
    expect(tagsFor(undefined, 'bluesky', registry)).toEqual([])
  })
  it('adds cc and the handles when the post still fits, and leaves the post untagged when it would not', async () => {
    const { withTags } = await import('@/lib/social/tags')
    const short = `Index is 162. ${link}`
    expect(withTags(short, { cites: ['dol'] }, 'bluesky', link, registry)).toBe(`${short}\n\ncc @dol.gov`)
    const long = `${'x'.repeat(280)} ${link}`.slice(0, 295)
    expect(withTags(long, { cites: ['dol'] }, 'bluesky', link, registry)).toBe(long)
    expect(withTags(short, {}, 'bluesky', link, registry)).toBe(short)
  })
  it('lists only handles that were checked: every seeded Bluesky handle is a domain handle', async () => {
    const { HANDLES } = await import('@/lib/social/tags')
    for (const h of Object.values(HANDLES)) if (h.bluesky) expect(h.bluesky).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
  })
})

describe('mention facets', () => {
  it('makes a mention carry the account id, with byte offsets that survive multi-byte text', async () => {
    const { mentionFacets } = await import('@/lib/social/clients')
    const text = 'Café data, cc @dol.gov and @nope.example'
    const facets = await mentionFacets(text, async (h) => (h === 'dol.gov' ? 'did:plc:abc' : null))
    expect(facets).toHaveLength(1)
    expect(facets[0].features[0]).toEqual({ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:abc' })
    expect(Buffer.from(text).subarray(facets[0].index.byteStart, facets[0].index.byteEnd).toString()).toBe('@dol.gov')
  })
})

describe('layoff tags', () => {
  it('tags the state agency on a WARN filing and never the employer', async () => {
    const { layoffCites, tagsFor } = await import('@/lib/social/tags')
    const cites = layoffCites({ state: 'CA', sourceUrl: null, kind: 'filing' })
    expect(cites).toEqual(['agency:CA'])
    expect(tagsFor(cites, 'x')).toEqual(['@CA_EDD'])
    expect(tagsFor(cites, 'bluesky')).toEqual([])
  })
  it('credits the outlet on a news-sourced layoff, then the agency, at most two', async () => {
    const { layoffCites, tagsFor } = await import('@/lib/social/tags')
    const cites = layoffCites({ state: 'GA', sourceUrl: 'https://www.reuters.com/business/x-cuts-jobs-2026-11-03/', kind: 'announcement' })
    expect(cites).toEqual(['outlet:reuters.com', 'agency:GA'])
    expect(tagsFor(cites, 'bluesky')).toEqual(['@reuters.com'])
    expect(tagsFor(cites, 'x')).toEqual(['@GeorgiaDOL'])
    expect(layoffCites({ state: 'GA', sourceUrl: 'https://www.wsj.com/a', kind: 'filing' })).toEqual(['agency:GA'])
  })
  it('skips a state or outlet with no verified handle, and a malformed or unknown source', async () => {
    const { layoffCites } = await import('@/lib/social/tags')
    expect(layoffCites({ state: 'PA', sourceUrl: null, kind: 'filing' })).toEqual([])
    expect(layoffCites({ state: null, sourceUrl: 'https://smallblog.example.com/post', kind: 'announcement' })).toEqual([])
    expect(layoffCites({ state: null, sourceUrl: 'not a url', kind: 'announcement' })).toEqual([])
  })
  it('matches an outlet by its site, including a subdomain', async () => {
    const { layoffCites } = await import('@/lib/social/tags')
    expect(layoffCites({ state: null, sourceUrl: 'https://markets.businessinsider.com/news/y', kind: 'announcement' })).toEqual(['outlet:businessinsider.com'])
    expect(layoffCites({ state: null, sourceUrl: 'https://notbusinessinsider.com/y', kind: 'announcement' })).toEqual([])
  })
  it('never lists a state agency that is the Governor, the state account or a Spanish-language account', async () => {
    const { STATE_AGENCIES } = await import('@/lib/social/tag-handles')
    for (const s of ['PA', 'DE', 'NY']) expect(STATE_AGENCIES[s]).toBeUndefined()
    for (const h of Object.values(STATE_AGENCIES)) expect(h.x).not.toMatch(/governor|delaware_gov|enespanol/i)
  })
  it('tags the state agency on a help post for that state', async () => {
    const { helpFacts } = await import('@/lib/social/facts')
    const facts = helpFacts(new Date('2026-11-10T15:00:00Z'))
    expect(facts.find((f) => f.state === 'TN')!.cites).toEqual(['agency:TN'])
    expect(facts.find((f) => f.state === 'TX')!.cites).toEqual([])
  })
})
