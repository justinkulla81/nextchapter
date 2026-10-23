import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadPartnership } from '@/lib/partner-search/partner'
import { costsFor, metroOptions } from '@/lib/market/area-costs'
import { getAreaCatalog, getPayLookup } from '@/lib/careers/local-pay-server'
import { resolveArea } from '@/lib/careers/area'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'

export const MAX_PLACES = 6

export type Result = { ok: true } | { ok: false; error: string }

/** Whose plan the member works on: the inviter's when partnered, their own otherwise. */
async function planOwner(candidateId: string) {
  const p = await loadPartnership(candidateId)
  if (p?.link.joined) return { ownerId: p.link.ownerId, p }
  return { ownerId: candidateId, p: p?.role === 'owner' ? p : null }
}

/** A partner who is not allowed to see the places sees none, and cannot add any. */
function canSeePlaces(candidateId: string, ownerId: string, p: Awaited<ReturnType<typeof loadPartnership>> | null): boolean {
  return candidateId === ownerId || !!p?.link.sharePlaces
}

export async function addPlace(candidateId: string, metroCode: string): Promise<Result> {
  const option = metroOptions().find((o) => o.code === metroCode)
  if (!option) return { ok: false, error: 'Pick a place from the list.' }
  const { ownerId, p } = await planOwner(candidateId)
  if (!canSeePlaces(candidateId, ownerId, p)) return { ok: false, error: 'The places are not shared with you.' }
  const count = await prisma.movePlace.count({ where: { ownerId } })
  if (count >= MAX_PLACES) return { ok: false, error: `You can compare up to ${MAX_PLACES} places. Remove one to add another.` }
  await prisma.movePlace.upsert({ where: { ownerId_metroCode: { ownerId, metroCode } }, create: { ownerId, addedById: candidateId, metroCode, name: option.name }, update: {} })
  captureServerEvent(candidateId, 'move_place_added', { metroCode, places: count + 1, partnered: !!p?.link.joined })
  return { ok: true }
}

export async function removePlace(candidateId: string, placeId: string): Promise<void> {
  const { ownerId, p } = await planOwner(candidateId)
  if (!canSeePlaces(candidateId, ownerId, p)) return
  const res = await prisma.movePlace.deleteMany({ where: { id: placeId, ownerId } })
  if (res.count > 0) captureServerEvent(candidateId, 'move_place_removed', { placeId })
}

export interface PlaceRow {
  id: string
  metroCode: string
  name: string
  /** Median pay for the member's occupation there (BLS OEWS), or null. */
  you: number | null
  /** The other partner's, only when sharing allows it. */
  them: number | null
}

export interface MovePlanData {
  role: 'owner' | 'partner' | 'solo'
  partnerName: string | null
  /** Where the viewer lives now, as the base for every comparison. */
  homeMetroCode: string | null
  homeStateFips: string | null
  lastSalary: number | null
  places: PlaceRow[]
  placesHidden: boolean
  occupationTitle: string | null
}

async function medianIn(candidateId: string, metro: { code: string; name: string }): Promise<number | null> {
  const occ = await resolveCandidateOccupation(candidateId)
  if (occ.status !== 'resolved') return null
  const lookup = await getPayLookup({ metro, state: null })
  return lookup(occ.socCode).METRO?.median ?? null
}

export async function loadMovePlan(candidateId: string): Promise<MovePlanData> {
  const { ownerId, p } = await planOwner(candidateId)
  const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { currentCity: true, currentState: true, lastSalary: true } })
  const area = resolveArea({ city: profile?.currentCity, state: profile?.currentState }, await getAreaCatalog())
  const sees = canSeePlaces(candidateId, ownerId, p)
  const rows = sees ? await prisma.movePlace.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } }) : []
  const otherId = p?.link.joined ? (p.role === 'owner' ? p.link.partnerId : p.link.ownerId) : null
  const showOther = !!otherId && !!p?.link.shareJobsPay
  const places = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      metroCode: r.metroCode,
      name: r.name,
      you: await medianIn(candidateId, { code: r.metroCode, name: r.name }).catch(() => null),
      them: showOther && otherId ? await medianIn(otherId, { code: r.metroCode, name: r.name }).catch(() => null) : null,
    }))
  )
  const occ = await resolveCandidateOccupation(candidateId).catch(() => null)
  captureServerEvent(candidateId, 'move_plan_viewed', { places: places.length, partnered: !!p?.link.joined, hasLastSalary: !!profile?.lastSalary })
  return {
    role: p ? (p.role === 'owner' ? 'owner' : 'partner') : 'solo',
    partnerName: p ? (p.role === 'owner' ? p.partnerFirstName ?? p.link.partnerName : p.ownerFirstName) : null,
    homeMetroCode: area.metro?.code ?? null,
    homeStateFips: area.state?.code ?? null,
    lastSalary: profile?.lastSalary ?? null,
    places,
    placesHidden: !sees,
    occupationTitle: occ?.status === 'resolved' ? occ.title : null,
  }
}

export { costsFor }
