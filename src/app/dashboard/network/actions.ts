'use server'

import { revalidatePath } from 'next/cache'
import type {
  NetworkingAnxiety,
  NetworkComfortLevel,
  OutreachChannel,
  MarketResponseType,
  RelationshipTag,
  ContactSource,
} from '@prisma/client'
import { Prisma } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { parseLinkedInConnectionsCsv, normalizeContactKey } from '@/lib/network/csv-import'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { PRIORITY_CONTACT_TARGET_COUNT } from '@/lib/network/priority-contacts'

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

  try {
    return await doImportConnectionsCsv(profile.id, file)
  } catch (error) {
    console.error('Failed to import connections CSV:', error)
    return { error: "Something went wrong importing that file. Double check it's LinkedIn's Connections.csv export and try again." }
  }
}

async function doImportConnectionsCsv(candidateId: string, file: File): Promise<NetworkFormState> {
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
    where: { candidateId },
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
      candidateId,
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

  const created =
    toCreate.length > 0
      ? await prisma.supportNetworkContact.createMany({ data: toCreate, skipDuplicates: true })
      : { count: 0 }
  // Bulk SQL rather than one Prisma call per row — a large account (tens of
  // thousands of contacts) re-uploading a CSV that fills in a previously-
  // blank field on most existing rows can produce thousands of updates.
  // Measured: even 100-at-a-time parallel prisma.update() calls took 80+
  // seconds for 3,000 rows against the Supabase pooler, which blows past the
  // serverless function timeout and fails the whole import. A single
  // UPDATE ... CASE statement per field, batched a few hundred rows at a
  // time, does the same work in one round trip instead of one per row.
  // `field` only ever comes from the hardcoded FILLABLE_FIELDS/connectedAt/
  // normalizedKey keys above — never user input — so it's safe to splice
  // into the raw SQL as a column identifier.
  const UPDATE_BATCH_SIZE = 500
  const updatesByField = new Map<string, { id: string; value: string | Date }[]>()
  for (const u of updates) {
    for (const [field, value] of Object.entries(u.data)) {
      const list = updatesByField.get(field) ?? []
      list.push({ id: u.id, value })
      updatesByField.set(field, list)
    }
  }
  for (const [field, entries] of updatesByField) {
    for (let i = 0; i < entries.length; i += UPDATE_BATCH_SIZE) {
      const batch = entries.slice(i, i + UPDATE_BATCH_SIZE)
      const cases = Prisma.join(
        batch.map((e) => Prisma.sql`WHEN ${e.id} THEN ${e.value}`),
        ' '
      )
      const ids = Prisma.join(batch.map((e) => e.id))
      await prisma.$executeRaw`
        UPDATE "SupportNetworkContact"
        SET ${Prisma.raw(`"${field}"`)} = CASE id ${cases} END
        WHERE id IN (${ids}) AND "candidateId" = ${candidateId}
      `
    }
  }

  await markNetworkingListSubmittedIfThresholdMet(candidateId)

  // Weekly Sprint credit only for genuinely new contacts — re-uploading the
  // same export (or one with no new names) fires zero credit, not a
  // re-award of the same one-time flag
  // markNetworkingListSubmittedIfThresholdMet uses.
  if (created.count > 0) {
    const sprint = await getCurrentWeekSprint(candidateId)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'NETWORKING_LIST' })
      await autoCompleteEngagementAction(candidateId, {
        actionType: 'NETWORKING_LIST',
        text: 'Add new contacts to your networking list',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      }).catch((error) => console.error('Failed to auto-complete NETWORKING_LIST action:', error))
    }
  }

  captureServerEvent(candidateId, 'connections_csv_imported', {
    imported: created.count,
    updated: updates.length,
    skippedRemoved,
  })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
  revalidatePath('/dashboard')
  return { imported: created.count, updated: updates.length, skippedRemoved }
}

export async function updateContact(contactId: string, formData: FormData) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const relationshipTags = formData.getAll('relationshipTags') as RelationshipTag[]
  const name = (formData.get('name') as string | null)?.trim()
  const company = (formData.get('company') as string | null)?.trim() || null
  const title = (formData.get('title') as string | null)?.trim() || null
  const email = (formData.get('email') as string | null)?.trim() || null
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const linkedinUrl = (formData.get('linkedinUrl') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const customTags = ((formData.get('customTags') as string | null) ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: {
      relationshipTags,
      ...(name ? { name } : {}),
      company,
      title,
      email,
      phone,
      linkedinUrl,
      notes,
      customTags,
    },
  })
  captureServerEvent(profile.id, 'contact_updated', { contactId })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
}

// Starring is the candidate's own "these people matter most" shortlist —
// surfaced on the Network page as long as isPriority is true AND the
// candidate hasn't reached out to them yet (see the priority-contacts query
// in network/page.tsx). The moment an outreach is logged against them,
// they've moved from "reach out to this person" to "did they answer me" —
// that's what needs-follow-up.ts's unanswered-outbound branch picks up
// instead, so the same person is never shown as both at once.
export async function toggleContactPriority(contactId: string, isPriority: boolean) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const contact = await prisma.supportNetworkContact.findFirst({
    where: { id: contactId, candidateId: profile.id },
    select: { priorityPointsAwardedAt: true },
  })
  if (!contact) return

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: { isPriority },
  })
  captureServerEvent(profile.id, 'contact_priority_toggled', { contactId, isPriority })

  // Award points once per contact, capped at PRIORITY_CONTACT_TARGET_COUNT
  // contacts total (lifetime) — encourages a real top-5 shortlist, not a
  // star/unstar/restar farm. priorityPointsAwardedAt is the durable
  // "already paid" flag this cap checks against.
  if (isPriority && !contact.priorityPointsAwardedAt) {
    const awardedCount = await prisma.supportNetworkContact.count({
      where: { candidateId: profile.id, priorityPointsAwardedAt: { not: null } },
    })
    if (awardedCount < PRIORITY_CONTACT_TARGET_COUNT) {
      await prisma.supportNetworkContact.update({
        where: { id: contactId },
        data: { priorityPointsAwardedAt: new Date() },
      })
      const sprint = await getCurrentWeekSprint(profile.id)
      if (sprint) {
        const effort = estimateActionEffort({ actionType: 'CONTACT_PRIORITIZED' })
        await autoCompleteEngagementAction(profile.id, {
          actionType: 'CONTACT_PRIORITIZED',
          text: 'Star a priority contact',
          points: effort.points,
          estimatedMinutes: effort.minutes,
        }).catch((error) => console.error('Failed to auto-complete CONTACT_PRIORITIZED action:', error))
      }
    }
  }

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
  captureServerEvent(profile.id, 'contact_removed', { contactId })
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
  captureServerEvent(profile.id, 'contact_restored', { contactId })
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
        text: 'Answer the network comfort check-in',
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
  captureServerEvent(profile.id, 'outreach_logged', { contactId, channel })
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
  captureServerEvent(profile.id, 'market_response_logged', { type })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
  revalidatePath('/dashboard')
}

// Confirms a suggestion from getSuggestedContactsToAdd (a recruiter/hiring-
// manager email or networking-call/interview counterpart the silent
// upsertContactFromSignal auto-add missed) into a real Contact Directory
// row. company is best-effort domain inference — title/linkedinUrl are left
// blank since there's no reliable way to infer either from an email address
// alone, so the candidate fills them in by hand if they want them.
export async function addSuggestedContact(params: {
  name: string
  email: string
  connectedAt: Date
  inferredCompany: string | null
}) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const email = params.email.toLowerCase()
  const existing = await prisma.supportNetworkContact.findFirst({
    where: { candidateId: profile.id, email },
  })
  if (existing) return

  await prisma.supportNetworkContact.create({
    data: {
      candidateId: profile.id,
      name: params.name,
      email,
      company: params.inferredCompany,
      source: 'EMAIL_DETECTED' as ContactSource,
      connectedAt: params.connectedAt,
      normalizedKey: normalizeContactKey(params.name, params.inferredCompany),
    },
  })
  captureServerEvent(profile.id, 'suggested_contact_added', { email })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/network/contacts')
}

// The "not a contact" dismiss path for a suggestion — reuses the same
// dismissedAt columns the Needs Follow-up card already writes to
// (dismissEmailActivity/dismissCalendarEvent), so a declined suggestion
// never resurfaces from either list.
export async function dismissSuggestedContact(sourceId: string, sourceKind: 'meeting' | 'inbound-email') {
  const profile = await getAuthedProfile()
  if (!profile) return

  if (sourceKind === 'meeting') {
    await prisma.trackedCalendarEvent.updateMany({
      where: { id: sourceId, candidateId: profile.id },
      data: { dismissedAt: new Date() },
    })
  } else {
    await prisma.trackedEmailActivity.updateMany({
      where: { id: sourceId, candidateId: profile.id },
      data: { dismissedAt: new Date() },
    })
  }
  revalidatePath('/dashboard/network/contacts')
}
