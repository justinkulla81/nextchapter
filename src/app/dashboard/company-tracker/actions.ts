'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import {
  addCompanyToWatchlist,
  removeCompanyFromWatchlist,
  markWatchlistViewed,
} from '@/lib/company-tracker/watchlist'
import { logCatalogAction } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'

export type WatchlistFormState = { error?: string } | undefined

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

async function logWatchlistAdd(candidateId: string, companyName: string) {
  await logCatalogAction(candidateId, {
    text: `Added ${companyName} to your Company Tracker`,
    actionType: 'WATCHLIST_ADD',
    points: 2,
    estimatedMinutes: 2,
    recurring: true,
  })
  captureServerEvent(candidateId, 'watchlist_company_added', { companyName })
}

export async function addWatchlistCompany(
  _prevState: WatchlistFormState,
  formData: FormData
): Promise<WatchlistFormState> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const companyName = (formData.get('companyName') as string | null)?.trim()
  if (!companyName) return { error: 'Enter a company name.' }

  const result = await addCompanyToWatchlist(profile.id, companyName)
  if (result.error) return { error: result.error }

  await logWatchlistAdd(profile.id, companyName)
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard', 'layout')
}

// Inline "Track this company" button used on Job Fit / NC Job Board cards —
// same underlying add, just triggered with a known company name instead of
// a typed form field.
export async function addWatchlistCompanyByName(companyName: string): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const result = await addCompanyToWatchlist(profile.id, companyName)
  if (result.error) return result

  await logWatchlistAdd(profile.id, companyName)
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function removeWatchlistCompany(entryId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await removeCompanyFromWatchlist(profile.id, entryId)
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard', 'layout')
}

export async function viewWatchlistPosting(postingId: string, companyName: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await logCatalogAction(profile.id, {
    text: `Reviewed a new posting from ${companyName}`,
    actionType: 'WATCHLIST_POSTING_VIEWED',
    points: 2,
    estimatedMinutes: 2,
    recurring: true,
  })
  captureServerEvent(profile.id, 'watchlist_posting_viewed', { postingId, companyName })
}

// Resets the "new" counter for the whole watchlist — called once when the
// candidate loads the Find Full-Time Jobs page (which now embeds the
// Company Tracker section), same "visiting clears it" convention as
// communityLastViewedAt.
export async function markWatchlistPageViewed(): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await markWatchlistViewed(profile.id)
  revalidatePath('/dashboard', 'layout')
}
