import Link from 'next/link'
import { ArrowRight, GraduationCap, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { effectiveJourney, effectiveStage, getStage } from '@/lib/journey/journey'
import { stageHelp } from '@/lib/higher-ed/lifecycle'
import { memberAudiences, memberCards, serviceSettingsFrom } from '@/lib/higher-ed/services'
import { myEnrollments } from '@/lib/higher-ed/programs'
import { Button } from '@/components/ui/button'
import { CareerStatusCard } from './CareerStatusCard'

// Home in a workforce program's participant preview (drawn in the candidate site's frame, src/components/higher-ed/SiteFrames.tsx),
// built to the candidate page contract (docs/candidate-redesign.md): one headline, one primary action, three sections.
//   1. One next step: the first thing that fits where the person is in their search.
//   2. Their program and status, in one card.
//   3. What the program gives them: its switched-on services, deduplicated, the ones for their stage first.
// Replaces, for this preview only, the long portal Home (status, program, news, stage panel, five tool cards, service cards),
// whose stage panel and service cards repeated each other ("Local jobs first" twice). College portals keep that Home.

// The stage items that are the same thing as a program service, so each shows once.
const SAME_AS_SERVICE: Record<string, string> = { localJobs: 'local_jobs', coaching: 'coaching', practice: 'reviews', programs: 'training', pivots: 'career_pivots' }

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const startWord = (d: Date) => `${new Date(d).getTime() > Date.now() ? 'starts' : 'started'} ${dayFmt.format(new Date(d))}`

export async function WorkforcePreviewHome({ ctx, base }: { ctx: WorkspaceContext; base: string }) {
  const inst = ctx.institution
  const brand = inst.programBrandName ?? inst.name
  const now = new Date()
  const [member, features, openFlag, upcoming, enrollments] = await Promise.all([
    ctx.memberId
      ? prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { firstName: true, affiliation: true, classYear: true, candidate: { select: { journey: true, journeyStage: true, currentJobStatus: true } } } })
      : null,
    prisma.institution.findUnique({ where: { id: inst.id }, select: { enabledFeatures: true } }),
    ctx.memberId ? prisma.transitionFlag.findUnique({ where: { openFlagMemberId: ctx.memberId }, select: { state: true } }) : null,
    prisma.cohort.count({ where: { program: { institutionId: inst.id, isActive: true }, startsAt: { gte: now } } }),
    ctx.memberId ? myEnrollments(ctx.memberId) : Promise.resolve([]),
  ])
  const stage = member?.candidate ? effectiveStage(member.candidate) : null
  const journey = member?.candidate ? effectiveJourney(member.candidate) : null
  const inTransition = !!openFlag && openFlag.state !== 'CLEARED'
  const forStage = stage === 'PAUSED' ? [] : stageHelp(stage, inst.slug, { hasPrograms: upcoming > 0, hasOfficeHours: false, hasEvents: false, hasJobs: false, journey, workforce: true })
  const services = memberCards(serviceSettingsFrom(features?.enabledFeatures, 'workforce'), member ? memberAudiences(member, now, inTransition) : null, 'workforce')
  const serviceKeys = new Set(services.map((s) => s.key))
  const goHref = (key: string) => `/i/${inst.slug}/go/${key}`

  // One list: stage items first (as the matching service when there is one, so opens are counted), then the other services.
  const list: { key: string; title: string; detail: string; href: string; forStage: boolean }[] = []
  for (const i of forStage) {
    const svc = SAME_AS_SERVICE[i.key]
    if (svc && serviceKeys.has(svc)) {
      const s = services.find((x) => x.key === svc)!
      list.push({ key: s.key, title: s.name, detail: s.pitch, href: goHref(s.key), forStage: true })
    } else {
      list.push({ key: i.key, title: i.title, detail: i.detail, href: i.href, forStage: true })
    }
  }
  for (const s of services) if (!list.some((l) => l.key === s.key)) list.push({ key: s.key, title: s.name, detail: s.pitch, href: goHref(s.key), forStage: false })
  const [next, ...rest] = list
  const program = enrollments.find((e) => e.status === 'ENROLLED' || e.status === 'APPLIED')

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{member?.firstName ? `Welcome back, ${member.firstName}` : `Welcome to ${brand}`}</h2>
        <p>
          <Link href={`${base}/groups`} className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success hover:underline">
            <Users className="size-3.5" aria-hidden="true" />
            Member of {brand}
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          {inst.name} is covering your search. Your search stays yours; {inst.name} sees only what you choose to share.
        </p>
        {!ctx.memberId && <p className="text-sm text-amber-900">You&apos;re previewing as a participant. There&apos;s no member record behind this preview.</p>}
      </header>

      {next && (
        <section aria-labelledby="next-step" className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Your next step</p>
          <h3 id="next-step" className="font-display text-2xl font-semibold text-ink">
            {next.title}
          </h3>
          <p className="text-sm">
            <span className="font-semibold">Why:</span> {stage ? `You’re ${getStage(stage).label.toLowerCase()}, and this` : 'This'} is what helps most now. {next.detail}
          </p>
          <Button nativeButton={false} render={<Link href={next.href} />}>
            Start
          </Button>
        </section>
      )}

      <section aria-labelledby="program-status" className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h3 id="program-status" className="text-base font-semibold">
          Your program and status
        </h3>
        {program ? (
          <Link href={`${base}/programs`} className="flex items-start gap-3 text-sm hover:text-primary">
            <GraduationCap className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="font-medium">{program.cohort.program.name}</span>
              <span className="block text-muted-foreground">
                {program.cohort.name} · {program.status === 'APPLIED' ? 'application in review' : startWord(program.cohort.startsAt)}
              </span>
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            No program yet.{' '}
            <Link href={`${base}/programs`} className="font-medium text-primary hover:underline">
              See {inst.name}&apos;s programs
            </Link>
          </p>
        )}
        <div className="border-t border-border pt-4">
          <CareerStatusCard slug={inst.slug} collegeName={inst.name} flag={openFlag?.state === 'CLEARED' ? null : (openFlag?.state ?? null)} quiet bare />
        </div>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="gives-you" className="space-y-3">
          <h3 id="gives-you" className="text-base font-semibold">
            What {brand} gives you
          </h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {rest.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="group flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/40">
                  <span>
                    <span className="block text-sm font-medium">
                      {i.title}
                      {i.forStage && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">For where you are</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{i.detail}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
