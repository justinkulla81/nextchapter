import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'

export const metadata = {
  title: 'Security & Privacy — NextChapter',
  description: 'How NextChapter handles data, the employer/candidate boundary, subprocessors, retention, and our current state on SOC 2.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Security & Privacy — NextChapter',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold tracking-tight text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  )
}

// Partners Master Build Script §C3.3: "enterprise procurement will find
// this page before sales does... an honest current state on SOC 2 rather
// than silence." There is no real SOC 2 process underway for this product
// at this stage, so — per the same section's own logic ("silence reads
// worse than a roadmap") — the honest answer here is "not yet started,"
// stated plainly, rather than an invented "in progress, expected [date]."
export default function SecurityPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/employers" className="font-medium text-brand hover:text-navy">
              For Employers
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Security &amp; Privacy</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">Security &amp; Privacy</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          How we handle data, plainly stated.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This page exists because a procurement or legal reviewer will read it before a salesperson ever
          talks to them. Nothing here is aspirational marketing copy — it describes what the product
          actually does today.
        </p>

        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
          <span className="font-semibold">Current SOC 2 state: not yet started.</span> We are not going to
          publish a fabricated "in progress, expected [date]" — there is no audit underway right now. When
          we begin a formal observation window, this page will say so with a real date. Silence would be
          worse than this honesty; a guessed date would be worse still.
        </div>

        <Section title="The employer / candidate boundary">
          <p>
            <span className="font-semibold">
              An employer that buys outplacement seats will never see an individual candidate&apos;s
              activity, grade, or whether they used the product.
            </span>{' '}
            That boundary is in the contract, and every candidate is told about it directly.
          </p>
          <p>Enforced structurally, not by convention:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              The employer/candidate query layer computes aggregates from views that structurally cannot
              resolve to a person — there is no query path from the employer portal to an individual
              candidate row.
            </li>
            <li>Employer aggregates only render at a minimum cell size of 10 people.</li>
            <li>Numbers round to the nearest 5 below 50 seats, so month-over-month change can&apos;t isolate one person.</li>
            <li>Cohorts under 20 seats report on a quarterly cadence instead of live.</li>
            <li>
              An organization user can never determine whether anyone — including themselves — has a
              candidate account. No &quot;already registered&quot; errors, no search that returns a hit.
            </li>
            <li>
              The Market Reality Grade, component grades, and detections never leave the candidate and
              their coach — no recruiter, employer, or admin query returns them.
            </li>
          </ul>
        </Section>

        <Section title="Login is separated by portal">
          <p>
            Logging into an employer, recruiter, coach, or hiring-manager portal does not log you into the
            candidate product, even when the same person holds both roles. Someone who is both an HR buyer
            and quietly job-searching on the candidate side gets fully separated sessions.
          </p>
        </Section>

        <Section title="What we use today">
          <ul className="list-inside list-disc space-y-1.5">
            <li>Row-level access checks and role-scoped Postgres queries — every partner-facing query is written to select only what that role is permitted to see, not filtered after the fact.</li>
            <li>Server-only data-access modules for anything touching candidate identity, so a client component can never accidentally receive a row it shouldn&apos;t.</li>
            <li>Every individual-record view on a partner surface is logged with an actor and a reason.</li>
            <li>Recruiter access to a candidate is per-introduction and consent-based, revocable at any time — never a browsable database.</li>
          </ul>
        </Section>

        <Section title="Subprocessors">
          <p>Vendors that process data on our behalf today:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><span className="font-medium">Supabase</span> — database, authentication, and file storage.</li>
            <li><span className="font-medium">Vercel</span> — application hosting.</li>
            <li><span className="font-medium">Anthropic (Claude)</span> — powers scoring, summarization, and generated content within the product.</li>
            <li><span className="font-medium">Resend</span> — transactional and confirmation email delivery.</li>
            <li><span className="font-medium">PostHog</span> — product analytics.</li>
          </ul>
          <p className="text-muted-foreground">
            We do not sell candidate data, and we do not share individually identifiable candidate data
            with an employer client under any circumstance.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            A candidate&apos;s Dossier, references, and account are retained for as long as the account is
            active, and remain available to the candidate as a free alumni account after any employer
            contract ends. A candidate can request deletion of their account and underlying data at any
            time; employer-side contract and compliance records (which never contain job-search activity,
            assessment, or engagement detail) are retained per the applicable contract term for compliance
            purposes.
          </p>
        </Section>

        <Section title="Confidentiality for active job-seekers">
          <p>
            A member using Confidential Search Mode never appears on any employer surface, and requires
            explicit per-instance consent before a recruiter can see them at all.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Enterprise procurement, security review, or DPA requests — reach us through the{' '}
            <Link href="/employers#walkthrough" className="text-primary underline underline-offset-4">
              employer walkthrough form
            </Link>{' '}
            and mention security review in the timeline field.
          </p>
        </Section>
      </main>
    </div>
  )
}
