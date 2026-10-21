import type { Metadata } from 'next'
import Link from 'next/link'
import { EmployerWaitlistForm } from '@/components/employer/EmployerWaitlistForm'
import { SampleCompliancePack } from '@/components/marketing/SampleCompliancePack'
import { SeatUtilizationMockup } from '@/components/marketing/SeatUtilizationMockup'
import { ActionBand, AudienceSection, AudienceShell, Disclosure } from '@/components/organizations/AudienceShell'
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

export const metadata: Metadata = {
  title: 'Outplacement That Relaunches Careers',
  description:
    'The leading job transition platform for white-collar workers. Outplacement that produces proof, not a portal. Verified Executive Dossiers, real coaching, live reporting, and compliance documentation — an estimated 35-40% less than typical incumbent outplacement pricing.',
  alternates: { canonical: '/outplacement' },
  openGraph: {
    title: 'Outplacement That Relaunches Careers — NextChapter',
    description:
      'Verified Executive Dossiers, real coaching, live reporting, and compliance documentation — an estimated 35-40% less than typical incumbent outplacement pricing.',
    url: 'https://launchyournextchapter.com/outplacement',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Outplacement',
  serviceType: 'Outplacement',
  description:
    'The leading job transition platform for white-collar workers. Outplacement that produces proof, not a portal. Verified Executive Dossiers, real coaching, live reporting, and compliance documentation — an estimated 35-40% less than typical incumbent outplacement pricing.',
  provider: { '@type': 'Organization', name: 'NextChapter' },
}

// Was at /employers before this was untangled from the separate Talent
// ("hire our candidates") product, which now has its own real page at
// /talent — see /talent/page.tsx and the AUDIENCE_TABS 'talent' entry.
// /employers now redirects here (see /employers/page.tsx).
const BEATS = [
  {
    lead: 'They leave with something durable.',
    body: 'Not a login that expires: a Dossier they keep, references that stay collected, and a membership that outlasts the contract.',
  },
  { lead: 'You see what’s actually happening.', body: 'Live seat utilization and aggregate outcomes, not a quarterly PDF.' },
  { lead: 'Legal gets what it needs.', body: 'An exportable compliance pack proving the severance obligation was met, per employee.' },
  { lead: 'An estimated 35–40% less than the incumbents.', body: 'We don’t carry their offices or their sales structure.' },
]

const QUESTIONS = [
  {
    q: 'You’re unproven. How do we know this works?',
    a: 'Fair. We don’t claim a placement rate or a speed number until we have real outcome data to back it. Run a paid pilot on one cohort alongside your current provider and compare utilization, participant feedback, and what you can see, side by side.',
  },
  {
    q: 'We’re running a global reduction. Do you cover it?',
    a: 'If you’re running a reduction across a dozen countries with local labor-law needs, an incumbent with a global footprint is the right call. We’re built for US-based reductions, where most of the market actually is.',
  },
  {
    q: 'What happens to access at contract end?',
    a: 'Nothing lapses for the individual. The Dossier, references and a lasting alumni account stay theirs. Your company’s reporting access ends per the contract term.',
  },
]

export default async function OutplacementPage() {
  const [core, plus, premium] = await Promise.all([
    getCurrentPlan('outplacement_core'),
    getCurrentPlan('outplacement_plus'),
    getCurrentPlan('outplacement_premium'),
  ])

  return (
    <>
      <StructuredData data={jsonLd} />
      <AudienceShell
        page="outplacement"
        eyebrow="For outplacement and HR"
        headline="Outplacement that produces proof, not a portal."
        subhead="Your departing employees get a verified Executive Dossier and real coaching. You get live reporting, compliance documentation, and an estimated 35% smaller bill."
        primary={{ label: 'Book a walkthrough', href: '#walkthrough' }}
        primaryNote="We show the compliance pack and reporting live, on your seat count."
        loginHref="/employer/login"
        footerLinks={[
          { href: '/pricing', label: 'Full pricing' },
          { href: '/vs', label: 'Compare providers' },
          { href: '/rfp-template', label: 'RFP template' },
          { href: '/insights', label: 'Insights' },
        ]}
      >
        <AudienceSection title="What you get">
          <div className="grid gap-6 sm:grid-cols-2">
            {BEATS.map((b) => (
              <div key={b.lead}>
                <p className="font-semibold">{b.lead}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed">
            <span className="font-semibold">You will never see an individual&apos;s activity, grade, or whether they used it.</span>{' '}
            That boundary is in the contract, and we tell your employees about it.
          </p>
        </AudienceSection>

        <AudienceSection title="Show more" className="space-y-3">
          <Disclosure id="compliance-pack" title="What legal and reporting actually see">
            <div className="grid gap-10 lg:grid-cols-2">
              <SampleCompliancePack />
              <SeatUtilizationMockup />
            </div>
          </Disclosure>

          <Disclosure title="Published list prices, with volume pricing">
            <p className="mb-4 text-sm text-muted-foreground">
              Incumbents hide pricing. We publish ours: 25+ seats −10% · 100+ seats −18% · 250+ seats −25%.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border bg-muted/40 px-4 py-3" />
                    {[
                      ['Core', core],
                      ['Plus', plus],
                      ['Premium', premium],
                    ].map(([label, plan]) => (
                      <th key={label as string} className="border-b border-border bg-muted/40 px-4 py-3 text-center font-semibold">
                        {label as string}
                        <div className="mt-1 text-lg font-bold">
                          {plan ? formatUsd((plan as { priceCents: number }).priceCents) : '—'}
                        </div>
                        <div className="text-xs font-normal text-muted-foreground">per seat</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIER_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{row.core}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{row.plus}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{row.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              For reference, industry estimates (not vendor quotes): LHH executive outplacement typically runs $8,000–15,000+ per person;
              LHH/Randstad RiseSmart mid-level $3,500–7,000; virtual-first providers (Careerminds, INTOO) $1,000–3,000. Running a
              large-scale reduction or a multi-year contract? We&apos;ll work out a custom quote with you directly.
            </p>
          </Disclosure>

          <Disclosure title="Questions buyers actually ask">
            <div className="space-y-5">
              {QUESTIONS.map((q) => (
                <div key={q.q}>
                  <p className="font-semibold">{q.q}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{q.a}</p>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Security and data handling, including our current SOC 2 state:{' '}
                <Link href="/security" className="text-brand underline underline-offset-4">/security</Link>. What stays with the person at contract end:{' '}
                <Link href="/dossier" className="text-brand underline underline-offset-4">/dossier</Link>.
              </p>
            </div>
          </Disclosure>

          <Disclosure title="The labor market your cohorts are entering">
            <p className="text-sm text-muted-foreground">
              Read our monthly{' '}
              <Link href="/reports/latest" className="text-brand underline underline-offset-4">White Collar Employment Report</Link>{' '}
              and the{' '}
              <Link href="/reports/white-collar-index" className="text-brand underline underline-offset-4">White-Collar Long-Search Index</Link>.
            </p>
          </Disclosure>
        </AudienceSection>

        <ActionBand id="walkthrough" title="Book a walkthrough">
          <EmployerWaitlistForm />
        </ActionBand>
      </AudienceShell>
    </>
  )
}
