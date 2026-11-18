// Workforce Hub › Referrals (the organization sends a need to a partner and follows the answer) and Partner Hub › Referrals (the partner
// answers). A referral is about a need: a rounded group size at most, never a name.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { ecoKindLabel } from '@/lib/workforce/ecosystem'
import { canAnswer, canFinish, canSendReferral, canWithdraw, referralStatusLabel, referralText } from '@/lib/workforce/partner-referrals'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { StatTile } from './StatTile'
import { AnswerReferralForm, CloseReferralButtons, CopyReferral, SendReferralForm } from './ReferralForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : null)

export async function WfReferrals({ ctx }: Props) {
  const slug = ctx.institution.slug
  const org = ctx.institution.programBrandName ?? ctx.institution.name
  const limit = institutionEntitlements({ plan: ctx.institution.plan }).referralLimit
  const [referrals, partners, cohorts, offerings] = await Promise.all([
    prisma.partnerReferral.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, message: true, cohortName: true, offeringTitle: true, people: true, dueDate: true, status: true, answerNote: true, answeredAt: true, createdAt: true, partner: { select: { name: true, kind: true } } },
    }),
    prisma.ecosystemPartner.findMany({ where: { institutionId: ctx.institution.id, status: { not: 'DECLINED' } }, orderBy: { name: 'asc' }, take: 300, select: { id: true, name: true } }),
    prisma.talentCohort.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { name: 'asc' }, take: 50, select: { id: true, name: true } }),
    prisma.trainingOffering.findMany({ where: { institutionId: ctx.institution.id, status: 'ACTIVE' }, orderBy: { title: 'asc' }, take: 100, select: { id: true, title: true } }),
  ])
  const room = canSendReferral(limit, referrals.length)
  const count = (s: string) => referrals.filter((r) => r.status === s).length
  const edit = !ctx.readOnly
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Hand a need to the right partner and follow the answer: “take about 40 operations managers into this cohort”, “host a hiring event for long-term unemployed”. A referral is about a need, never a named person. The partner answers in their Partner Hub.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Sent" value={referrals.length} />
        <StatTile label="Waiting for an answer" value={count('SENT')} />
        <StatTile label="Accepted" value={count('ACCEPTED')} />
        <StatTile label="Done" value={count('DONE')} />
      </div>
      {edit &&
        (room.allowed ? (
          <details className="rounded-lg border border-border bg-card p-4" open={referrals.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-primary">Send a referral</summary>
            <div className="pt-3"><SendReferralForm slug={slug} partners={partners} cohorts={cohorts} offerings={offerings} /></div>
          </details>
        ) : (
          <LockedFeature feature="partnerReferrals" slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} compact />
        ))}
      {referrals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No referrals yet. Send the first one to a college, a job center or a nonprofit.</p>
      ) : (
        <ul className="space-y-3">
          {referrals.map((r) => (
            <li key={r.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[`To ${r.partner.name} (${ecoKindLabel(r.partner.kind)})`, r.cohortName ? `Group: ${r.cohortName}` : null, r.people ? `About ${r.people} people` : null, r.offeringTitle ? `Training: ${r.offeringTitle}` : null, r.dueDate ? `By ${day(r.dueDate)}` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{referralStatusLabel(r.status)}</span>
              </div>
              {r.answerNote && <p className="rounded-md bg-muted/50 p-2 text-sm"><span className="font-medium">{r.partner.name}:</span> {r.answerNote}</p>}
              {edit && (
                <div className="flex flex-wrap items-center gap-3">
                  {r.status === 'SENT' && <CopyReferral name={r.partner.name} text={referralText({ from: org, partner: r.partner.name, title: r.title, people: r.people, cohort: r.cohortName, offering: r.offeringTitle, due: day(r.dueDate), message: r.message })} />}
                  <CloseReferralButtons slug={slug} id={r.id} canDone={canFinish(r.status)} canWithdraw={canWithdraw(r.status)} title={r.title} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The Partner Hub's Referrals: what the organization has asked my partner, and my answers. */
export async function PartnerReferrals({ ctx }: Props) {
  const ids = ctx.partnerIds ?? []
  const org = ctx.institution.programBrandName ?? ctx.institution.name
  const referrals = ids.length
    ? await prisma.partnerReferral.findMany({
        where: { institutionId: ctx.institution.id, partnerId: { in: ids }, status: { not: 'WITHDRAWN' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, title: true, message: true, cohortName: true, offeringTitle: true, people: true, dueDate: true, status: true, answerNote: true, createdAt: true },
      })
    : []
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">What {org} has asked of your organization. A referral is about a need, not a named person. Accept with what you can offer, or decline with a reason so they can ask someone else.</p>
      {referrals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No referrals yet. {org} sends them here when a need fits what you offer.</p>
      ) : (
        <ul className="space-y-3">
          {referrals.map((r) => (
            <li key={r.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.cohortName ? `Group: ${r.cohortName}` : null, r.people ? `About ${r.people} people` : null, r.offeringTitle ? `Training: ${r.offeringTitle}` : null, r.dueDate ? `By ${day(r.dueDate)}` : null, `Sent ${day(r.createdAt)}`].filter(Boolean).join(' · ')}
                  </p>
                  {r.message && <p className="whitespace-pre-line text-sm text-muted-foreground">{r.message}</p>}
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{referralStatusLabel(r.status)}</span>
              </div>
              {r.answerNote && <p className="rounded-md bg-muted/50 p-2 text-sm">Your answer: {r.answerNote}</p>}
              {canAnswer(r.status) && !ctx.readOnly && <AnswerReferralForm slug={ctx.institution.slug} id={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
