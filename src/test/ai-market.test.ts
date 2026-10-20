import { describe, it, expect } from 'vitest'
import { buildAiMarket, likeForLike, paysMore, premiumPhrase, type AiMarketCellRow } from '@/lib/skills/ai-market'
import { importAiSkillFields } from '@/lib/skills/ai-skills'
import { aiMarketLine, suggestedAiItems } from '@/lib/skills/ai-skill-market'
import { aiPayNoteFor } from '@/components/dashboard/learning/AiPaysMoreNote'
import { publicCount } from '@/components/marketing/AiJobsStat'

const LABELS = { finance: 'Finance', legal: 'Legal' }
const counts = { live: 1000, aiSkill: 100, aiExposed: 150, fullText: 600, twin: 50, excerpt: 400, unread: 0, aiSkillFullText: 90, aiExposedFullText: 120 }
const cell = (fn: string | null, lvl: string | null, ind: string | null, side: 'ai' | 'base', n: number, med: number, g: number): AiMarketCellRow => ({ fn, lvl, ind, side, n, med, g })

function market() {
  return buildAiMarket({
    asOf: '2026-10-20T23:45:00Z',
    counts,
    shares: [
      { fn: 'Finance', n: 400, skill: 60, exposed: 80 },
      { fn: 'Legal', n: 300, skill: 9, exposed: 12 },
    ],
    cells: [
      // finance x manager: two industries; only the first has 30+ on both sides
      cell('Finance', 'manager', 'technology', 'ai', 40, 180000, 0),
      cell('Finance', 'manager', 'technology', 'base', 60, 150000, 0),
      cell('Finance', 'manager', 'retail', 'ai', 20, 200000, 0),
      cell('Finance', 'manager', 'retail', 'base', 90, 100000, 0),
      cell('Finance', 'manager', null, 'ai', 60, 185000, 1),
      cell('Finance', 'manager', null, 'base', 150, 120000, 1),
      cell('Finance', 'director', 'technology', 'ai', 30, 230000, 0),
      cell('Finance', 'director', 'technology', 'base', 30, 200000, 0),
      cell('Finance', 'director', null, 'ai', 30, 230000, 1),
      cell('Finance', 'director', null, 'base', 30, 200000, 1),
      cell('Finance', null, null, 'ai', 90, 200000, 3),
      cell('Finance', null, null, 'base', 180, 130000, 3),
      cell('Legal', null, null, 'ai', 5, 210000, 3),
      cell('Legal', null, null, 'base', 80, 150000, 3),
      cell(null, null, null, 'ai', 95, 200000, 7),
      cell(null, null, null, 'base', 260, 135000, 7),
    ],
    items: [
      { fn: 'Finance', key: 'a_tool_use', n: 40 },
      { fn: 'Finance', key: 'l_governance', n: 12 },
      { fn: 'Finance', key: 'not_an_item', n: 99 },
      { fn: 'Finance', key: 'a_assistants', n: 20 },
    ],
    tools: [{ fn: 'Finance', key: 'Microsoft Copilot (M365)', n: 15 }],
    functionLabels: LABELS,
  })
}

describe('AI market snapshot', () => {
  it('computes raw and like-for-like, using only cells with 30+ on both sides', () => {
    const m = market()
    const f = m.functions.finance
    expect(f.sharePct).toBe(15)
    expect(f.exposedPct).toBe(20)
    expect(f.premium?.rawPct).toBe(53.8) // 200k vs 130k
    // like-for-like: tech manager (40, 180/150) + tech director (30, 230/200); retail manager left out (20 AI)
    const expected = Math.exp((40 * Math.log(180 / 150) + 30 * Math.log(230 / 200)) / 70) - 1
    expect(f.premium?.likePct).toBeCloseTo(100 * expected, 1)
    expect(f.premium?.likeN).toBe(70)
    // a level whose cells hold fewer than 50 AI postings: raw only, no like-for-like
    expect(f.levels.manager?.rawPct).toBeGreaterThan(0)
    expect(f.levels.manager?.likePct).toBeUndefined()
    // under 30 AI postings: no premium at all
    expect(m.functions.legal.premium).toBeUndefined()
    expect(f.topItems.map((i) => i.id)).toEqual(['a_tool_use', 'a_assistants', 'l_governance'])
    expect(m.overall?.rawPct).toBeGreaterThan(0)
  })

  it('never states one number without the other', () => {
    const m = market()
    expect(premiumPhrase(m.functions.finance.levels.manager)).toBeNull()
    expect(premiumPhrase(m.functions.finance.premium)).toMatch(/higher raw, about [\d.]+% higher like-for-like/)
    expect(likeForLike([{ ai: { n: 10, med: 1 }, base: { n: 10, med: 1 } }])).toBeNull()
    expect(paysMore(m.functions.finance.premium)).toBe(true)
  })

  it('feeds the market line, the suggestions and the Learning note', () => {
    const m = market()
    const line = aiMarketLine('Finance', m)!
    expect(line.text).toMatch(/^In Finance postings, 15% ask for a specific AI skill\. Where they do, posted pay is \$70k \(53\.8%\) higher raw/)
    expect(line.text).toMatch(/Posted pay on our live board, as of Oct 20, 2026\.$/)
    expect(suggestedAiItems('Finance', [], 4, m)[0]).toBe('a_tool_use')
    const note = aiPayNoteFor('Finance', m)!
    expect(note.skills).toHaveLength(3)
    expect(note.skills[0].course?.url).toMatch(/^https:\/\//)
    expect(aiPayNoteFor('Legal', m)).toBeNull()
    expect(aiPayNoteFor('Finance', null)).toBeNull()
  })

  it('floors the public count', () => {
    expect(publicCount(27743)).toBe('27,700+')
    expect(publicCount(812)).toBe('812')
  })
})

describe('import of the AI-exposed fields', () => {
  it('keeps known reasons, adds skill when items exist, and validates basis', () => {
    const f = importAiSkillFields({ aiSkillItems: [], aiExposed: true, aiExposureWhy: ['title', 'skill', 'bogus'], aiMention: true, aiBasis: 'twin' })
    expect(f.aiExposureWhy).toEqual(['title'])
    expect(f.aiExposed).toBe(true)
    expect(f.aiBasis).toBe('twin')
    const g = importAiSkillFields({ aiSkillItems: ['a_prompt'], aiExposed: false, aiExposureWhy: [], aiMention: false, aiBasis: 'nope' })
    expect(g.aiExposureWhy).toEqual(['skill'])
    expect(g.aiExposed).toBe(true)
    expect(g.aiMention).toBe(true)
    expect(g.aiBasis).toBeNull()
    expect(importAiSkillFields({ aiSkillItems: [] })).toEqual({})
  })
})
