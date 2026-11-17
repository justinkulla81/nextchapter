'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { ROLES } from '@/lib/pivots/pivot-map'
import { placeAt } from '@/lib/workforce/local'
import { metroTowns } from '@/lib/constants/metro-areas'
import { cityTown } from '@/lib/jobs/added-cities'
import { METRO_STATES } from '@/lib/market/city-stats'

// Metros whose main town the Census lists under another name (GeoPlace has "Nashville-Davidson", not "Nashville").
const METRO_CENTRES: Record<string, { lat: number; lon: number }> = { 'Nashville Metro': { lat: 36.1627, lon: -86.7816 } }

type Kind = 'remote' | 'state' | 'city' | 'relocate' | 'role' | 'industry'

// Add one expansion to the person's job search, or take it back out. Each is
// their choice; nothing is added without it.
export async function setSearchExpansion(kind: Kind, value: string, on: boolean): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const row = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { searchExpansion: true, targetIndustries: true } })
  const exp = readSearchExpansion(row.searchExpansion)
  const toggle = (list: string[], v: string) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v))
  const data: Record<string, unknown> = {}
  if (kind === 'remote') exp.remote = on
  else if (kind === 'state') {
    if (!/^[A-Z]{2}$/.test(value)) return { error: 'Unknown state.' }
    exp.states = toggle(exp.states, value)
  } else if (kind === 'city') {
    // value: "<name>|<ST>", the name as the Widen your search page shows it ("Austin, TX" or "Austin Metro").
    const [rawName, st] = value.split('|')
    const name = (rawName ?? '').trim().slice(0, 80)
    if (!name || !/^[A-Z]{2}$/.test(st ?? '')) return { error: 'We could not tell which city that is. Refresh and try again.' }
    const cities = exp.cities ?? []
    if (!on) exp.cities = cities.filter((c) => c.name !== name)
    else if (!cities.some((c) => c.name === name)) {
      if (cities.length >= 12) return { error: 'You can add up to 12 cities. Take one off to add another.' }
      // A metro is placed at its main town; a city at itself.
      const metro = metroTowns(name)[0]
      const at = METRO_CENTRES[name] ?? (await placeAt(metro ?? cityTown(name), metro ? (METRO_STATES[name]?.[0] ?? st) : st).catch(() => null))
      if (!at) return { error: `We could not find ${name} on the map, so it was not added. Try a nearby larger city.` }
      exp.cities = [...cities, { name, state: st, lat: at.lat, lon: at.lon }]
    }
  } else if (kind === 'role') {
    if (!ROLES.has(value)) return { error: 'Unknown role.' }
    exp.roles = toggle(exp.roles, value)
  } else if (kind === 'industry') {
    const v = value.trim().slice(0, 80)
    if (!v) return { error: 'Unknown industry.' }
    exp.industries = toggle(exp.industries, v)
    // Their target industries are what the job score reads; keep them in step.
    data.targetIndustries = on ? [...new Set([...row.targetIndustries, v])] : row.targetIndustries.filter((x) => x !== v)
  } else if (kind === 'relocate') data.openToRelocation = on
  else return { error: 'Unknown option.' }
  exp.at = new Date().toISOString()
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { ...data, searchExpansion: exp as unknown as Prisma.InputJsonValue } })
  captureServerEvent(profile.id, on ? 'search_expansion_added' : 'search_expansion_removed', { kind, value })
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
