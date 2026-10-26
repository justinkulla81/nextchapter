import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices, inferJourney } from '@/lib/leads/infer-journey'
import { searchLabel } from '@/lib/leads/job-alerts'
import { layoffWatchLabel } from '@/lib/leads/layoff-alerts'

export const metadata: Metadata = { title: 'Job alerts confirmed', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

// After the confirm click: alerts are on, and one question that sets up the free profile. The first choice is our
// guess from the search words (or an earlier answer); the others are the situations most people pick. No résumé needed.
export default async function JobAlertsConfirmedPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const lead = t
    ? await prisma.homepageLead
        .findUnique({ where: { unsubscribeToken: t }, select: { kind: true, searchQ: true, searchLoc: true, searchRemote: true, journeySlug: true, confirmedAt: true } })
        .catch(() => null)
    : null
  const ok = lead && (lead.kind === 'job_alert' || lead.kind === 'layoff_alert' || lead.kind === 'deadline_reminders') && lead.confirmedAt
  const suggested = ok ? lead.journeySlug || inferJourney({ q: lead.searchQ }).slug : 'thinking-about-a-move'
  const layoff = ok && lead.kind === 'layoff_alert'
  const deadlines = ok && lead.kind === 'deadline_reminders'
  const choices = journeyChoices(suggested).map((s) => getPersona(s)).filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)

  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />
      <div className="mx-auto w-full max-w-xl px-6 py-14 text-center">
        {ok ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-navy">You&apos;re in.</h1>
            <p className="mt-3 text-muted-foreground">
              {deadlines ? (
                <>We&apos;ll email you a reminder as each deadline after your last day comes up. Dates are a guide: confirm the exact date on your own paperwork.</>
              ) : (
                <>We&apos;ll email you {layoff ? 'new layoff notices for' : 'new jobs for'} <span className="font-medium text-foreground">{layoff ? layoffWatchLabel(lead) : searchLabel(lead)}</span>, at most once a day and only when there is something new.</>
              )}
            </p>
            <h2 className="mt-10 text-xl font-semibold text-navy">Which sounds most like you?</h2>
            <p className="mt-1 text-sm text-muted-foreground">One tap sets up your free profile so these jobs come back ranked for you. No résumé needed to start.</p>
            <div className="mt-5 flex flex-col gap-3">
              {choices.map((p, i) => (
                <Link
                  key={p.slug}
                  href={`/api/job-alerts/journey/${encodeURIComponent(t!)}?p=${p.slug}`}
                  className={i === 0 ? 'rounded-full bg-action px-5 py-3 font-semibold text-action-foreground hover:brightness-95' : 'rounded-full border border-border bg-white px-5 py-3 font-medium text-foreground hover:bg-off-white'}
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <p className="mt-6 text-sm">
              <Link href="/jobs" className="text-brand underline underline-offset-4">
                Or keep browsing jobs
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-navy">That link did not work.</h1>
            <p className="mt-3 text-muted-foreground">It may have expired. Save your search again and we will send a new link.</p>
            <p className="mt-6">
              <Link href="/jobs" className="text-brand underline underline-offset-4">
                Back to jobs
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
