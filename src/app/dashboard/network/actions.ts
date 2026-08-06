'use server'

import { revalidatePath } from 'next/cache'
import type {
  ContactCategory,
  ContactWarmth,
  NetworkingAnxiety,
  NetworkComfortLevel,
  OutreachChannel,
  MarketResponseType,
  RelationshipTag,
} from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { parseLinkedInConnectionsCsv, normalizeContactKey } from '@/lib/network/csv-import'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'

const NETWORKING_LIST_TARGET = 25

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// The existing "networking list of 25" action-plan item predates the
// Support Network builder — this keeps that signal in sync so building the
// list here still counts, rather than asking for it twice.
async function markNetworkingListSubmittedIfThresholdMet(candidateId: string) {
  const [contactCount, candidate] = await Promise.all([
    prisma.supportNetworkContact.count({ where: { candidateId } }),
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { networkingListSubmittedAt: true } }),
  ])
  if (contactCount < NETWORKING_LIST_TARGET || candidate.networkingListSubmittedAt) return

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { networkingListSubmittedAt: new Date() },
  })
}

export type NetworkFormState = { error?: string; imported?: number } | undefined

export async function importConnectionsCsv(
  _prevState: NetworkFormState,
  formData: FormData
): Promise<NetworkFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose your LinkedIn Connections.csv file first.' }

  const text = await file.text()
  const contacts = parseLinkedInConnectionsCsv(text)
  if (contacts.length === 0) {
    return { error: "Couldn't find any connections in that file — make sure it's LinkedIn's Connections.csv export." }
  }

  const result = await prisma.supportNetworkContact.createMany({
    data: contacts.map((c) => ({
      candidateId: profile.id,
      name: c.name,
      company: c.company,
      title: c.title,
      email: c.email,
      source: 'CSV_IMPORT' as const,
      normalizedKey: normalizeContactKey(c.name, c.company),
    })),
    skipDuplicates: true,
  })

  await markNetworkingListSubmittedIfThresholdMet(profile.id)

  // Weekly Sprint credit only for genuinely new contacts — result.count is
  // the real inserted-row count after dedup, so re-uploading the same
  // export (or one with no new names) fires zero credit, not a re-award of
  // the same one-time flag markNetworkingListSubmittedIfThresholdMet uses.
  if (result.count > 0) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'NETWORKING_LIST' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'NETWORKING_LIST',
        text: 'Added new contacts to your networking list',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      }).catch((error) => console.error('Failed to auto-complete NETWORKING_LIST action:', error))
    }
  }

  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard')
  return { imported: result.count }
}

export async function updateContact(contactId: string, formData: FormData) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const category = formData.get('category') as ContactCategory | null
  const warmth = formData.get('warmth') as ContactWarmth | null
  const relationshipTags = formData.getAll('relationshipTags') as RelationshipTag[]
  const schoolName = (formData.get('schoolName') as string | null)?.trim() || null

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: {
      category: category || undefined,
      warmth: warmth || undefined,
      relationshipTags,
      // Only stored when SAME_SCHOOL is actually selected — a stray value
      // left over from an earlier save shouldn't linger once unchecked.
      schoolName: relationshipTags.includes('SAME_SCHOOL') ? schoolName : null,
    },
  })
  revalidatePath('/dashboard/network')
}

export async function deleteContact(contactId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.supportNetworkContact.deleteMany({ where: { id: contactId, candidateId: profile.id } })
  revalidatePath('/dashboard/network')
}

export async function setNetworkingConcerns(concerns: NetworkingAnxiety[]) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { networkingConcerns: concerns } })
  revalidatePath('/dashboard/network')
}

export async function setNetworkComfortLevel(level: NetworkComfortLevel) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { networkComfortLevel: level } })
  captureServerEvent(profile.id, 'network_comfort_answered', { comfortLevel: level })
  captureServerEvent(profile.id, 'network_page_unlocked')

  // One-time points award for answering the network comfort gate — mirrors
  // gigDirectoryUnlockBonusAt/privacyOpenedUpBonusAt.
  if (!profile.networkComfortBonusAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'NETWORK_COMFORT_CONFIRMED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'NETWORK_COMFORT_CONFIRMED',
        text: 'Answered the network comfort check-in',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { networkComfortBonusAt: new Date() },
      })
    }
  }

  revalidatePath('/dashboard/network')
}

export async function toggleNetworkConnectPreference(preference: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const current = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    select: { networkConnectPreferences: true },
  })
  const next = current.networkConnectPreferences.includes(preference)
    ? current.networkConnectPreferences.filter((p) => p !== preference)
    : [...current.networkConnectPreferences, preference]

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { networkConnectPreferences: next },
  })
  revalidatePath('/dashboard/network')
}

export async function dismissOutreachPlan() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { outreachPlanDismissedAt: new Date() },
  })
  revalidatePath('/dashboard/network')
}

export async function logOutreach(contactId: string | null, channel: OutreachChannel) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.outreachLog.create({ data: { candidateId: profile.id, contactId, channel } })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard')
}

// Interviews/offers aren't logged here — they're already tracked as real
// timestamps on JobPosting (marked from the Job Fit page). This covers only
// the external signals that have no existing tracking; aggregated into that
// week's Sunday Night Report when it generates.
export async function logMarketResponse(type: MarketResponseType) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.marketResponseLog.create({ data: { candidateId: profile.id, type } })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard')
}
