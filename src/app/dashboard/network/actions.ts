'use server'

import { revalidatePath } from 'next/cache'
import type {
  ContactWarmth,
  NetworkingAnxiety,
  NetworkComfortLevel,
  OutreachChannel,
  MarketResponseType,
  RelationshipTag,
  Prisma,
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

export type NetworkFormState =
  | { error?: string; imported?: number; updated?: number; skippedRemoved?: number }
  | undefined

const FILLABLE_FIELDS = ['company', 'title', 'email', 'linkedinUrl'] as const

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

  // Re-uploading the same export (or a refreshed one) must never resurrect
  // someone the candidate deliberately removed, and should only fill in
  // blanks on people already on the list — never overwrite a field the
  // candidate already has a value for. skipDuplicates alone can't express
  // either of those, so this fetches every existing row up front and
  // decides create/update/skip per contact in memory instead.
  const existing = await prisma.supportNetworkContact.findMany({
    where: { candidateId: profile.id },
    select: {
      id: true,
      name: true,
      normalizedKey: true,
      removedAt: true,
      company: true,
      title: true,
      email: true,
      linkedinUrl: true,
      connectedAt: true,
    },
  })
  const existingByKey = new Map(existing.filter((e) => e.normalizedKey).map((e) => [e.normalizedKey as string, e]))
  // Name-only fallback index — the primary key is name+company, but company
  // is exactly one of the fields this import is meant to fill in. A contact
  // added with no company on file would otherwise never match a later CSV
  // row that does have their company, since the keys ("name|" vs.
  // "name|acme") differ — this "fill in blanks" step would then silently
  // create a duplicate instead of completing the existing row.
  const existingByName = new Map<string, (typeof existing)[number][]>()
  for (const e of existing) {
    const nameKey = e.name.trim().toLowerCase()
    const bucket = existingByName.get(nameKey)
    if (bucket) bucket.push(e)
    else existingByName.set(nameKey, [e])
  }

  const toCreate: Prisma.SupportNetworkContactCreateManyInput[] = []
  const updates: { id: string; data: Record<string, string | Date> }[] = []
  let skippedRemoved = 0

  for (const c of contacts) {
    const key = normalizeContactKey(c.name, c.company)
    let match = existingByKey.get(key)

    if (!match) {
      // Only fall back when the name is unambiguous (exactly one existing
      // contact with it) and that contact's company is blank — otherwise
      // this could silently merge two different people who share a name.
      const sameName = existingByName.get(c.name.trim().toLowerCase())
      if (sameName?.length === 1 && !sameName[0].company) {
        match = sameName[0]
      }
    }

    if (match) {
      if (match.removedAt) {
        skippedRemoved++
        continue
      }
      const fresh: Record<string, string | null> = { company: c.company, title: c.title, email: c.email, linkedinUrl: c.linkedinUrl }
      const fill: Record<string, string | Date> = {}
      for (const field of FILLABLE_FIELDS) {
        if (!match[field] && fresh[field]) fill[field] = fresh[field] as string
      }
      // Real LinkedIn connection date, not the CSV-upload date — only ever
      // filled in from a LinkedIn export, never guessed at, so an existing
      // row keeps whatever it already has.
      if (!match.connectedAt && c.connectedAt) fill.connectedAt = c.connectedAt
      // Matched via the name-only fallback — refresh normalizedKey to the
      // strict name+company key so future imports match it directly too.
      if (match.normalizedKey !== key) fill.normalizedKey = key
      if (Object.keys(fill).length > 0) updates.push({ id: match.id, data: fill })
      continue
    }

    toCreate.push({
      candidateId: profile.id,
      name: c.name,
      company: c.company,
      title: c.title,
      email: c.email,
      linkedinUrl: c.linkedinUrl,
      connectedAt: c.connectedAt,
      source: 'CSV_IMPORT' as const,
      normalizedKey: key,
    })
  }

  const created = toCreate.length > 0 ? await prisma.supportNetworkContact.createMany({ data: toCreate }) : { count: 0 }
  if (updates.length > 0) {
    await prisma.$transaction(updates.map((u) => prisma.supportNetworkContact.update({ where: { id: u.id }, data: u.data })))
  }

  await markNetworkingListSubmittedIfThresholdMet(profile.id)

  // Weekly Sprint credit only for genuinely new contacts — re-uploading the
  // same export (or one with no new names) fires zero credit, not a
  // re-award of the same one-time flag
  // markNetworkingListSubmittedIfThresholdMet uses.
  if (created.count > 0) {
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
  revalidatePath('/dashboard/network/contacts')
  revalidatePath('/dashboard')
  return { imported: created.count, updated: updates.length, skippedRemoved }
}

export async function updateContact(contactId: string, formData: FormData) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const warmth = formData.get('warmth') as ContactWarmth | null
  const relationshipTags = formData.getAll('relationshipTags') as RelationshipTag[]
  const name = (formData.get('name') as string | null)?.trim()
  const company = (formData.get('company') as string | null)?.trim() || null
  const title = (formData.get('title') as string | null)?.trim() || null
  const email = (formData.get('email') as string | null)?.trim() || null
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const linkedinUrl = (formData.get('linkedinUrl') as string | null)?.trim() || null

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: {
      warmth: warmth || undefined,
      relationshipTags,
      ...(name ? { name } : {}),
      company,
      title,
      email,
      phone,
      linkedinUrl,
    },
  })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
}

export async function toggleContactPriority(contactId: string, isPriority: boolean) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: { isPriority },
  })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
}

// Soft delete — sets removedAt instead of actually deleting the row, so a
// later LinkedIn re-import can tell "removed on purpose" apart from "never
// imported" and skip resurrecting this person (see importConnectionsCsv).
// The row is filtered out of the main directory and surfaced on its own
// Removed Contacts page instead.
export async function deleteContact(contactId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: { removedAt: new Date() },
  })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
}

// Undo for the above — just clears removedAt on the same row. Used both by
// the in-page "Undo" toast right after a removal and by the Restore button
// on the Removed Contacts page.
export async function restoreContact(contactId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: { removedAt: null },
  })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
  revalidatePath('/dashboard/network/contacts/removed')
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
  // gigDirectoryUnlockBonusAt/privacyOpenedUpBonusAt. The completion flag
  // itself is set unconditionally (not nested inside the sprint-exists
  // check) — this used to only get recorded when a current-week sprint
  // happened to already exist, which silently dropped the flag forever for
  // anyone who answered in the gap between a week rolling over and that
  // week's auto-assign cron actually running. The points credit is still
  // genuinely best-effort (no sprint to log them against means no points
  // this specific time), but "did you answer this, ever" must never depend
  // on that timing.
  if (!profile.networkComfortBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { networkComfortBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'NETWORK_COMFORT_CONFIRMED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'NETWORK_COMFORT_CONFIRMED',
        text: 'Answered the network comfort check-in',
        points: effort.points,
        estimatedMinutes: effort.minutes,
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

// Resets the "new backchannel matches" counter — same pattern as
// communityLastViewedAt/markWatchlistPageViewed: a visit to this page is
// what "seen" means, no per-match acknowledgment needed.
export async function markBackchannelViewed() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { networkBackchannelLastViewedAt: new Date() },
  })
  revalidatePath('/dashboard', 'layout')
}

export async function logOutreach(contactId: string | null, channel: OutreachChannel) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.outreachLog.create({ data: { candidateId: profile.id, contactId, channel } })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
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
  revalidatePath('/dashboard/network/contacts')
  revalidatePath('/dashboard')
}
