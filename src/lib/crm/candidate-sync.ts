import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeEmail } from '@/lib/crm/sync-matching'
import { captureServerEvent } from '@/lib/posthog/server'

const MEMBERSHIP_PIPELINE_KEY = 'candidate_membership'

export interface CandidateSyncResult {
  personId: string
  personCreated: boolean
  opportunityCreated: boolean
  opportunityAdvanced: boolean
}

/**
 * Mirrors one real candidate into the CRM as a CrmPerson, and makes sure
 * they have a membership-upgrade opportunity that reflects their real
 * MembershipSubscription status.
 *
 * A CrmPerson is not exclusively a candidate — the same person can be a BD
 * contact, an investor, etc. — so this only ever adds the JOB_SEEKER role
 * and the membership pipeline on top of whatever else is already on the
 * record; it never replaces roles or touches unrelated opportunities.
 *
 * Returns null for sample/system/test candidates and for a candidate with
 * neither a name nor a resolvable email — nothing real to file a CRM row
 * under.
 */
export async function syncCandidateToCrm(candidateId: string): Promise<CandidateSyncResult | null> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      isSampleData: true,
      isSystemAccount: true,
      membershipSubscription: { select: { status: true } },
    },
  })
  if (!candidate || candidate.isSampleData || candidate.isSystemAccount) return null

  // Real email lives in Supabase auth, not on CandidateProfile itself.
  const { data } = await createAdminClient().auth.admin.getUserById(candidate.userId)
  const email = normalizeEmail(data.user?.email)
  const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim()
  if (!fullName && !email) return null

  let person = await prisma.crmPerson.findFirst({ where: { candidateId: candidate.id, deletedAt: null } })
  if (!person && email) {
    person = await prisma.crmPerson.findFirst({ where: { email, deletedAt: null } })
  }

  let personCreated = false
  if (!person) {
    person = await prisma.crmPerson.create({
      data: {
        fullName: fullName || email || 'Unnamed candidate',
        firstName: candidate.firstName ?? null,
        lastName: candidate.lastName ?? null,
        email,
        emails: email ? [email] : [],
        candidateId: candidate.id,
        roles: ['JOB_SEEKER'],
        goals: ['MEMBERSHIP_UPGRADE'],
      },
    })
    personCreated = true
  } else {
    const patch: { candidateId?: string; roles?: { push: 'JOB_SEEKER' }; goals?: { push: 'MEMBERSHIP_UPGRADE' } } = {}
    if (!person.candidateId) patch.candidateId = candidate.id
    if (!person.roles.includes('JOB_SEEKER')) patch.roles = { push: 'JOB_SEEKER' }
    if (!person.goals.includes('MEMBERSHIP_UPGRADE')) patch.goals = { push: 'MEMBERSHIP_UPGRADE' }
    if (Object.keys(patch).length > 0) {
      person = await prisma.crmPerson.update({ where: { id: person.id }, data: patch })
    }
  }

  const pipeline = await prisma.crmPipeline.findUniqueOrThrow({
    where: { key: MEMBERSHIP_PIPELINE_KEY },
    select: { id: true, stages: { select: { id: true, key: true, isWon: true, isLost: true } } },
  })
  const stage = (key: string) => pipeline.stages.find((s) => s.key === key)!

  const status = candidate.membershipSubscription?.status ?? null
  const startingStage = status === 'ACTIVE' ? stage('won') : status ? stage('dormant') : stage('identified')

  const existingOpp = await prisma.crmOpportunity.findFirst({
    where: { pipelineId: pipeline.id, primaryPersonId: person.id },
    select: { id: true, stageId: true },
  })

  let opportunityCreated = false
  let opportunityAdvanced = false

  if (!existingOpp) {
    await prisma.crmOpportunity.create({
      data: {
        pipelineId: pipeline.id,
        stageId: startingStage.id,
        primaryPersonId: person.id,
        title: `${person.fullName} — membership`,
        outcome: startingStage.isWon ? 'WON' : startingStage.isLost ? 'LOST' : 'OPEN',
        closedAt: startingStage.isWon || startingStage.isLost ? new Date() : null,
      },
    })
    opportunityCreated = true
  } else {
    // Only ever move the stage on an objective fact (a real subscription
    // state), and never backwards over a stage the admin set by hand while
    // actually working the deal — a nightly re-sync must not fight a
    // manual judgment call.
    const currentKey = pipeline.stages.find((s) => s.id === existingOpp.stageId)?.key
    let target: typeof startingStage | null = null
    if (status === 'ACTIVE' && currentKey !== 'won') target = stage('won')
    else if ((status === 'LAPSED' || status === 'CANCELLED') && currentKey === 'won') target = stage('dormant')

    if (target) {
      await prisma.crmOpportunity.update({
        where: { id: existingOpp.id },
        data: {
          stageId: target.id,
          outcome: target.isWon ? 'WON' : target.isLost ? 'LOST' : 'OPEN',
          closedAt: target.isWon || target.isLost ? new Date() : null,
        },
      })
      await prisma.crmActivity.create({
        data: {
          type: 'STAGE_CHANGED', direction: 'INTERNAL', opportunityId: existingOpp.id, personId: person.id,
          subject: `Membership status changed → ${target.key}`, isAutoLogged: true,
        },
      })
      opportunityAdvanced = true
    }
  }

  captureServerEvent('system', 'crm_candidate_synced', { candidateId, personId: person.id, personCreated, opportunityCreated, opportunityAdvanced })
  return { personId: person.id, personCreated, opportunityCreated, opportunityAdvanced }
}
