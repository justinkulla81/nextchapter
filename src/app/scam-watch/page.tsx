import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert, MailWarning, Link2, BellRing } from 'lucide-react'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'

export const metadata: Metadata = {
  ...canonical('/scam-watch'),
  title: 'Fake recruiter scam watch',
  description:
    'Fake recruiters and fake job offers target people who are job hunting. NextChapter checks recruiter emails in your connected Gmail and tells you within minutes when one looks fake.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Fake recruiter scam watch — NextChapter',
}

const CHECKS = [
  {
    icon: MailWarning,
    title: 'Who really sent it',
    body: "Does the sender's domain belong to the company the email says it's from? A recruiter for a real company writes from that company's domain, not from a lookalike or a random one.",
  },
  {
    icon: Link2,
    title: 'Where the links really go',
    body: 'A "book your interview" button can point anywhere. We read the actual destination and compare it to the company, its careers site and the scheduling tools employers commonly use.',
  },
  {
    icon: ShieldAlert,
    title: 'What it asks of you',
    body: 'Requests for ID numbers or bank details, anything involving your own money or a check, moving to a chat app, and pressure to act fast are the usual signs of a scam.',
  },
]

const STEPS = [
  { title: 'Connect Gmail, read-only', body: 'The same connection that tracks your job search. We never send, delete or change anything in your mailbox.' },
  { title: 'Vic checks new recruiter emails', body: 'Every few minutes, new recruiter and interview emails are compared against the signs above.' },
  { title: 'You hear about it right away', body: 'If one looks fake, Vic emails you what she found and what to do, before you book, reply or click.' },
]

export default function ScamWatchPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader />

      <main>
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">Scam watch</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-5xl">
              Fake recruiters go after people who are job hunting. Vic checks your inbox.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              When you are looking for work, every recruiter email feels like good news, and scammers know it. NextChapter
              looks at recruiter and interview emails in your connected Gmail and emails you within minutes when one looks
              fake, so you find out before you book the call or enter your details.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedLink
                href="/onboarding/desire"
                event="scam_watch_cta_clicked"
                properties={{ cta: 'hero_get_started', page: 'scam-watch' }}
                className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
              >
                Get free scam watch
              </TrackedLink>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Free for candidates. Needs a connected Gmail account.</p>
          </div>
        </section>

        <section className="bg-off-white py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-navy">What it looks at</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {CHECKS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border border-light-gray bg-white p-6">
                  <Icon className="size-5 text-brand" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-navy">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-navy">What it looks like</h2>
            <p className="mt-3 text-muted-foreground">
              An illustrative example, modeled on a real fake-recruiter email. The company and domains below are made up.
            </p>
            <div className="mt-6 space-y-4 rounded-xl border border-light-gray bg-off-white p-6 text-sm">
              <p className="font-semibold text-foreground">The email says: &ldquo;Interview with Acme Health. Time-sensitive: book your call now.&rdquo;</p>
              <ul className="list-inside list-disc space-y-1.5 text-foreground">
                <li>It came from <span className="font-medium">hiring-desk-team.org</span>, which isn&apos;t Acme Health&apos;s domain.</li>
                <li>The booking link goes to <span className="font-medium">web04-booking.org</span>, also not Acme Health&apos;s.</li>
                <li>It pushes you to act quickly.</li>
              </ul>
              <p className="flex items-start gap-2 font-semibold text-foreground">
                <BellRing className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                Vic emails you: &ldquo;Don&apos;t book anything yet. The Acme Health email looks fake.&rdquo;
              </p>
            </div>
          </div>
        </section>

        <section className="bg-off-white py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-navy">How it works</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-light-gray bg-white p-6">
                  <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step {i + 1}</span>
                  <h3 className="mt-1 font-semibold text-navy">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-navy">What it can&apos;t do</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
              <p>
                Scam watch is an early warning, not a guarantee. It can miss a well-made scam, and it can flag a real
                recruiter, especially one at a staffing firm or writing from a personal address. If you think a flag is
                wrong, tell us from your dashboard and we use that to improve it.
              </p>
              <p>
                It only sees mail in the Gmail account you connect. It keeps just the emails it flags (sender, subject and
                the reasons), never the full message, and you can disconnect Gmail at any time. More on how we handle data
                is on our{' '}
                <Link href="/security" className="text-primary underline underline-offset-4">security page</Link>.
              </p>
              <p>
                If you ever lose money to a job scam, report it at{' '}
                <a href="https://reportfraud.ftc.gov" className="text-primary underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                  reportfraud.ftc.gov
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter page="scam-watch" />
    </div>
  )
}
