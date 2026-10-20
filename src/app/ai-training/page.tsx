import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { SITE_URL } from '@/lib/reports'
import { canonical } from '@/lib/seo/canonical'

const TITLE = 'AI training for colleges, workforce boards and employers'
const DESCRIPTION =
  'NextChapter, the leading job transition platform, measures the AI-skill gap for the people you serve and builds the short courses that close it, for the budgets and grants that already pay for training.'

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | NextChapter` },
  description: DESCRIPTION,
  ...canonical('/ai-training'),
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/ai-training`, type: 'website' },
}

const BUILD = [
  { t: 'Gap analysis', d: 'For your alumni, participants or employees: which AI skills the jobs in their functions ask for and which are missing from their profiles. Counts only, never names, once at least 10 people are in view.' },
  { t: 'Curriculum', d: 'Short courses mapped to the 24 AI skills employers actually name in postings, in three tracks: using AI in your work, leading AI adoption, and building AI systems. Each has outcomes, practice work and an assessment.' },
  { t: 'Proof that travels', d: 'Work samples that go on a résumé and count as evidence in a member’s profile, so a certificate is backed by something a hiring manager can read.' },
  { t: 'Job search alongside', d: 'Learners get the same job-matching, coaching and employer introductions as everyone on the platform, so training leads somewhere.' },
]

const WHO = [
  { t: 'Colleges', d: 'Continuing-ed, executive education and alumni career services. A certificate for mid-career alumni and local employers that your faculty can teach or co-brand, built to your catalog and credit rules.', money: 'Career services and alumni budgets, continuing-ed revenue, Workforce Pell for state-approved programs.' },
  { t: 'Workforce boards and American Job Centers', d: 'Training for dislocated professionals and managers, the group formula programs rarely reach, with participant-level outcomes you can report.', money: 'WIOA career and training services once a program is on the state’s eligible training list, dislocated worker grants, state and DOL AI-workforce grants.' },
  { t: 'Employers', d: 'AI skills for people leaving the company, through outplacement, and for current employees, through Learning.', money: 'Outplacement and learning-and-development budgets.' },
]

const MODELS = [
  { t: 'Course development', d: 'You commission a course or certificate. We design and build it to your standards, and you own the program and run it. Fixed scope, quoted per program.' },
  { t: 'Grant partner', d: 'You apply for a grant or contract that names AI reskilling for white-collar workers. We are the named training and reemployment provider inside your application, as a subrecipient or vendor.' },
  { t: 'Cohort license', d: 'We run the platform and the courses for a cohort of your people, priced per participant for the length of the program.' },
]

export default function AiTrainingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: TITLE,
    url: `${SITE_URL}/ai-training`,
    description: DESCRIPTION,
    provider: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
    audience: { '@type': 'Audience', audienceType: 'Colleges, workforce boards, American Job Centers and employers' },
  }
  return (
    <div className="flex flex-1 flex-col bg-white">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">For colleges, workforce boards and employers</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy text-balance sm:text-4xl">AI training that closes the gap employers are hiring for</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          NextChapter, the leading job transition platform, measures which AI skills the people you serve are missing and builds the short courses that close the gap. We work with the
          career services, workforce and training budgets you already have.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <TrackedLink
            href="/contact?as=organization"
            event="ai_training_cta_clicked"
            properties={{ cta: 'hero_talk', placement: 'hero' }}
            className="inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95"
          >
            Talk about a program
          </TrackedLink>
          <Link href="/ai-skills" className="inline-flex items-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted">
            See the market data
          </Link>
        </div>

        <section className="mt-14" aria-labelledby="why">
          <h2 id="why" className="text-xl font-bold tracking-tight text-navy">Why now</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground/85">
            <li>85% of 2026 seniors use AI, but only 28% say their program built it in, and fewer than 30% of graduates had substantial AI training (Handshake, NACE and ZipRecruiter surveys, via the White Collar Employment Report).</li>
            <li>Postings that ask for AI skills advertise more pay in nearly every function we can measure, even comparing like with like. <Link href="/ai-skills" className="underline underline-offset-4">The numbers, by function.</Link></li>
            <li>Public retraining is small next to the need: the federal Dislocated Worker program served about 187,000 people in its latest year, and about one in five received training (<Link href="/reports/latest" className="underline underline-offset-4">White Collar Employment Report</Link>).</li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="what">
          <h2 id="what" className="text-xl font-bold tracking-tight text-navy">What we build</h2>
          <dl className="mt-4 space-y-4">
            {BUILD.map((b) => (
              <div key={b.t}>
                <dt className="text-sm font-semibold text-foreground">{b.t}</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">{b.d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12" aria-labelledby="who">
          <h2 id="who" className="text-xl font-bold tracking-tight text-navy">Who it is for, and what pays for it</h2>
          <div className="mt-4 space-y-5">
            {WHO.map((w) => (
              <div key={w.t} className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">{w.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.d}</p>
                <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Typical funding:</span> {w.money}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Grants are awarded to the colleges, boards and states that apply, and approval rules differ by state.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="models">
          <h2 id="models" className="text-xl font-bold tracking-tight text-navy">How we work together</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {MODELS.map((m) => (
              <div key={m.t}>
                <h3 className="text-sm font-semibold text-foreground">{m.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-muted/30 p-6" aria-labelledby="start">
          <h2 id="start" className="text-lg font-bold tracking-tight text-navy">Start with the gap</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Tell us who you serve. We will show what the jobs in their functions ask for in AI skills and sketch the course that fits your program, your funding and your timeline.
          </p>
          <div className="mt-4">
            <TrackedLink
              href="/contact?as=organization"
              event="ai_training_cta_clicked"
              properties={{ cta: 'closing_talk', placement: 'closing' }}
              className="inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95"
            >
              Talk about a program
            </TrackedLink>
          </div>
        </section>
      </main>
      <PublicSiteFooter page="ai-training" />
    </div>
  )
}
