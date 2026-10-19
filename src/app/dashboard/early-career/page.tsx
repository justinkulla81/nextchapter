import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { GraduationCap } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { AUDIENCE_LABEL, earlyCareerAudience, featureVisible } from '@/lib/early-career/audience'
import { loadEarlyCareerView } from '@/lib/early-career/data'
import { nextItem } from '@/lib/early-career/checklist'
import { formatPay } from '@/lib/early-career/pay'
import { isInWorkMember } from '@/lib/in-work/constants'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { EarlyCareerChecklist } from '@/components/dashboard/early-career/EarlyCareerChecklist'
import { EducationForm } from '@/components/dashboard/early-career/EducationForm'
import { MajorRolePicker } from '@/components/dashboard/early-career/MajorRolePicker'

export const metadata: Metadata = { title: 'Early career plan' }

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

export default async function EarlyCareerPage({ searchParams }: { searchParams: Promise<{ major?: string }> }) {
  const [profile, { major: majorParam }] = await Promise.all([getDashboardProfile(), searchParams])
  const audience = earlyCareerAudience(profile)

  if (!audience) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Early career plan</h1>
        <EmptyState
          icon={GraduationCap}
          title="This plan is for students, new grads and people up to five years in"
          description="Your profile says you have more experience than that, so your home page already has the plan for your stage. If your years of experience are wrong, update them on your search page."
          cta={{ label: 'Update my search details', href: '/dashboard/search-strategy' }}
        />
      </div>
    )
  }

  const view = await loadEarlyCareerView(profile, audience, majorParam)
  const next = nextItem(view.checklist)
  const doneCount = view.checklist.filter((r) => r.done).length
  after(() =>
    captureServerEvent(profile.id, 'early_career_plan_viewed', {
      audience,
      done: doneCount,
      total: view.checklist.length,
      major: view.major?.key ?? null,
      hasPay: !!view.pay,
    })
  )
  const newGrad = audience === 'NEW_GRAD'
  const employed = isInWorkMember(profile)

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{AUDIENCE_LABEL[audience]}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{newGrad ? 'Your first job plan' : 'Your next step plan'}</h1>
        <p className="text-muted-foreground">
          {newGrad
            ? 'Ten steps from résumé to first offer. No full-time experience yet is normal: internships, projects and coursework count.'
            : 'Two to five years in is when careers speed up or stall. These steps get you to senior or manager, here or somewhere new.'}
        </p>
        <p className="text-sm text-muted-foreground">
          {doneCount} of {view.checklist.length} done
        </p>
        {next && (
          <Button nativeButton={false} render={<Link href={next.href} />}>
            Next: {next.linkLabel.toLowerCase()}
          </Button>
        )}
      </div>

      <Section id="checklist" title={newGrad ? 'Your first job checklist' : 'Your growth checklist'}>
        <EarlyCareerChecklist rows={view.checklist} />
      </Section>

      {featureVisible('major_role_picker', audience) && (
        <Section id="roles" title="Roles your major leads to" intro="The entry-level titles new grads with your major apply to most, with the skills each one asks for (from O*NET).">
          <MajorRolePicker majorKey={view.major?.key ?? null} roles={view.roles} targetRoleType={view.targetRoleType} />
        </Section>
      )}

      {featureVisible('early_promotion_path', audience) && (
        <Section id="promotion" title="The path to senior or manager" intro="Most promotions in years two to five come from the same four moves.">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              <span className="font-medium">Ask what the next level does.</span> Ask your manager: “What would I need to show to be ready for the next level?”
              Write the answer down and close one gap at a time.
            </li>
            <li>
              <span className="font-medium">Own something end to end.</span> A project, a process or a client. Results with your name on them beat hours.
            </li>
            <li>
              <span className="font-medium">Find a sponsor.</span> Someone two levels up who will say your name when promotions are decided.
            </li>
            <li>
              <span className="font-medium">Know your market.</span> If the promotion is a year away and the market pays more now, a move can be the faster step.
            </li>
          </ol>
          {employed ? (
            <Link href="/dashboard/in-work" className="text-sm font-medium text-brand underline underline-offset-4">
              Plan your review and promotion case
            </Link>
          ) : (
            <Link href="/dashboard/find-my-job?seniority=EARLY_CAREER" className="text-sm font-medium text-brand underline underline-offset-4">
              See early-career jobs
            </Link>
          )}
        </Section>
      )}

      <Section id="pay" title={newGrad ? 'Starting pay' : 'Market pay for your level'}>
        {view.pay ? (
          <div className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight">
              {formatPay(view.pay.p25)} to {formatPay(view.pay.p75)}
            </p>
            <p className="text-sm text-muted-foreground">Typical middle: {formatPay(view.pay.p50)}.</p>
            <p className="text-sm text-muted-foreground">{view.pay.note}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            We don’t have enough posted {newGrad ? 'starting' : 'early-career'} salaries{view.primaryFunction ? ` in ${view.primaryFunction}` : ''} yet to give a fair
            range. We won’t show you senior pay instead, because it would set the wrong bar. Check the pay on each job you save; many states require it in the posting.
          </p>
        )}
      </Section>

      <MoreDetails summary="Your school, your first offer and grad school">
      <Section
        id="education"
        title="Your school"
        intro="Employers hiring new grads filter by school, major and class year. Adding yours also connects you with alumni here."
      >
        <Card>
          <CardContent className="pt-6">
            <EducationForm initial={view.education} />
          </CardContent>
        </Card>
      </Section>

      {newGrad && (
        <Section id="offer" title="Your first offer">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Thank them and ask for a few days to decide. That is normal, not rude.</li>
            <li>Compare the base pay with the starting pay above, then the whole package: bonus, 401(k) match, health costs, relocation, start date.</li>
            <li>Ask once, politely, for one thing: “Is there flexibility on the base?” or a signing bonus. The worst answer is no.</li>
            <li>Get the final offer in writing before you say yes or turn down anything else.</li>
          </ol>
          <Link href="/dashboard/find-my-job?tab=my_jobs" className="text-sm font-medium text-brand underline underline-offset-4">
            Practice the negotiation on a saved job
          </Link>
        </Section>
      )}

      <Section id="grad-school" title="Grad school or work?" intro="A light guide. Decide on purpose, not by default.">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <span className="font-medium">Go now</span> when the job you want requires the degree (law, medicine, many clinical, research and counseling roles) or an employer will pay for it.
          </li>
          <li>
            <span className="font-medium">Work first</span> for business, most tech and most analyst roles: two to five years of experience often makes an MBA or master’s worth more, and many employers help pay.
          </li>
          <li>
            <span className="font-medium">Check the math.</span> Total cost plus the salary you give up, against the pay difference for the jobs you want.
          </li>
        </ul>
      </Section>
      </MoreDetails>
    </div>
  )
}
