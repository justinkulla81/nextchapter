import { Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CompanyOpeningsList } from '@/components/companies/CompanyOpeningsList'
import { seniorityGroupLabel as groupLabel } from '@/lib/jobs/job-seniority'
import { loadCompanyHiringIndex, type CompanyHiringIndex, type HiringProfileView } from '@/lib/companies/hiring-index-data'
import { EMPLOYER_PAY_LEVEL_LABEL, MIN_EMPLOYER_PAY_SAMPLE } from '@/lib/pay/market-pay'
import { cn } from '@/lib/utils'
import { EmptyNote, PlainNote, SectionBlock, SourceLine } from '@/components/candidate/Blocks'

// The company hiring index card: what the company hires for, where, how much, how
// it pays against market, its layoffs, and every opening we have seen. Public
// business facts only, so the same card serves the candidate company page and the
// admin / CRM views.

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const pct = (n: number | null) => (n === null ? null : `${Math.round(n * 100)}%`)

const PAY_LEVEL_STYLE: Record<HiringProfileView['payLevel'], string> = {
  high: 'bg-success/10 text-success',
  in_line: 'bg-muted text-foreground',
  low: 'bg-warning/10 text-warning',
  insufficient: 'bg-muted text-muted-foreground',
}

function footprint(p: HiringProfileView): string {
  const remote = p.remoteShare && p.remoteShare > 0 ? ` · ${pct(p.remoteShare)} of roles remote` : ''
  switch (p.siteType) {
    case 'single_site':
      return `Single location${p.topLocations[0] ? ` — ${p.topLocations[0].location}` : ''}${remote}`
    case 'multi_site': {
      const states = p.states.slice(0, 8).join(', ') + (p.states.length > 8 ? ` and ${p.states.length - 8} more` : '')
      return `Multiple locations${p.states.length ? ` across ${p.states.length} ${p.states.length === 1 ? 'state' : 'states'} (${states})` : ''}${remote}`
    }
    case 'remote_only':
      return 'Remote roles only'
    default:
      return 'No location on its listings'
  }
}

function payLevelLine(p: HiringProfileView): string {
  if (p.payLevel === 'insufficient') {
    return `${p.payLevelSample} of its jobs ${p.payLevelSample === 1 ? 'posts' : 'post'} pay; we need at least ${MIN_EMPLOYER_PAY_SAMPLE} to judge.`
  }
  const diff = p.payLevelRatio !== null ? Math.round((p.payLevelRatio - 1) * 100) : 0
  const vs = diff === 0 ? 'at market' : `${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'} market`
  return `Median posted pay is ${vs}, across ${p.payLevelSample} jobs that post pay. In line means within 10%.`
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function ProfileFacts({ p }: { p: HiringProfileView }) {
  const levels = p.levelMix.slice(0, 4).map((l) => `${groupLabel(l.group) ?? l.group} ${l.count}`).join(', ')
  const seniorShare = [
    p.directorPlusShare !== null ? `${pct(p.directorPlusShare)} director and above` : null,
    p.vpPlusShare !== null && p.vpPlusShare > 0 ? `${pct(p.vpPlusShare)} VP and above` : null,
  ].filter(Boolean)
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Fact label="Employer pay level">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PAY_LEVEL_STYLE[p.payLevel])}>
          {EMPLOYER_PAY_LEVEL_LABEL[p.payLevel]}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{payLevelLine(p)}</span>
      </Fact>
      <Fact label="Openings">
        {p.openNow.toLocaleString('en-US')} open now · {p.opened90d.toLocaleString('en-US')} opened in the last 90 days ·{' '}
        {p.opened12mo.toLocaleString('en-US')} in the last 12 months
        {p.firstSeenAt && <span className="block text-xs text-muted-foreground">{p.totalSeen.toLocaleString('en-US')} tracked since {monthYear(p.firstSeenAt)}</span>}
      </Fact>
      <Fact label="Hiring for">
        {p.topFunctions.length > 0 ? p.topFunctions.map((f) => `${f.function} (${f.count})`).join(', ') : 'Function not clear from titles'}
        {levels && <span className="block text-xs text-muted-foreground">{levels}{seniorShare.length ? ` — ${seniorShare.join(', ')}` : ''}</span>}
      </Fact>
      <Fact label="Locations">{footprint(p)}</Fact>
      <Fact label="Industry">{p.industry ?? 'Not classified yet'}</Fact>
      <Fact label="Layoffs (last 12 months)">
        {p.warnFilings12mo > 0
          ? `${p.warnFilings12mo} WARN ${p.warnFilings12mo === 1 ? 'filing' : 'filings'}${p.warnEmployees12mo > 0 ? `, ${p.warnEmployees12mo.toLocaleString('en-US')} employees` : ''}`
          : 'No WARN filings'}
        {p.layoffNews12mo > 0 && ` · ${p.layoffNews12mo} layoff news ${p.layoffNews12mo === 1 ? 'mention' : 'mentions'}`}
        {p.lastWarnAt && p.warnFilings12mo === 0 && <span className="block text-xs text-muted-foreground">Last WARN filing {monthYear(p.lastWarnAt)}</span>}
      </Fact>
    </dl>
  )
}

// Current vs past (job-status.ts): how many of its openings are open, closed by the
// employer, or aged out; how long they stay up; how often roles come back.
function LifecycleLine({ stats, redesign = false }: { stats: NonNullable<CompanyHiringIndex['lifecycle']>; redesign?: boolean }) {
  const n = (x: number) => x.toLocaleString('en-US')
  const parts = [
    `${n(stats.open)} open`,
    `${n(stats.closed)} closed by the employer`,
    `${n(stats.expired)} no longer listed (aged out)`,
    stats.medianDaysOpen !== null ? `median ${stats.medianDaysOpen} days open before closing` : null,
    stats.repostedRoles > 0 ? `${n(stats.repostedRoles)} ${stats.repostedRoles === 1 ? 'role' : 'roles'} posted more than once (${n(stats.reposts)} reposts)` : 'no roles reposted',
  ].filter(Boolean)
  if (redesign) return <PlainNote className="text-muted-foreground">{parts.join(', ')}.</PlainNote>
  return <p className="text-sm text-muted-foreground">{parts.join(' · ')}</p>
}

const WHY = 'Every opening we have seen here, and how its pay compares with the market.'

function RFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-base font-semibold text-ink">{label}</dt>
      <dd className="text-base text-ink">{children}</dd>
    </div>
  )
}

// The redesigned profile: one verdict on pay with its reason, then plain facts. No badges.
function ProfileFactsRedesign({ p }: { p: HiringProfileView }) {
  const levels = p.levelMix.slice(0, 4).map((l) => `${groupLabel(l.group) ?? l.group} ${l.count}`).join(', ')
  const seniorShare = [
    p.directorPlusShare !== null ? `${pct(p.directorPlusShare)} director and above` : null,
    p.vpPlusShare !== null && p.vpPlusShare > 0 ? `${pct(p.vpPlusShare)} VP and above` : null,
  ].filter(Boolean)
  return (
    <div className="space-y-6">
      <PlainNote>
        <span className="font-semibold">{EMPLOYER_PAY_LEVEL_LABEL[p.payLevel]}.</span> {payLevelLine(p)}
      </PlainNote>
      <dl className="grid gap-5 sm:grid-cols-2">
        <RFact label="Openings">
          {p.openNow.toLocaleString('en-US')} open now, {p.opened90d.toLocaleString('en-US')} opened in the last 90 days and {p.opened12mo.toLocaleString('en-US')} in the last 12 months.
          {p.firstSeenAt && <span className="block text-sm text-muted-foreground">{p.totalSeen.toLocaleString('en-US')} tracked since {monthYear(p.firstSeenAt)}.</span>}
        </RFact>
        <RFact label="Hiring for">
          {p.topFunctions.length > 0 ? p.topFunctions.map((f) => `${f.function} (${f.count})`).join(', ') : 'Function not clear from titles'}
          {levels && <span className="block text-sm text-muted-foreground">{levels}{seniorShare.length ? `. ${seniorShare.join(', ')}.` : ''}</span>}
        </RFact>
        <RFact label="Locations">{footprint(p)}</RFact>
        <RFact label="Industry">{p.industry ?? 'Not classified yet'}</RFact>
        <RFact label="Layoffs in the last 12 months">
          {p.warnFilings12mo > 0
            ? `${p.warnFilings12mo} WARN ${p.warnFilings12mo === 1 ? 'filing' : 'filings'}${p.warnEmployees12mo > 0 ? `, ${p.warnEmployees12mo.toLocaleString('en-US')} employees` : ''}`
            : 'No WARN filings'}
          {p.layoffNews12mo > 0 && `, and ${p.layoffNews12mo} layoff news ${p.layoffNews12mo === 1 ? 'mention' : 'mentions'}`}.
          {p.lastWarnAt && p.warnFilings12mo === 0 && <span className="block text-sm text-muted-foreground">Last WARN filing {monthYear(p.lastWarnAt)}.</span>}
        </RFact>
      </dl>
    </div>
  )
}

export function CompanyHiringIndexView({ companyId, viewer, data, redesign = false }: { companyId: string; viewer: 'candidate' | 'admin' | 'crm'; data: CompanyHiringIndex; redesign?: boolean }) {
  const hasAnything = data.profile || data.openTotal > 0 || data.pastTotal > 0
  if (redesign) {
    return (
      <SectionBlock id="hiring-h" title="Hiring history and pay" why={WHY}>
        {!hasAnything ? (
          <EmptyNote>We have not seen any job openings from this company yet. Its hiring history starts with the first one we find.</EmptyNote>
        ) : (
          <div className="space-y-6">
            {data.profile ? <ProfileFactsRedesign p={data.profile} /> : <EmptyNote>The hiring profile is computed overnight, so check back tomorrow.</EmptyNote>}
            {data.lifecycle && <LifecycleLine stats={data.lifecycle} redesign />}
            <CompanyOpeningsList
              companyId={companyId}
              viewer={viewer}
              open={data.open}
              past={data.past}
              openTotal={data.openTotal}
              pastTotal={data.pastTotal}
              redesign
            />
            <SourceLine>
              Market pay compares a job&apos;s posted midpoint with salaries posted for the same function and seniority, adjusted for the state. A market figure on a job that posts no pay is our
              estimate, not the employer&apos;s.
            </SourceLine>
          </div>
        )}
      </SectionBlock>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="size-4" aria-hidden="true" />
          Hiring history and pay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasAnything ? (
          <p className="text-sm text-muted-foreground">
            We haven&apos;t seen any job openings from this company yet. Its hiring history starts with the first one we find.
          </p>
        ) : (
          <>
            {data.profile ? (
              <ProfileFacts p={data.profile} />
            ) : (
              <p className="text-sm text-muted-foreground">The hiring profile is computed overnight; check back tomorrow.</p>
            )}
            {data.lifecycle && <LifecycleLine stats={data.lifecycle} />}
            <CompanyOpeningsList
              companyId={companyId}
              viewer={viewer}
              open={data.open}
              past={data.past}
              openTotal={data.openTotal}
              pastTotal={data.pastTotal}
            />
            <p className="text-xs text-muted-foreground">
              Market pay compares a job&apos;s posted midpoint with salaries posted for the same function and seniority,
              adjusted for the state. A market figure on a job that posts no pay is our estimate, not the employer&apos;s.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Loads and renders the card; a failed read shows a plain message instead of breaking the page. */
export async function CompanyHiringIndex({ companyId, viewer, redesign = false }: { companyId: string; viewer: 'candidate' | 'admin' | 'crm'; redesign?: boolean }) {
  let data: CompanyHiringIndex
  try {
    data = await loadCompanyHiringIndex(companyId)
  } catch (error) {
    console.error('Could not load company hiring index', companyId, error)
    if (redesign) {
      return (
        <SectionBlock id="hiring-h" title="Hiring history and pay" why={WHY}>
          <EmptyNote>We could not load this company&apos;s hiring history just now. Refresh the page to try again.</EmptyNote>
        </SectionBlock>
      )
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-4" aria-hidden="true" />
            Hiring history and pay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">We couldn&apos;t load this company&apos;s hiring history just now. Refresh the page to try again.</p>
        </CardContent>
      </Card>
    )
  }
  return <CompanyHiringIndexView companyId={companyId} viewer={viewer} data={data} redesign={redesign} />
}

export function CompanyHiringIndexSkeleton({ redesign = false }: { redesign?: boolean }) {
  if (redesign) {
    return (
      <SectionBlock id="hiring-h" title="Hiring history and pay" why={WHY}>
        <div className="space-y-3" aria-busy="true" aria-label="Loading hiring history">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </SectionBlock>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="size-4" aria-hidden="true" />
          Hiring history and pay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3" aria-busy="true" aria-label="Loading hiring history">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  )
}
