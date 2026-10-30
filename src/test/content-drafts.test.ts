import { describe, expect, it } from 'vitest'
import { CHANNELS, SITE, buildVersions, campaignFor, copyText, trackedLink, xLength, X_LIMIT } from '@/lib/content/card'
import { aiJobCard, aiPayCard, deadlineCard, entryCard, layoffCard, seniorCard } from '@/lib/content/cards'

const day = '2026-10-30'
const cards = () => [
  layoffCard({ employer: 'Acme Corp', employees: 1200, state: 'IL', place: 'Cook County, IL', effectiveDate: new Date('2026-12-15T00:00:00Z'), credibility: 'warn-filing', slug: 'acme-corp', openRolesInState: null }),
  layoffCard({ employer: 'Globex', employees: 3000, state: null, place: null, effectiveDate: null, credibility: 'two-publishers', slug: 'globex', openRolesInState: null }),
  aiJobCard({ soc6: '15-1252', title: 'Software Developers', score: 0.42, medianWage: 133080, growthPct: 17.9 }),
  aiJobCard({ soc6: '11-9111', title: 'Medical and Health Services Managers', score: 0.04, medianWage: null, growthPct: null }),
  aiPayCard({ pct: 18.4, likeForLike: true, nAi: 5200, nBase: 41000, liveJobs: 650000, aiSkillJobs: 91000, asOf: 'Oct 30, 2026' }),
  entryCard({ entry: 42100, liveUs: 650000, noExp: 3100, training: 900, asOf: 'Oct 30, 2026' }),
  seniorCard({ n: 8200, aiSkill: 2100, sharePct: 25.6, asOf: 'Oct 30, 2026' }),
  deadlineCard({ lastDay: new Date('2026-11-13T00:00:00Z'), employer: 'Acme Corp', state: 'IL' }),
  deadlineCard({ lastDay: null, employer: null, state: null }),
]

describe('content drafts', () => {
  it('tags every link with the channel, a medium and the draft campaign', () => {
    const link = trackedLink('/jobs', 'reddit', 'cd-20261030-market-entry')
    expect(link).toBe(`${SITE}/jobs?utm_source=reddit&utm_medium=social&utm_campaign=cd-20261030-market-entry`)
    expect(trackedLink('/x?a=1', 'newsletter', 'c')).toContain('?a=1&utm_source=newsletter&utm_medium=email')
    expect(campaignFor(day, { kind: 'layoff', subject: 'Acme Corp' })).toBe('cd-20261030-layoff-acme-corp')
  })

  it('builds all five channels with the full https link and the source', () => {
    for (const card of cards()) {
      const campaign = campaignFor(day, card)
      const v = buildVersions(card, campaign)
      for (const c of CHANNELS) {
        const text = copyText(v, c)
        expect(text.length, `${card.kind} ${c}`).toBeGreaterThan(40)
        expect(text).not.toMatch(/undefined|NaN|\[object/)
      }
      expect(v.linkedin.comment).toContain(`https://launchyournextchapter.com${card.path}`)
      expect(v.linkedin.comment).toContain(`utm_campaign=${campaign}`)
      expect(v.x.body).toContain('utm_source=x')
      expect(v.reddit.body).toContain('utm_source=reddit')
      expect(v.reddit.body.trim().split('\n').pop()).toMatch(/^More, with the numbers behind it: https:\/\//)
      expect(v.linkedin.body).not.toContain('https://') // the link lives in the first comment
      expect(v.newsletter.body).toContain('utm_medium=email')
      expect(v.video.lines.length).toBeGreaterThanOrEqual(4)
      expect(v.linkedin.body).toContain(card.big === '2 days' ? 'Source' : card.source)
    }
  })

  it('keeps X posts within 280 characters with the link counted at 23', () => {
    for (const card of cards()) {
      const { x } = buildVersions(card, campaignFor(day, card))
      expect(xLength(x.body), card.headline).toBeLessThanOrEqual(X_LIMIT)
    }
    const long = { ...cards()[0], headline: 'A'.repeat(400) + ' filed a layoff notice' }
    expect(xLength(buildVersions(long, 'c').x.body)).toBeLessThanOrEqual(X_LIMIT)
  })

  it('states the layoff by what the source says and never names a person', () => {
    const [warn, news] = cards()
    expect(warn.headline).toBe('Acme Corp filed a layoff notice naming 1,200 workers in Cook County, IL')
    expect(layoffCard({ employer: 'Spirit', employees: 999, state: 'NV', place: 'Clark/Washoe County, NV', effectiveDate: null, credibility: 'warn-filing', slug: 's', openRolesInState: null }).headline).toBe('Spirit filed a layoff notice naming 999 workers in Nevada')
    expect(warn.points[0]).toBe('The layoffs are effective December 15')
    expect(news.headline).toBe('Globex has announced about 3,000 job cuts')
    expect(news.points[0]).toMatch(/60 days/)
    for (const c of [warn, news]) expect(buildVersions(c, 'c').linkedin.body).not.toMatch(/@|tag /i)
  })

  it('words AI exposure as observed use, never a forecast', () => {
    const [high, low] = [cards()[2], cards()[3]]
    expect(high.big).toBe('42%')
    expect(high.headline).toContain('already used for 42% of the tasks in software developers work')
    expect(low.headline).toContain('Little AI use is seen so far')
    for (const c of [high, low]) expect(JSON.stringify(c)).not.toMatch(/\b(risk|safe|will be replaced|replace)\b/i)
  })

  it('dates the deadline card from the last day of work', () => {
    const d = cards()[7]
    expect(d.headline).toBe('Laid off from Acme Corp on November 13? File for unemployment by November 15')
    expect(d.points[1]).toContain('ends January 12')
    expect(d.path).toBe('/unemployment-benefits/illinois')
    expect(cards()[8].path).toBe('/tools/layoff-deadlines')
  })

  it('reports the pay premium with its sign and basis', () => {
    const p = cards()[4]
    expect(p.big).toBe('+18%')
    expect(p.points[0]).toContain('5,200 postings')
  })
})
