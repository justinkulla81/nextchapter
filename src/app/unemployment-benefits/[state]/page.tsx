import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { AuthorByline, formatContentDate } from '@/components/seo/AuthorByline'
import { STATE_UI, UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import type { Sourced, StateUI } from '@/lib/data/state-ui-types'
import { prisma } from '@/lib/prisma'
import { canonical } from '@/lib/seo/canonical'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { ALL_STATE_CODES, stateFromSlug, stateName, stateSlug } from '@/lib/seo/states'
import { getStateSummaries } from '@/lib/warn/layoff-pages'
import { jobCentersUrl, stateBoardsUrl } from '@/lib/workforce/directory'

// Facts are static; the daily refresh keeps the link to this state's layoff
// page and its list of workforce boards current.
export const revalidate = 86400
export const dynamicParams = false

export function generateStaticParams() {
  return ALL_STATE_CODES.map((c) => ({ state: stateSlug(c) }))
}

const usd = (n: number) => `$${n.toLocaleString()}`
/** "Texas Workforce Commission" → "the Texas Workforce Commission", for use mid-sentence. */
const withThe = (n: string) => (/^the\s/i.test(n) ? n : `the ${n}`)

function lead(name: string, ui: StateUI): string {
  const weeks = ui.maxWeeks.value
  const max = ui.maxWeeklyBenefit.value
  const asOf = ui.maxWeeklyBenefit.asOf ?? ui.maxWeeks.asOf
  const agency = ui.agencyName.value ? withThe(ui.agencyName.value) : `the ${name} unemployment agency`
  const first =
    weeks != null && max != null
      ? `In ${name}, unemployment benefits last up to ${weeks} weeks${ui.durationVaries.value ? ' (fewer when the state unemployment rate is low)' : ''} and pay up to ${usd(max)} a week${asOf ? ` (as of ${formatContentDate(asOf)})` : ''}.`
      : max != null
        ? `In ${name}, unemployment benefits pay up to ${usd(max)} a week${asOf ? ` (as of ${formatContentDate(asOf)})` : ''}; check with ${agency} for how many weeks you can receive.`
        : `Check with ${agency} for ${name}’s current weekly benefit amount and how many weeks you can receive.`
  const second =
    ui.waitingWeek.value === true
      ? `There is an unpaid waiting week, and you file with ${agency}.`
      : ui.waitingWeek.value === false
        ? `There is no unpaid waiting week, and you file with ${agency}.`
        : `You file with ${agency}.`
  return `${first} ${second}`
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const code = stateFromSlug(state)
  if (!code) return {}
  const name = stateName(code)
  return {
    title: `${name} unemployment benefits`,
    description: lead(name, STATE_UI[code]),
    ...canonical(`/unemployment-benefits/${state}`),
  }
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

function SourceLink({ fact }: { fact: Sourced<unknown> }) {
  if (!fact.source) return null
  return (
    <a href={fact.source} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
      source{fact.asOf ? `, ${formatContentDate(fact.asOf)}` : ''}
    </a>
  )
}

export default async function StateBenefitsPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = stateFromSlug(state)
  if (!code) notFound()
  const name = stateName(code)
  const ui = STATE_UI[code]
  const agency = ui.agencyName.value ? withThe(ui.agencyName.value) : `the ${name} unemployment agency`
  const check = `Check with ${agency}`

  const [layoffStates, boards] = await Promise.all([
    getStateSummaries().catch(() => []),
    prisma.workforceBoard
      .findMany({ where: { state: code }, select: { id: true, name: true, website: true, zip: true }, orderBy: { name: 'asc' } })
      .catch(() => []),
  ])
  const hasLayoffPage = layoffStates.some((s) => s.state === code)

  const rows: { label: string; value: React.ReactNode; fact?: Sourced<unknown> }[] = [
    { label: 'Maximum weekly benefit', value: ui.maxWeeklyBenefit.value != null ? usd(ui.maxWeeklyBenefit.value) : check, fact: ui.maxWeeklyBenefit },
    { label: 'Minimum weekly benefit', value: ui.minWeeklyBenefit.value != null ? usd(ui.minWeeklyBenefit.value) : check, fact: ui.minWeeklyBenefit },
    {
      label: 'Maximum weeks of benefits',
      value: ui.maxWeeks.value != null ? `${ui.maxWeeks.value} weeks${ui.durationNote ? ` (${ui.durationNote})` : ''}` : check,
      fact: ui.maxWeeks,
    },
    {
      label: 'Weeks depend on the state unemployment rate',
      value: ui.durationVaries.value == null ? check : ui.durationVaries.value ? 'Yes' : 'No',
      fact: ui.durationVaries,
    },
    { label: 'Unpaid waiting week', value: ui.waitingWeek.value == null ? check : ui.waitingWeek.value ? 'Yes' : 'No', fact: ui.waitingWeek },
    { label: 'Severance pay', value: ui.severance.value ?? check, fact: ui.severance },
    { label: 'Pay in lieu of notice', value: ui.payInLieuOfNotice.value ?? check, fact: ui.payInLieuOfNotice },
    { label: 'Work-search requirement', value: ui.workSearch.value ?? check, fact: ui.workSearch },
    {
      label: 'Extended benefits',
      value: ui.extendedBenefits.value == null ? check : ui.extendedBenefits.value === 'on' ? 'Available now' : 'Not available now',
      fact: ui.extendedBenefits,
    },
  ]

  // FAQ answers come only from the table's confirmed values.
  const faq: { q: string; a: string }[] = []
  if (ui.maxWeeklyBenefit.value != null)
    faq.push({ q: `What is the maximum unemployment benefit in ${name}?`, a: `${usd(ui.maxWeeklyBenefit.value)} a week${ui.maxWeeklyBenefit.asOf ? ` as of ${formatContentDate(ui.maxWeeklyBenefit.asOf)}` : ''}${ui.minWeeklyBenefit.value != null ? `; the minimum is ${usd(ui.minWeeklyBenefit.value)}` : ''}.` })
  if (ui.maxWeeks.value != null)
    faq.push({ q: `How many weeks of unemployment can you get in ${name}?`, a: `Up to ${ui.maxWeeks.value} weeks${ui.durationNote ? ` (${ui.durationNote})` : ''}.` })
  if (ui.waitingWeek.value != null)
    faq.push({ q: `Does ${name} have a waiting week for unemployment?`, a: ui.waitingWeek.value ? 'Yes. The first eligible week is an unpaid waiting week.' : 'No. There is no unpaid waiting week.' })
  if (ui.severance.value) faq.push({ q: `Does severance affect unemployment in ${name}?`, a: ui.severance.value })
  if (ui.fileUrl.value) faq.push({ q: `How do I file for unemployment in ${name}?`, a: `File an initial claim with ${agency} at ${ui.fileUrl.value}.` })

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Unemployment benefits', path: '/unemployment-benefits' }, { name, path: `/unemployment-benefits/${state}` }])} />
      {faq.length > 0 && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          }}
        />
      )}
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/unemployment-benefits" className="hover:text-foreground">Unemployment benefits</Link>
          <span aria-hidden> › </span>
          <span className="text-foreground">{name}</span>
        </nav>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{name} unemployment benefits</h1>
        <p className="mt-4 text-lg leading-relaxed text-foreground">{lead(name, ui)}</p>
        <AuthorByline updated={UI_LAST_VERIFIED} />
        <p className="mt-1 text-sm text-muted-foreground">Last verified {formatContentDate(UI_LAST_VERIFIED)} against official sources.</p>

        {ui.fileUrl.value && (
          <p className="mt-6">
            <TrackedLink
              href={ui.fileUrl.value}
              event="benefits_file_claim_clicked"
              properties={{ state: code }}
              className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
            >
              File a claim with {agency} →
            </TrackedLink>
          </p>
        )}

        <section aria-labelledby="facts" className="mt-10">
          <h2 id="facts" className={H2}>{name} benefits at a glance</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{name} unemployment insurance facts, with sources</caption>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="w-2/5 px-4 py-3 align-top font-medium text-navy">{r.label}</th>
                    <td className="px-4 py-3 align-top">
                      {r.value}
                      {r.fact && r.fact.value != null && <SourceLink fact={r.fact} />}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="px-4 py-3 align-top font-medium text-navy">How to file</th>
                  <td className="px-4 py-3 align-top">
                    {ui.fileUrl.value ? <a href={ui.fileUrl.value} target="_blank" rel="noopener noreferrer" className={LINK}>{agency}</a> : check}
                    <SourceLink fact={ui.fileUrl} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* ui.notes and per-fact notes are research notes for maintainers, not shown. */}
          <p className="mt-3 text-xs text-muted-foreground">
            Weekly amounts exclude dependents’ allowances. Severance, pay in lieu of notice and work-search entries dated
            January 1, 2023 come from the Department of Labor’s latest Comparison of State UI Laws, which reflects state law on
            that date; confirm them with {agency}.
          </p>
        </section>

        <section aria-labelledby="severance" className="mt-12">
          <h2 id="severance" className={H2}>Severance and unemployment in {name}</h2>
          <div className="mt-4 space-y-3 leading-relaxed">
            <p><span className="font-medium">Severance pay:</span> {ui.severance.value ?? `${check} before you sign a severance agreement.`}</p>
            <p><span className="font-medium">Pay in lieu of notice</span> (including WARN Act pay): {ui.payInLieuOfNotice.value ?? `${check}.`}</p>
            <p className="text-sm text-muted-foreground">
              File as soon as you are out of work even if you received severance. The agency decides how payments affect your
              claim, and most states pay only from the week you file.
            </p>
          </div>
        </section>

        <section aria-labelledby="boards" className="mt-12">
          <h2 id="boards" className={H2}>Local workforce boards in {name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Public workforce boards run American Job Centers, which offer free help with job search, training and benefits.
          </p>
          {boards.length > 0 ? (
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {boards.map((b) => (
                <li key={b.id}>
                  <a href={b.website ?? jobCentersUrl(b.zip, code)} target="_blank" rel="noopener noreferrer" className={LINK}>{b.name}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm">
              <a href={stateBoardsUrl(code)} target="_blank" rel="noopener noreferrer" className={LINK}>Find {name}’s workforce boards on CareerOneStop</a>
            </p>
          )}
        </section>

        <section aria-labelledby="professionals" className="mt-12 rounded-xl border border-border bg-off-white p-6">
          <h2 id="professionals" className="text-xl font-semibold tracking-tight text-navy">If you’re a laid-off professional</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            <li><Link href="/resources/unemployed" className={LINK}>You’re unemployed now: what actually works</Link></li>
            <li><Link href="/resources/cobra-aca" className={LINK}>Keeping health coverage: COBRA vs. the marketplace</Link></li>
            <li><Link href="/resources/bridge-income" className={LINK}>Bridge income while you search</Link></li>
            <li>
              {hasLayoffPage ? (
                <Link href={`/layoffs/${state}`} className={LINK}>{name} layoffs: recent WARN notices and local job centers</Link>
              ) : (
                <Link href="/layoffs" className={LINK}>The national layoff tracker</Link>
              )}
            </li>
          </ul>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Sources: U.S. Department of Labor, Significant Provisions of State Unemployment Insurance Laws and Comparison of State
          Unemployment Insurance Laws, the DOL Extended Benefits trigger notice, and {agency}. Where official sources disagree or
          a figure could not be confirmed, this page says to check with the agency rather than estimate. Rules change; the agency’s
          decision on your claim is what counts. See our <Link href="/editorial-standards" className="underline underline-offset-2">editorial standards</Link>.
        </p>
      </main>
      <PublicSiteFooter page="benefits" />
    </div>
  )
}
