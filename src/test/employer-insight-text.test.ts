import { describe, expect, it } from 'vitest'
import { insightRichness, insightText } from '@/lib/seo/employer-insight-text'
import type { EmployerInsights } from '@/lib/seo/employer-insights'

const base = (over: Partial<EmployerInsights> = {}): EmployerInsights => ({
  live: { open: 40, entry: 8, noExp: 2, training: 1, aiSkill: 6, clearance: 0, noSponsorship: 3, remote: 5, hybrid: 10, onsite: 5, fullTime: 38, contract: 2, partTime: 0, postedPay: 20, new7d: 4, medianAgeDays: 9, topSkills: [{ name: 'excel', count: 9 }, { name: 'sql', count: 7 }, { name: 'python', count: 5 }], aiTools: [{ name: 'Claude', count: 2 }], aiCerts: [], noExpExamples: [], trainingExample: null },
  history: { months: [{ month: '2026-09', opened: 5 }, { month: '2026-10', opened: 7 }], opened12mo: 12, closed12mo: 0, trackedSince: '2026-09-02', trackedDays: 50, last90: 12, prior90: 0 },
  benchmark: { industry: 'Technology', employers: 120, medianOpen: 9, medianPostedPayShare: 0.3, medianRemoteShare: 0.2 },
  profile: { postedPayShare: 0.5, remoteShare: 0.1 },
  rank: { position: 4, of: 120 },
  similar: [],
  ...over,
})

describe('insightText', () => {
  it('says how long we have tracked an employer instead of comparing against history we do not have', () => {
    const t = insightText('Acme', base(), 'Technology')
    expect(t.glance[0]).toContain('since Sep 2026')
    expect(t.glance.join(' ')).not.toMatch(/90 days before/)
  })
  it('compares to the prior 90 days only once 180 days are tracked', () => {
    const t = insightText('Acme', base({ history: { ...base().history, trackedDays: 300, last90: 12, prior90: 6 } }), 'Technology')
    expect(t.glance[0]).toContain('up 100%')
  })
  it('never mentions layoffs', () => {
    const t = insightText('Acme', base(), 'Technology')
    expect(JSON.stringify(t).toLowerCase()).not.toMatch(/layoff|laid off|warn/)
  })
  it('writes entry-level and skills FAQs from the counts', () => {
    const t = insightText('Acme', base(), 'Technology')
    expect(t.faq.map((f) => f.q)).toContain('Does Acme hire entry-level candidates?')
    expect(t.faq.map((f) => f.q)).toContain('What skills does Acme ask for?')
  })
  it('scores richness by distinct kinds of data', () => {
    expect(insightRichness(base())).toBeGreaterThanOrEqual(6)
  })
})
