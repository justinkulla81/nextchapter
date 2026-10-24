import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { earlyCareerAudience, featureVisible } from '@/lib/early-career/audience'
import { loadEarlyCareerView } from '@/lib/early-career/data'
import { nextItem } from '@/lib/early-career/checklist'
import { formatPay } from '@/lib/early-career/pay'
import { isInWorkMember } from '@/lib/in-work/constants'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { EmptyNote, SectionBlock, SourceLine } from '@/components/candidate/Blocks'
import { EarlyCareerChecklist } from '@/components/dashboard/early-career/EarlyCareerChecklist'
import { EducationForm } from '@/components/dashboard/early-career/EducationForm'
import { GraduationPlan } from '@/components/dashboard/early-career/GraduationPlan'
import { MajorRolePicker } from '@/components/dashboard/early-career/MajorRolePicker'

export const metadata: Metadata = { title: 'Early career plan' }

export default async function EarlyCareerPage({ searchParams }: { searchParams: Promise<{ major?: string }> }) {
  const [profile, { major: majorParam }] = await Promise.all([getDashboardProfile(), searchParams])
  const audience = earlyCareerAudience(profile)

  if (!audience) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Early career plan"
          intro="This plan is for students, new grads and people up to five years in. Your profile says you have more experience than that, so your home page already has the plan for your stage."
          action={
            <ActionLink href="/dashboard/search-strategy" kind="primary" event="early_career_update_details_clicked" props={{ source: 'early_career_not_eligible' }}>
              Update my search details
            </ActionLink>
          }
        />
        <EmptyNote>If your years of experience are wrong, update them on your search page and the plan appears here.</EmptyNote>
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

  const sec = (id: string, title: string, children: React.ReactNode, why?: string) => (
    <div id={id} className="scroll-mt-4">
      <SectionBlock id={`${id}-h`} title={title} why={why}>
        {children}
      </SectionBlock>
    </div>
  )
  const stepsLeft = view.checklist.length - doneCount
  const firstSteps = sec(
    'checklist',
    next ? 'Your next steps' : 'Every step is done',
    <>
      <EarlyCareerChecklist rows={view.checklist} compact redesign />
      {stepsLeft > 3 && <SourceLine>{stepsLeft - 3} more steps are under “Show every step, roles, promotion and grad school”.</SourceLine>}
    </>,
    next ? 'Do them in any order. Each one is something an employer looks for.' : 'Nice work. Keep your school and pay range current.'
  )
  const school = sec(
    'education',
    'Your school',
    <EducationForm initial={view.education} />,
    'Employers hiring new grads filter by school, major and class year. Adding yours also connects you with alumni here.'
  )
  const payBlock = sec(
    'pay',
    newGrad ? 'Starting pay' : 'Market pay for your level',
    view.pay ? (
      <div className="space-y-1">
        <p className="text-2xl font-semibold text-ink tabular-nums">
          {formatPay(view.pay.p25)} to {formatPay(view.pay.p75)}
        </p>
        <SourceLine>
          Typical middle: {formatPay(view.pay.p50)}. {view.pay.note}
        </SourceLine>
      </div>
    ) : (
      <EmptyNote>
        We do not have enough posted {newGrad ? 'starting' : 'early-career'} salaries{view.primaryFunction ? ` in ${view.primaryFunction}` : ''} yet to give a fair range, and we will not show you senior pay instead because it would set the wrong bar. Check the pay on each job you save; many states require it in the posting.
      </EmptyNote>
    )
  )
  return (
    <div className="space-y-8">
      <PageHeader
        title={newGrad ? 'Your first job plan' : 'Your next step plan'}
        intro={`${
          newGrad
            ? 'Ten steps from résumé to first offer. No full-time experience yet is normal: internships, projects and coursework count.'
            : 'Two to five years in is when careers speed up or stall. These steps get you to senior or manager, here or somewhere new.'
        } ${doneCount} of ${view.checklist.length} done.`}
        action={
          next ? (
            <ActionLink href={next.href} kind="primary" event="early_career_next_step_clicked" props={{ audience, step: next.linkLabel, done: doneCount, total: view.checklist.length }}>
              Next: {next.linkLabel.toLowerCase()}
            </ActionLink>
          ) : undefined
        }
      />
      {firstSteps}
      {newGrad && <GraduationPlan graduation={view.education?.graduationYear ? new Date(Date.UTC(view.education.graduationYear, 4, 15)) : null} schoolName={view.education?.schoolName ?? null} />}
      {/* Once the school is saved it is a settled fact, so the form moves behind Show more. */}
      {!view.education && school}
      {/* New grads see the graduation plan first, so the starting pay moves behind Show more. */}
      {!newGrad && payBlock}
      <ShowMore page="early_career" label="Show every step, roles, promotion and grad school">
        {newGrad && payBlock}
        {sec('checklist-all', 'Every step', <EarlyCareerChecklist rows={view.checklist} redesign />)}
        {view.education && school}
        {featureVisible('major_role_picker', audience) &&
          sec('roles', 'Roles your major leads to', <MajorRolePicker majorKey={view.major?.key ?? null} roles={view.roles} targetRoleType={view.targetRoleType} />, 'The entry-level titles new grads with your major apply to most, with the skills each one asks for (from O*NET).')}
        {featureVisible('early_promotion_path', audience) &&
          sec(
            'promotion',
            'The path to senior or manager',
            <>
              <ol className="list-decimal space-y-2 pl-5 text-base text-ink">
                <li>
                  <span className="font-semibold">Ask what the next level does.</span> Ask your manager: “What would I need to show to be ready for the next level?” Write the answer down and close one gap at a time.
                </li>
                <li>
                  <span className="font-semibold">Own something end to end.</span> A project, a process or a client. Results with your name on them beat hours.
                </li>
                <li>
                  <span className="font-semibold">Find a sponsor.</span> Someone two levels up who will say your name when promotions are decided.
                </li>
                <li>
                  <span className="font-semibold">Know your market.</span> If the promotion is a year away and the market pays more now, a move can be the faster step.
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
            </>,
            'Most promotions in years two to five come from the same four moves.'
          )}
        {newGrad &&
          sec(
            'offer',
            'Your first offer',
            <>
              <ol className="list-decimal space-y-2 pl-5 text-base text-ink">
                <li>Thank them and ask for a few days to decide. That is normal, not rude.</li>
                <li>Compare the base pay with the starting pay above, then the whole package: bonus, 401(k) match, health costs, relocation, start date.</li>
                <li>Ask once, politely, for one thing: “Is there flexibility on the base?” or a signing bonus. The worst answer is no.</li>
                <li>Get the final offer in writing before you say yes or turn down anything else.</li>
              </ol>
              <Link href="/dashboard/find-my-job?tab=my_jobs" className="text-sm font-medium text-brand underline underline-offset-4">
                Practice the negotiation on a saved job
              </Link>
            </>
          )}
        {sec(
          'grad-school',
          'Grad school or work?',
          <ul className="list-disc space-y-2 pl-5 text-base text-ink">
            <li>
              <span className="font-semibold">Go now</span> when the job you want requires the degree (law, medicine, many clinical, research and counseling roles) or an employer will pay for it.
            </li>
            <li>
              <span className="font-semibold">Work first</span> for business, most tech and most analyst roles: two to five years of experience often makes an MBA or master’s worth more, and many employers help pay.
            </li>
            <li>
              <span className="font-semibold">Check the math.</span> Total cost plus the salary you give up, against the pay difference for the jobs you want.
            </li>
          </ul>,
          'A light guide. Decide on purpose, not by default.'
        )}
      </ShowMore>
    </div>
  )
}
