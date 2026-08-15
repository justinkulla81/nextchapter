import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { EmployerWaitlistForm } from '@/components/employer/EmployerWaitlistForm'
import { SampleCompliancePack } from '@/components/marketing/SampleCompliancePack'
import { SeatUtilizationMockup } from '@/components/marketing/SeatUtilizationMockup'
import { StructuredData } from '@/components/StructuredData'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const TIER_ROWS: { label: string; core: string; plus: string; premium: string }[] = [
  { label: 'Term', core: '6 months', plus: '6 months', premium: '12 months' },
  { label: 'Coaching', core: 'None', plus: '6 sessions', premium: '12 sessions + named coach, 48h response' },
  {
    label: 'Resume',
    core: 'Studio + ATS matrix',
    plus: '+ 1 human review',
    premium: '+ unlimited reviews, all versions',
  },
  { label: 'Executive Dossier', core: 'Full', plus: 'Full', premium: 'Full' },
  { label: 'Recruiter network', core: 'Standard intros', plus: 'Standard intros', premium: 'Dedicated recruiter relationship' },
  { label: 'Market Intelligence', core: 'Basic', plus: 'Standard', premium: 'Full' },
  { label: 'Interim & fractional', core: 'Boards + playbook', plus: '+ curated openings', premium: '+ direct introductions' },
  { label: 'Workspace', core: '—', plus: '—', premium: 'Private cohort space + coworking stipend' },
  { label: 'Premium plays', core: '—', plus: '—', premium: 'Board search, fractional CRO/CFO track, advisory placement' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Employers',
  serviceType: 'Outplacement',
  description:
    'Outplacement that produces proof, not a portal. Verified Executive Dossiers, real coaching, live reporting, and compliance documentation — 35-40% less than incumbent outplacement providers.',
  provider: { '@type': 'Organization', name: 'NextChapter' },
}

export default async function EmployersPage() {
  const [core, plus, premium] = await Promise.all([
    getCurrentPlan('outplacement_core'),
    getCurrentPlan('outplacement_plus'),
    getCurrentPlan('outplacement_premium'),
  ])

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <div className="order-2 flex shrink-0 items-center gap-4 sm:order-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              For candidates
            </Link>
            <Link
              href="/employer/login"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-brand hover:text-brand"
            >
              Log in
            </Link>
          </div>
          <nav className="order-3 flex min-w-0 basis-full items-center gap-1.5 text-sm sm:order-2 sm:basis-auto">
            <Link href="/for-organizations" className="shrink-0 font-medium text-brand hover:text-navy">
              For Organizations
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground sm:flex-none">For Employers</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        {/* Headline / subhead + booking form side by side, per §C3.3 — this
            is the revenue page, so the CTA stays visible without scrolling. */}
        <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">For Employers</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
              Outplacement that produces proof, not a portal.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Your departing employees get a verified Executive Dossier and real coaching. You get live
              reporting, compliance documentation, and a bill that&apos;s 35% smaller.
            </p>
          </div>

          <Card className="h-fit border-brand/20 bg-off-white" id="walkthrough">
            <CardContent className="pt-6">
              <EmployerWaitlistForm />
            </CardContent>
          </Card>
        </div>

        {/* The four beats, §C2.2 */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-navy">They leave with something durable.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Not a login that expires — a Dossier they keep, references that stay collected, and a
              membership that outlasts the contract.
            </p>
          </div>
          <div>
            <p className="font-semibold text-navy">You see what&apos;s actually happening.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Live seat utilization and aggregate outcomes, not a quarterly PDF.
            </p>
          </div>
          <div>
            <p className="font-semibold text-navy">Legal gets what it needs.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              An exportable compliance pack proving the severance obligation was met, per employee.
            </p>
          </div>
          <div>
            <p className="font-semibold text-navy">35–40% less than the incumbents.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We don&apos;t carry their offices or their sales structure.
            </p>
          </div>
        </div>

        {/* Trust boundary, stated in full — §C2.2 */}
        <div className="mt-10 rounded-xl border-2 border-navy/10 bg-navy px-6 py-6 text-white">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">
              You will never see an individual&apos;s activity, grade, or whether they used it.
            </span>{' '}
            That boundary is in the contract, and we tell your employees about it.
          </p>
        </div>

        {/* Real artifacts — sample compliance pack + reporting mockup */}
        <div className="mt-16" id="compliance-pack">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy">
            What legal and reporting actually see
          </h2>
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <SampleCompliancePack />
            <SeatUtilizationMockup />
          </div>
        </div>

        {/* Price transparency — §C3.4, live from PlanCatalogEntry, never hardcoded */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy">
            Published list prices — volume pricing available
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
            Incumbents hide pricing. We publish ours: 25+ seats −10% · 100+ seats −18% · 250+ seats −25%.
          </p>

          <div className="mt-8 overflow-x-auto rounded-xl border border-light-gray bg-white shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-light-gray bg-off-white px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase" />
                  <th className="border-b border-light-gray bg-off-white px-4 py-3 text-center text-sm font-semibold text-navy">
                    Core
                    <div className="mt-1 text-lg font-bold">{core ? formatUsd(core.priceCents) : '—'}</div>
                    <div className="text-xs font-normal text-muted-foreground">per seat</div>
                  </th>
                  <th className="border-b border-light-gray bg-off-white px-4 py-3 text-center text-sm font-semibold text-navy">
                    Plus
                    <div className="mt-1 text-lg font-bold">{plus ? formatUsd(plus.priceCents) : '—'}</div>
                    <div className="text-xs font-normal text-muted-foreground">per seat</div>
                  </th>
                  <th className="border-b border-light-gray bg-off-white px-4 py-3 text-center text-sm font-semibold text-navy">
                    Premium
                    <div className="mt-1 text-lg font-bold">{premium ? formatUsd(premium.priceCents) : '—'}</div>
                    <div className="text-xs font-normal text-muted-foreground">per seat</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {TIER_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-light-gray last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.core}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.plus}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            For reference: LHH executive outplacement typically runs $8,000–15,000+ per person; LHH/Randstad
            RiseSmart mid-level $3,500–7,000; virtual-first providers (Careerminds, INTOO) $1,000–3,000.
          </p>
        </div>

        {/* Objection handling */}
        <div className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-navy">Questions buyers actually ask</h2>
          <div className="mt-6 space-y-6">
            <div>
              <p className="font-semibold text-foreground">You&apos;re unproven — how do we know this works?</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Fair. We don&apos;t claim a placement rate or a speed number until we have real outcome data
                to back it — that&apos;s a deliberate choice, not an oversight. Run a paid pilot on one
                cohort alongside your current provider and compare utilization, participant feedback, and
                what you can see, side by side.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">We&apos;re running a global reduction — do you cover it?</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                If you&apos;re running a reduction across a dozen countries with local labor-law needs, an
                incumbent with global footprint is the right call. We&apos;re built for US-based
                reductions, where most of the market actually is.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">What about security and data handling?</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Read our full, honest answer — including our current state on SOC 2 — at{' '}
                <Link href="/security" className="text-primary underline underline-offset-4">
                  /security
                </Link>
                .
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">What happens to access at contract end?</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Nothing lapses for the individual. The Dossier, references, and a lasting alumni account
                stay theirs — see{' '}
                <Link href="/dossier" className="text-primary underline underline-offset-4">
                  /dossier
                </Link>
                . Your organization&apos;s reporting access ends per the contract term.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-xl bg-navy px-8 py-10 text-center text-white">
          <h2 className="text-2xl font-bold tracking-tight">Ready to see it on your own cohort?</h2>
          <p className="mx-auto mt-2 max-w-xl text-light-blue">
            Book a walkthrough — we&apos;ll show you the compliance pack and reporting live, on your seat
            count.
          </p>
          <Link
            href="#walkthrough"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-success px-6 py-3 text-sm font-medium text-white hover:bg-success-hover"
          >
            Book a walkthrough
          </Link>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/for-organizations" className="underline underline-offset-4">
            ← All organization types
          </Link>
          {' · '}
          <Link href="/pricing" className="underline underline-offset-4">
            Full pricing (candidate, membership, outplacement)
          </Link>
          {' · '}
          <Link href="/" className="underline underline-offset-4">
            NextChapter for candidates
          </Link>
        </div>
      </main>
    </div>
  )
}
