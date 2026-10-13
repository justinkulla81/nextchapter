'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { durationBucketForWeeks, weeksUnemployed } from '@/lib/outcomes/duration-bucket'
import { payRetention } from '@/lib/outcomes/pay-retention'
import type { HireOutcomeType, HireSource } from '@prisma/client'

export type OutcomeFormState = { error?: string; saved?: boolean } | undefined

const OUTCOME_TYPES: HireOutcomeType[] = ['PERMANENT', 'INTERIM', 'FRACTIONAL', 'ADVISORY']
const SOURCES: HireSource[] = ['REFERRAL', 'NETWORK_CONVERSATION', 'ALUMNI_OR_MENTOR', 'RECRUITER', 'INBOUND_APPLICATION', 'OTHER']

function parsePay(raw: FormDataEntryValue | null): number | null | 'invalid' {
  const text = typeof raw === 'string' ? raw.replace(/[$,\s]/g, '') : ''
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) return 'invalid'
  return Math.round(n)
}

// Saves the last day worked. Weeks unemployed at enrollment and at hire are
// derived from this date, so it is the one intake fact the whole outcomes
// release depends on. Never guessed: left null unless the candidate says.
export async function saveLastJobEndedAt(_prev: OutcomeFormState, formData: FormData): Promise<OutcomeFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const raw = (formData.get('lastJobEndedAt') as string | null)?.trim()
  const date = raw ? new Date(raw) : null
  if (!date || Number.isNaN(date.getTime())) return { error: 'Enter the last day you worked, for example 2026-03-31.' }
  if (date.getTime() > Date.now()) return { error: 'That date is in the future. Enter your last day worked.' }

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { lastJobEndedAt: date } })
  const weeks = weeksUnemployed(date, new Date())
  captureServerEvent(profile.id, 'last_job_end_date_saved', { weeksUnemployed: weeks, bucket: durationBucketForWeeks(weeks) })
  revalidatePath('/dashboard/got-hired')
  return { saved: true }
}

// Records how a re-employment happened. Optional pay fields feed the pay
// retention guardrail; nothing here is used to score or label the candidate.
export async function recordHireOutcome(_prev: OutcomeFormState, formData: FormData): Promise<OutcomeFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const outcomeType = formData.get('outcomeType') as HireOutcomeType | null
  const source = formData.get('source') as HireSource | null
  const hiredRaw = (formData.get('hiredAt') as string | null)?.trim()
  const hiredAt = hiredRaw ? new Date(hiredRaw) : null

  if (!outcomeType || !OUTCOME_TYPES.includes(outcomeType)) return { error: 'Choose what kind of role this is.' }
  if (!source || !SOURCES.includes(source)) return { error: 'Choose how this came together.' }
  if (!hiredAt || Number.isNaN(hiredAt.getTime())) return { error: 'Enter your start date.' }

  const prior = parsePay(formData.get('priorBasePayUsd'))
  const next = parsePay(formData.get('newBasePayUsd'))
  if (prior === 'invalid' || next === 'invalid') return { error: 'Enter pay as a yearly dollar amount, or leave it blank.' }

  const levelRaw = formData.get('levelRetained') as string | null
  const levelRetained = levelRaw === 'yes' ? true : levelRaw === 'no' ? false : null

  const weeks = weeksUnemployed(profile.lastJobEndedAt, hiredAt)
  const bucket = durationBucketForWeeks(weeks)

  await prisma.hireOutcome.create({
    data: {
      candidateId: profile.id,
      outcomeType,
      source,
      hiredAt,
      weeksUnemployedAtHire: weeks,
      enrollmentBucket: bucket,
      priorBasePayUsd: prior,
      newBasePayUsd: next,
      levelRetained,
    },
  })

  const retention = payRetention(prior, next)
  captureServerEvent(profile.id, 'hire_outcome_recorded', {
    outcomeType,
    source,
    bucket,
    weeksUnemployedAtHire: weeks,
    hasPay: retention !== null,
    tookPayCut: retention?.tookCut ?? null,
    levelRetained,
  })

  revalidatePath('/dashboard/got-hired')
  return { saved: true }
}
