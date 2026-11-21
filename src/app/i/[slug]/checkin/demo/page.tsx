import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { CHECKIN_ANSWERS, isCheckInAnswer } from '@/lib/higher-ed/checkins'
import { demoCheckInMember } from '@/lib/higher-ed/demo-checkin'
import { isDemoAlumKey } from '@/lib/higher-ed/demo-alumni-shared'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { CheckInAnswerForm } from '@/components/higher-ed/CheckInAnswerForm'

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

// A demo's walkthrough of the college check-in (owner, 2026-11-21): the email exactly as the sample alum gets it, then
// the real answer page, details step and what the answer unlocks. Nothing is saved or sent. The alum is the one chosen
// in the demo bar's "Sample alum".
export default async function DemoCheckInPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ a?: string; alum?: string }> }) {
  const { slug } = await params
  const { a, alum } = await searchParams
  const demoAlum = isDemoAlumKey(alum) ? alum : null
  const demo = await demoCheckInMember(slug, demoAlum)
  if (!demo) notFound()
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: demo.institutionId }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  const accent = inst.accentColor ?? '#2e7d5b'
  const brand = inst.programBrandName ?? inst.name
  const first = demo.firstName ?? 'there'

  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <div role="note" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
        Demo: the check-in email and page a {inst.name} alum gets. Nothing here is saved or sent.
      </div>
      <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
        <section aria-labelledby="email-h" className="space-y-3">
          <h2 id="email-h" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            1. The email
          </h2>
          <div className="overflow-hidden rounded-lg border">
            <div className="space-y-0.5 border-b bg-muted/50 px-4 py-3 text-sm">
              <p>
                <span className="text-muted-foreground">From:</span> {brand}
              </p>
              <p>
                <span className="text-muted-foreground">Subject:</span> Has anything changed, {first}?
              </p>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm">
              <p>Hi {first},</p>
              <p>{inst.name} checks in with alumni once a year (and a few times in your first two years out). One click:</p>
              <ul className="space-y-1.5">
                {CHECKIN_ANSWERS.map((x) => (
                  <li key={x.key}>
                    <a href={`?a=${x.key}${demoAlum ? `&alum=${demoAlum}` : ''}#answer-h`} className="font-medium text-primary underline underline-offset-2">
                      {x.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">If you’re looking, {inst.name} has free help ready: a clear read on your job market, a plan, coaching and alumni who’ll take your call.</p>
            </div>
          </div>
        </section>
        <section aria-labelledby="answer-h" className="space-y-4">
          <h2 id="answer-h" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            2. The page their click opens
          </h2>
          <div className="space-y-6 rounded-lg border px-4 py-6">
            <div className="flex items-center gap-3">
              <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
              <p className="font-semibold">{brand}</p>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{first}, has anything changed?</h1>
            <CheckInAnswerForm key={a ?? 'none'} slug={slug} checkInId="demo" token="" answers={CHECKIN_ANSWERS} initial={isCheckInAnswer(a) ? a : null} college={inst.name} joined demo demoAlum={demoAlum} />
            <p className="text-xs text-muted-foreground">Only {inst.name} sees your answer.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
