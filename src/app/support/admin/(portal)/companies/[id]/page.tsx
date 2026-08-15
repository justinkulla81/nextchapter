import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Building2, TrendingUp, TrendingDown, Minus, Users, Target, MessageSquare, ShieldAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { CompanyMetaLine, CompanyMetaLineSkeleton } from '@/components/companies/CompanyMetaLine'
import { getPublishedIntelForCompany, INTEL_TYPE_LABEL, type IntelType } from '@/lib/companies/company-intel'
import { getMemberConcentration, getDemandSignal, getIntelHealth } from '@/lib/companies/company-admin-view'
import { computeOutplacementPitchSignal } from '@/lib/companies/outplacement-signal'
import { isSuppressedCell } from '@/lib/admin/cell-suppression'
import type { RankedSkill } from '@/lib/companies/skills-extraction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NervousEmployeePanel } from '@/components/admin/NervousEmployeePanel'

export const maxDuration = 30

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const company = await prisma.company.findUnique({ where: { id }, select: { name: true } })
  return { title: company ? `${company.name} — Admin` : 'Company' }
}

const LEVEL_STYLE: Record<string, string> = {
  HIGH: 'bg-destructive/10 text-destructive',
  MEDIUM: 'bg-warning/10 text-warning',
  LOW: 'bg-muted text-muted-foreground',
}

export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  const companyRow = await prisma.company.findUnique({ where: { id } })
  if (!companyRow) notFound()

  // industry/sizeBand/hqMetro resolution is Suspense-isolated below (see
  // CompanyMetaLine) since it can be a real LLM call the first time anyone
  // views this company — everything else here only needs the row's
  // already-stored fields, so `company` is just an alias, not a wait.
  const company = companyRow

  const [latestSignal, publishedIntel, memberConcentration, demandSignal, outplacementSignal] = await Promise.all([
    prisma.companySignal.findFirst({ where: { companyId: id }, orderBy: { weekStartDate: 'desc' } }),
    getPublishedIntelForCompany(id),
    getMemberConcentration(id),
    getDemandSignal(id, company.canonicalNameNormalized),
    computeOutplacementPitchSignal(id),
  ])

  const intelHealth = await getIntelHealth(id, demandSignal.targetCount)

  const topSkills = ((latestSignal?.topSkillsRequested as unknown as RankedSkill[] | undefined) ?? []).slice(0, 10)
  const topFunctions = (latestSignal?.topFunctionsHiring as unknown as { function: string; count: number }[] | undefined) ?? []

  const rolesPast12wk = latestSignal ? latestSignal.openRolesTotal - latestSignal.rolesDelta12wk : 0
  const pct12wk = latestSignal && rolesPast12wk > 0 ? Math.round((latestSignal.rolesDelta12wk / rolesPast12wk) * 100) : null

  const TrajectoryIcon =
    latestSignal?.trajectory === 'growing' ? TrendingUp : latestSignal?.trajectory === 'contracting' ? TrendingDown : Minus

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 pb-12">
      <div>
        <Link href="/support/admin/companies" className="text-sm text-primary underline underline-offset-4">
          ← All companies
        </Link>
      </div>

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Building2 className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{company.name}</h1>
          <Suspense fallback={<CompanyMetaLineSkeleton />}>
            <CompanyMetaLine companyRow={companyRow} />
          </Suspense>
        </div>
      </div>

      {/* ── Outplacement pitch signal composite ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4" aria-hidden="true" />
            Outplacement pitch signal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_STYLE[outplacementSignal.level]}`}>
            {outplacementSignal.level}
          </span>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Postings trajectory</dt>
              <dd className="font-medium text-foreground">
                {outplacementSignal.trajectory ?? 'No signal yet'}
                {outplacementSignal.rolesDelta12wk !== null && ` (${outplacementSignal.rolesDelta12wk >= 0 ? '+' : ''}${outplacementSignal.rolesDelta12wk} roles / 12wk)`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current employer count</dt>
              <dd className="font-medium text-foreground">{outplacementSignal.currentEmployerCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Currently searching</dt>
              <dd className="font-medium text-foreground">
                {isSuppressedCell(outplacementSignal.currentlySearchingDisplay)
                  ? 'Insufficient data'
                  : `${outplacementSignal.currentlySearchingDisplay.count} members`}
              </dd>
            </div>
          </dl>
          {/* WARN component — explicitly rendered as "not available," never a
              fabricated number or a silently omitted row. Visually distinct
              (dashed border, muted icon) so it reads as "we don't have this
              yet," not as a smaller/quieter version of the real data above. */}
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">WARN filings: not available</p>
              <p className="text-xs text-muted-foreground">
                No WARN-filing monitoring agent exists yet. This composite is built from postings trajectory and
                member concentration only — it will incorporate real WARN filings once that data source exists,
                and this score should be read as a floor, not the full picture.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Composite score {outplacementSignal.compositeScore} — used only to sort the ranked company list.
          </p>
        </CardContent>
      </Card>

      {/* ── Hiring signal ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrajectoryIcon className="size-4" aria-hidden="true" />
            Hiring signal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestSignal ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                <span className="font-medium">Open roles: {latestSignal.openRolesTotal}</span>
                {latestSignal.openRolesDirectorPlus > 0 && ` (${latestSignal.openRolesDirectorPlus} at director level and above)`}
                {pct12wk !== null && (
                  <>
                    {' · '}
                    {pct12wk >= 0 ? `Up ${pct12wk}%` : `Down ${Math.abs(pct12wk)}%`} in 12 weeks
                  </>
                )}
              </p>
              {topFunctions.length > 0 && (
                <p className="text-sm text-muted-foreground">Hiring most in: {topFunctions.map((f) => f.function).join(', ')}</p>
              )}
              {latestSignal.medianPostingAgeDays !== null && (
                <p className="text-sm text-muted-foreground">Median posting age: {latestSignal.medianPostingAgeDays} days</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hiring signal yet — no active job board postings for this company.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Member concentration ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            Member concentration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Members who&apos;ve ever worked here</dt>
              <dd className="font-medium text-foreground">{memberConcentration.totalEverWorkedHere}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">List it as a current employer</dt>
              <dd className="font-medium text-foreground">{memberConcentration.currentEmployerCount}</dd>
            </div>
          </dl>
          {memberConcentration.byFunction.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">By function</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {memberConcentration.byFunction.map((f) => (
                  <span key={f.label} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {f.label} ({f.count})
                  </span>
                ))}
              </div>
            </div>
          )}
          {memberConcentration.bySeniority.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">By seniority</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {memberConcentration.bySeniority.map((s) => (
                  <span key={s.label} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {s.label} ({s.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Members from this company currently searching</p>
            <NervousEmployeePanel companyId={id} />
          </div>
        </CardContent>
      </Card>

      {/* ── Demand signal ── */}
      <Card>
        <CardHeader>
          <CardTitle>Demand signal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {demandSignal.latestOutcome ? (
            <p className="text-sm">
              <span className="font-medium">{demandSignal.latestOutcome.applications} applications</span> from
              members · {demandSignal.latestOutcome.responses} responses · {demandSignal.latestOutcome.interviews}{' '}
              interviews · {demandSignal.latestOutcome.offers} offers
              {demandSignal.latestOutcome.applications > 0 && (
                <>
                  {' '}
                  (response rate {Math.round((demandSignal.latestOutcome.responses / demandSignal.latestOutcome.applications) * 100)}%)
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No tracked applications to this company yet.</p>
          )}
          <p className="text-sm">
            <span className="font-medium">{demandSignal.targetCount} members</span> name this company as a target
            employer
            {demandSignal.targetRank !== null && (
              <> — ranked #{demandSignal.targetRank} of {demandSignal.totalNamedTargetCompanies} named targets.</>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Intel health ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" aria-hidden="true" />
            Intel health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Submitted / published / pending / removed</dt>
              <dd className="font-medium text-foreground">
                {intelHealth.totalSubmitted} / {intelHealth.published} / {intelHealth.pending} / {intelHealth.removed}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Helpful rate</dt>
              <dd className="font-medium text-foreground">
                {intelHealth.helpfulRatePct !== null ? `${intelHealth.helpfulRatePct}%` : 'No published intel yet'}
              </dd>
            </div>
          </dl>
          {intelHealth.hasCoverageGap && (
            <p className="rounded-lg border border-dashed border-warning/40 bg-warning/5 p-3 text-sm text-warning">
              Coverage gap — {demandSignal.targetCount} members target this company, but no intel has been
              published yet.
            </p>
          )}
          {publishedIntel.length > 0 && (
            <div className="space-y-2">
              {publishedIntel.slice(0, 5).map((intel) => (
                <div key={intel.id} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">{INTEL_TYPE_LABEL[intel.intelType as IntelType]}</p>
                  <p className="mt-1 text-sm">{intel.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Skills they hire for ── */}
      {topSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills they hire for</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {topSkills.map((s) => (
                <span key={s.term} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {s.term}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
