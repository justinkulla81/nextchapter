import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import type { NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import { buildPortfolioAssetChecklist } from '@/lib/portfolio/asset-checklist'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'
import { getMoveTheNeedle } from '@/lib/reports/market-reality-sections'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { renderMarkdownLinks } from '@/lib/text/render-markdown-links'
import { nextPortfolioStep, portfolioAssetRows } from '@/lib/redesign/jobs-pages'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { Module } from '@/components/candidate/Module'
import { RowList } from '@/components/candidate/RowList'
import { SectionBlock } from '@/components/candidate/Blocks'
import { candidatePlusRequirements } from '@/lib/unlocks/ladder'

export const metadata: Metadata = { title: 'My Portfolio' }


export default async function PortfolioPage() {
  const profile = await getDashboardData()

  const [
    narrativeRows,
    reportHistory,
    marketRealitySnapshotCount,
    coach,
    dossierStatus,
    learningBadgeCount,
    moveTheNeedle,
  ] = await Promise.all([
      prisma.candidateNarrative.findMany({
        where: { candidateId: profile.id },
        orderBy: { generatedAt: 'asc' },
      }),
      prisma.marketRealityReport.findMany({
        where: { candidateId: profile.id },
        orderBy: { generatedAt: 'desc' },
        take: 6,
        select: { id: true, generatedAt: true },
      }),
      // Only the count is ever read below (hasMarketRealitySnapshot) — was
      // pulling every column of every snapshot row just to check .length.
      prisma.marketRealitySnapshot.count({
        where: { candidateId: profile.id },
      }),
      profile.coachId
        ? prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
        : null,
      isDossierUnlocked(profile.id),
      prisma.learningBadge.count({ where: { candidateId: profile.id } }),
      // What builds the Dossier over time (references, network, skills,
      // interim work, recruiter network, coaching) — relocated here from
      // the Market Reality Report, which is now scoped to day-one signal
      // only (job goals, red flags, personalization, resume). Reused as-is,
      // not reimplemented.
      getMoveTheNeedle(profile.id),
    ])

  const narratives: NarrativeItem[] = narrativeRows.map((n, i) => ({
    id: n.id,
    label: n.label,
    coreStatement: n.coreStatement,
    adaptations: (n.adaptations as unknown as NarrativeAdaptations | null) ?? null,
    isDefault: i === 0,
  }))

  const latestResume = profile.resumes[0]
  const coverLettersCount = profile.jobPostings.filter((j) => !!j.coverLetter).length
  const hasCoachDossierAccess = profile.coachId !== null && profile.coachDossierConsentedAt !== null
  const isCandidatePlus = dossierStatus.unlocked
  // The four Candidate+ requirements (unlock ladder): outreach, applications, minutes, one assessment.
  const plusRequirements = candidatePlusRequirements(dossierStatus).map((r) => ({ ...r, met: isCandidatePlus || r.met }))
  const completedReferenceCount = profile.references.filter((r) => r.status === 'COMPLETED').length

  // Same categories the "My Portfolio" nav badge counts (see
  // portfolioAssetCount in dashboard/layout.tsx, built from the same
  // buildPortfolioAssetChecklist) — surfaced here so the number in the nav
  // has a legible meaning on the page itself instead of just being an
  // unexplained count.
  const coreAssets = buildPortfolioAssetChecklist({
    hasResume: profile.resumes.length > 0,
    hasCoverLetter: coverLettersCount > 0,
    hasNarrative: narratives.length > 0,
    hasMarketRealityReport: reportHistory.length > 0,
    hasMarketRealitySnapshot: marketRealitySnapshotCount > 0,
    hasWorkSample: profile.workSamples.length > 0,
    hasCompletedReference: completedReferenceCount > 0,
    hasLearningBadge: learningBadgeCount > 0,
  })
  const completedAssetCount = coreAssets.filter((a) => a.done).length

  const step = nextPortfolioStep(coreAssets)
  const assets = portfolioAssetRows({
    resumeName: latestResume?.fileName ?? null,
    resumeVersions: profile.resumes.length,
    coverLetters: coverLettersCount,
    narratives: narratives.length,
    workSamples: profile.workSamples.length,
    completedReferences: completedReferenceCount,
    credentials: learningBadgeCount,
  })
  const stepsMet = plusRequirements.filter((r) => r.met).length
  return (
    <div className="space-y-8">
      <PageHeader
        title="My portfolio"
        intro={
          step
            ? `${completedAssetCount} of ${coreAssets.length} core assets built. Next: ${step.label.toLowerCase()}. ${step.why}`
            : `All ${coreAssets.length} core assets are built. Keep them current and recruiters see your best work.`
        }
        action={
          step ? (
            <ActionLink href={step.href} kind="primary" event="portfolio_next_step_clicked" props={{ step: step.label, built: completedAssetCount, total: coreAssets.length }}>
              {step.label}
            </ActionLink>
          ) : undefined
        }
      />
      <SectionBlock id="assets-h" title="What you can hand a recruiter" why="Your interview prep lives on the Interviews page instead.">
        <RowList
          label="Portfolio assets"
          items={assets.map((a) => ({
            key: a.key,
            title: a.title,
            why: a.status,
            fact: a.why ?? undefined,
            actions: (
              <ActionLink href={a.href} event="portfolio_asset_opened" props={{ asset: a.key, done: a.done }}>
                {a.actionLabel}
              </ActionLink>
            ),
          }))}
        />
      </SectionBlock>
      <ShowMore page="portfolio" label="Show reports, your dossier and Candidate+">
        <SectionBlock id="reports-h" title="Reports and dossiers" why="Your market report and what recruiters and coaches see.">
          <RowList
            label="Reports and dossiers"
            items={[
              {
                key: 'market-report',
                title: 'Market reality report',
                why: reportHistory.length > 0 ? `Latest report ${reportHistory[0].generatedAt.toLocaleDateString()}.` : 'Your full report and the week-by-week trend behind it.',
                actions: (
                  <>
                    {reportHistory.length > 0 && (
                      <ActionLink href="/dashboard/market-reality" event="portfolio_report_opened" props={{ report: 'market_reality' }}>
                        View full report
                      </ActionLink>
                    )}
                    <ActionLink href="/dashboard/stats#market-reality" kind="text" event="portfolio_report_opened" props={{ report: 'weekly_history' }}>
                      Weekly history
                    </ActionLink>
                  </>
                ),
              },
              isCandidatePlus
                ? {
                    key: 'dossier',
                    title: 'Executive dossier',
                    why: 'What recruiters and hiring managers see when you share your profile with them.',
                    actions: (
                      <ActionLink href="/dashboard/recruiter-report" event="portfolio_report_opened" props={{ report: 'dossier' }}>
                        View
                      </ActionLink>
                    ),
                  }
                : { key: 'dossier', title: 'Executive dossier', why: 'Opens when you have done the work for Candidate+.', fact: renderMarkdownLinks(dossierStatus.reason) },
              ...(profile.coachId
                ? [
                    hasCoachDossierAccess
                      ? {
                          key: 'coach-dossier',
                          title: 'Coach dossier and notes',
                          why: `Exactly what ${coach?.fullName ?? 'your coach'} sees when preparing for your sessions.`,
                          actions: (
                            <ActionLink href="/dashboard/coach-dossier" event="portfolio_report_opened" props={{ report: 'coach_dossier' }}>
                              View
                            </ActionLink>
                          ),
                        }
                      : {
                          key: 'coach-dossier',
                          title: 'Coach dossier and notes',
                          why: 'Turn on sharing so your coach arrives knowing your background, and spends the time coaching instead of asking.',
                          actions: (
                            <ActionLink href="/dashboard/privacy" event="portfolio_coach_sharing_clicked" props={{ source: 'portfolio' }}>
                              Turn on sharing
                            </ActionLink>
                          ),
                        },
                  ]
                : [
                    {
                      key: 'coaching',
                      title: 'A human coach as well',
                      why: 'Victoria stays free. Executive Coach adds a human career coach: mock interviews, résumé review, a second opinion on hard calls.',
                      actions: (
                        <ActionLink href="/coaching" event="portfolio_coaching_learn_more_clicked" props={{ source: 'portfolio' }}>
                          Learn more
                        </ActionLink>
                      ),
                    },
                  ]),
            ]}
          />
        </SectionBlock>
        <Module title={isCandidatePlus ? 'You are Candidate+, and it stays on' : 'Earn Candidate+'} tone="dark">
          <p className="max-w-2xl text-base text-white/85">
            Candidate+ is earned with real work, not bought. It opens your executive dossier, the executive recruiter network, and who to contact, the apply kit and explain-my-gaps on every job.
            {!isCandidatePlus && ` ${stepsMet} of ${plusRequirements.length} steps done.`}
          </p>
          <ul className="grid gap-x-6 gap-y-1 text-base sm:grid-cols-2">
            {plusRequirements.map((r) => (
              <li key={r.key} className={r.met ? 'text-white' : 'text-white/75'}>
                <span aria-hidden>{r.met ? '✓ ' : '○ '}</span>
                {r.label}
              </li>
            ))}
          </ul>
          {moveTheNeedle.length > 0 && (
            <div className="space-y-2 border-t border-white/20 pt-4">
              <p className="text-base font-semibold">What moves it most</p>
              <ul className="space-y-1.5">
                {moveTheNeedle.map((lever) => (
                  <li key={lever.key} className="text-base">
                    <Link href={lever.href} className="font-medium underline underline-offset-4">
                      {lever.label}
                    </Link>
                    <span className="text-white/75">. {lever.copy}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Module>
      </ShowMore>
    </div>
  )
}
