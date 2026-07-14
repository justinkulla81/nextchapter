'use server'

import { revalidatePath } from 'next/cache'
import type { ContactCategory, ContactWarmth, NetworkingAnxiety, OutreachChannel } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { parseLinkedInConnectionsCsv } from '@/lib/network/csv-import'
import { recalculateScore } from '@/lib/scoring/recalculate'

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
  await recalculateScore(candidateId, 'networking_list_submitted')
}

export type NetworkFormState = { error?: string; imported?: number } | undefined

export async function addContact(
  _prevState: NetworkFormState,
  formData: FormData
): Promise<NetworkFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return { error: 'Enter a name.' }

  await prisma.supportNetworkContact.create({
    data: {
      candidateId: profile.id,
      name,
      company: (formData.get('company') as string | null)?.trim() || null,
      title: (formData.get('title') as string | null)?.trim() || null,
      email: (formData.get('email') as string | null)?.trim() || null,
      category: (formData.get('category') as ContactCategory | null) || null,
      warmth: (formData.get('warmth') as ContactWarmth | null) || 'WARM',
    },
  })
  await markNetworkingListSubmittedIfThresholdMet(profile.id)
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard')
}

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

  await prisma.supportNetworkContact.createMany({
    data: contacts.map((c) => ({
      candidateId: profile.id,
      name: c.name,
      company: c.company,
      title: c.title,
      email: c.email,
      source: 'CSV_IMPORT' as const,
    })),
  })

  await markNetworkingListSubmittedIfThresholdMet(profile.id)
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard')
  return { imported: contacts.length }
}

export async function updateContact(contactId: string, formData: FormData) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const category = formData.get('category') as ContactCategory | null
  const warmth = formData.get('warmth') as ContactWarmth | null

  await prisma.supportNetworkContact.updateMany({
    where: { id: contactId, candidateId: profile.id },
    data: { category: category || undefined, warmth: warmth || undefined },
  })
  revalidatePath('/dashboard/network')
}

export async function deleteContact(contactId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.supportNetworkContact.deleteMany({ where: { id: contactId, candidateId: profile.id } })
  revalidatePath('/dashboard/network')
}

export async function setNetworkingAnxiety(anxiety: NetworkingAnxiety) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { networkingAnxiety: anxiety } })
  revalidatePath('/dashboard/network')
}

export async function logOutreach(contactId: string | null, channel: OutreachChannel) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.outreachLog.create({ data: { candidateId: profile.id, contactId, channel } })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard')
}
