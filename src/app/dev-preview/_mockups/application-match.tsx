'use client'

import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Module } from '@/components/candidate/Module'
import { PrimaryButton } from '@/components/candidate/ui'
import { ApplicationMatchView, type ApplicationMatchData } from '@/components/dashboard/ApplicationMatchView'

// Search Strategy with "Your applications: match and gaps" (the code that ships, sample data shaped like
// production's on 2026-10-20: one member, 45 readable applications, 1 from a posting and 44 inferred).
// The section takes the third first-view slot; the "Unlock your next strategy" card moves into
// "More about your search".
export const SAMPLE_APPLICATION_MATCH: ApplicationMatchData = {
  applications: 45,
  fromPostings: 1,
  inferred: 44,
  matchPct: 31,
  matchPctAtApply: 24,
  trend: [
    { weekStart: '2026-08-31', applications: 2, matchPct: 18 },
    { weekStart: '2026-09-07', applications: 2, matchPct: 0 },
    { weekStart: '2026-09-14', applications: 1, matchPct: 38 },
    { weekStart: '2026-09-21', applications: 0, matchPct: null },
    { weekStart: '2026-09-28', applications: 3, matchPct: 29 },
    { weekStart: '2026-10-05', applications: 2, matchPct: 25 },
    { weekStart: '2026-10-12', applications: 4, matchPct: 41 },
    { weekStart: '2026-10-19', applications: 1, matchPct: 50 },
  ],
  gaps: [
    { term: 'excel', applications: 36, recent: 2, inferredOnly: true, course: null },
    { term: 'forecasting', applications: 35, recent: 2, inferredOnly: true, course: null },
    { term: 'budgeting', applications: 20, recent: 2, inferredOnly: true, course: null },
    { term: 'financial modeling', applications: 18, recent: 2, inferredOnly: false, course: { title: 'Financial Modeling & Valuation Analyst (FMVA)', url: 'https://corporatefinanceinstitute.com/certifications/financial-modeling-valuation-analyst-fmva-program/' } },
    { term: 'AI governance and risk', applications: 4, recent: 1, inferredOnly: false, course: { title: 'NIST AI Risk Management Framework (AI RMF)', url: 'https://www.nist.gov/itl/ai-risk-management-framework' } },
  ],
  bestLine: 'You match 38% on Fundraising & development roles vs 6% on Executive Leadership roles.',
  recommendations: [
    { term: 'forecasting', reason: '35 of your 45 applications asked for it, and 9 of 22 employers hiring for roles that fit you ask for it.', course: null },
    { term: 'financial modeling', reason: '18 of your 45 applications asked for it, and 7 of 22 employers hiring for roles that fit you ask for it.', course: { title: 'Financial Modeling & Valuation Analyst (FMVA)', url: '#' } },
    { term: 'AI governance and risk', reason: '4 of your 45 applications asked for it, and 3 of 22 employers hiring for roles that fit you ask for it. Investment postings that ask for an AI skill pay about 17% more, like-for-like.', course: { title: 'NIST AI Risk Management Framework (AI RMF)', url: '#' } },
  ],
}

export function SearchStrategyApplicationMatch() {
  return (
    <PreviewShell place="home" entry="tailored">
      <PageHeader title="Your search strategy" intro="Victoria’s read of where you stand, and the few answers it rests on." action={<PrimaryButton>Answer 2 more questions</PrimaryButton>} />
      <Module title="Victoria’s read">
        <p className="text-base text-ink">Your record fits the roles you want, but searches like yours stall after the first screen. The fix is a warmer way in, not more applications.</p>
      </Module>
      <ApplicationMatchView data={SAMPLE_APPLICATION_MATCH} onConfirm={async () => ({ ok: true })} />
      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold text-ink">What this rests on</h2>
        <p className="text-sm text-muted-foreground">(the answers wizard, unchanged)</p>
      </section>
    </PreviewShell>
  )
}

export function ApplicationMatchFew() {
  return (
    <PreviewShell place="home" entry="tailored">
      <ApplicationMatchView
        data={{
          applications: 2,
          fromPostings: 1,
          inferred: 1,
          matchPct: 60,
          matchPctAtApply: 60,
          trend: SAMPLE_APPLICATION_MATCH.trend.map((t, i) => (i === 7 ? { ...t, applications: 2, matchPct: 60 } : { ...t, applications: 0, matchPct: null })),
          gaps: [{ term: 'sql', applications: 1, recent: 1, inferredOnly: false, course: null }],
          bestLine: null,
          recommendations: [],
        }}
        onConfirm={async () => ({ ok: false, error: 'That skill could not be added. Reload the page and try again.' })}
      />
    </PreviewShell>
  )
}
