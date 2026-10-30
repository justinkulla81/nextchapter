import { describe, expect, it } from 'vitest'
import { buildGapReport, fullRunCostUsd, type StoredResult } from '@/lib/ai-visibility/gaps'
import { CITATION_PROMPT_DEFS, CITATION_PROMPTS, GROUP_LABEL, pageBriefFor } from '@/lib/ai-visibility/prompts'

const NOW = new Date('2026-10-30T12:00:00Z')
const day = 86_400_000
const row = (promptKey: string, provider: string, o: Partial<StoredResult> = {}): StoredResult => ({ promptKey, provider, cited: false, mentioned: false, error: null, citedDomains: [], createdAt: new Date(NOW.getTime() - day), ...o })

describe('prompt list', () => {
  it('has about 300 unique questions across the three groups', () => {
    expect(CITATION_PROMPTS.length).toBeGreaterThanOrEqual(285)
    expect(CITATION_PROMPTS.length).toBeLessThanOrEqual(320)
    expect(new Set(CITATION_PROMPTS.map((p) => p.key)).size).toBe(CITATION_PROMPTS.length)
    expect(new Set(CITATION_PROMPTS.map((p) => p.prompt.toLowerCase())).size).toBe(CITATION_PROMPTS.length)
    for (const g of Object.keys(GROUP_LABEL)) expect(CITATION_PROMPT_DEFS.filter((d) => d.group === g).length).toBeGreaterThanOrEqual(90)
  })
  it('keeps the 30 original keys, which history is stored under', () => {
    for (const k of ['laid-off-first-steps', 'severance-negotiate', 'job-search-scams', 'interview-prep-senior', 'cover-letter-ai', 'ai-skills-jobs']) expect(CITATION_PROMPTS.some((p) => p.key === k)).toBe(true)
  })
  it('does not use the data: prefix reserved for the weekly filing questions', () => {
    expect(CITATION_PROMPTS.some((p) => p.key.startsWith('data:'))).toBe(false)
  })
  it('mixes groups inside the 20 questions a weekly run takes', () => {
    expect(new Set(CITATION_PROMPT_DEFS.slice(0, 20).map((d) => d.group)).size).toBe(3)
  })
  it('gives every question a brief, and every named page exists', () => {
    for (const d of CITATION_PROMPT_DEFS) {
      const b = pageBriefFor(d.key)
      expect(b.brief.length).toBeGreaterThan(10)
    }
  })
})

describe('buildGapReport', () => {
  const a = CITATION_PROMPT_DEFS[0].key
  const b = CITATION_PROMPT_DEFS[1].key
  const c = CITATION_PROMPT_DEFS[2].key
  it('ranks questions by how many assistants miss us and names who is cited instead', () => {
    const r = buildGapReport(
      [
        row(a, 'claude', { citedDomains: ['indeed.com', 'reddit.com'] }),
        row(a, 'openai', { citedDomains: ['indeed.com'] }),
        row(b, 'claude', { cited: true, citedDomains: ['launchyournextchapter.com'] }),
        row(b, 'openai', { citedDomains: ['dol.gov'] }),
        row(c, 'claude', { mentioned: true }),
      ],
      'launchyournextchapter.com',
      NOW,
    )
    expect(r.gaps.map((g) => g.key)).toEqual([a, b])
    expect(r.gaps[0].missedBy).toEqual(['claude', 'openai'])
    expect(r.gaps[0].rivals).toEqual(['indeed.com', 'reddit.com'])
    expect(r.share).toMatchObject({ answers: 5, cited: 1, mentioned: 1, present: 2 })
    expect(r.notAsked).toBe(CITATION_PROMPT_DEFS.length - 3)
  })
  it('uses the newest answer, ignores errors and answers past the window', () => {
    const r = buildGapReport(
      [
        row(a, 'claude', { cited: true, createdAt: new Date(NOW.getTime() - 40 * day) }),
        row(a, 'claude', { cited: false, createdAt: new Date(NOW.getTime() - 2 * day) }),
        row(a, 'openai', { error: 'empty answer' }),
        row(b, 'claude', { createdAt: new Date(NOW.getTime() - 400 * day) }),
      ],
      'launchyournextchapter.com',
      NOW,
    )
    expect(r.statuses.find((s) => s.key === a)?.answered).toEqual(['claude'])
    expect(r.gaps.map((g) => g.key)).toEqual([a])
    expect(r.share.answers).toBe(1)
  })
})

describe('fullRunCostUsd', () => {
  it('multiplies the providers’ per-question estimates by the number of questions', () => {
    expect(fullRunCostUsd([{ estCostUsd: 0.03 }, { estCostUsd: 0.012 }], 100)).toBeCloseTo(4.2)
  })
})
