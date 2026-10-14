'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { uploadEmployerLogo } from '@/lib/employer/brand-upload'
import { cleanBrandColor, EVERYONE, PROGRAM_FEATURES, readProgramSettings, type ProgramFeatureKey, type ProgramPackage, type ServiceChoice } from '@/lib/employer/program-settings'

export type ProgramFormState = { error?: string; ok?: string } | undefined
type Result = { error?: string; ok?: boolean; message?: string }

async function admin() {
  return requireOutplacementRoleForAction(['ADMIN'])
}
async function current(orgId: string) {
  const org = await prisma.outplacementEmployerOrg.findUniqueOrThrow({ where: { id: orgId }, select: { programSettings: true } })
  return readProgramSettings(org.programSettings)
}

export async function saveProgramDetails(_prev: ProgramFormState, f: FormData): Promise<ProgramFormState> {
  const orgUser = await admin()
  if (!orgUser) return { error: 'Only an admin on this account can change the program.' }
  const name = String(f.get('programBrandName') ?? '').trim().slice(0, 80) || null
  const welcome = String(f.get('welcome') ?? '').trim().slice(0, 1000) || null
  const s = await current(orgUser.orgId)
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programBrandName: name, programSettings: { ...s, welcome } } })
  captureServerEvent(orgUser.userId, 'outplacement_program_details_saved', { orgId: orgUser.orgId, named: !!name, welcome: !!welcome })
  revalidatePath('/employer', 'layout')
  return { ok: 'Saved. Your people see this on their NextChapter dashboard.' }
}

// The company's look on its people's dashboards: a logo and an accent color. Stored in the
// program settings JSON next to the welcome message.
export async function saveProgramLook(_prev: ProgramFormState, f: FormData): Promise<ProgramFormState> {
  const orgUser = await admin()
  if (!orgUser) return { error: 'Only an admin on this account can change the program.' }
  const rawColor = String(f.get('accentColor') ?? '').trim()
  const accentColor = rawColor ? cleanBrandColor(rawColor) : null
  if (rawColor && !accentColor) return { error: 'Use a six-digit color like #A93439, or leave it blank.' }

  const uploaded = await uploadEmployerLogo(orgUser.orgId, f.get('logo') instanceof File ? (f.get('logo') as File) : null)
  if (uploaded && typeof uploaded === 'object') return { error: uploaded.error }

  const s = await current(orgUser.orgId)
  const removeLogo = f.get('removeLogo') === 'on'
  const logoUrl = uploaded ?? (removeLogo ? null : s.brand.logoUrl)
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programSettings: { ...s, brand: { logoUrl, accentColor } } } })
  captureServerEvent(orgUser.userId, 'outplacement_program_look_saved', { orgId: orgUser.orgId, hasLogo: logoUrl !== null, hasAccent: accentColor !== null, replacedLogo: uploaded !== null, removedLogo: removeLogo && uploaded === null })
  revalidatePath('/employer', 'layout')
  return { ok: 'Saved. Your people see the new look on their dashboard the next time a page loads.' }
}

// One row of the services menu: on/off, who provides it, and for the
// company's own version, where to send people and a note.
export async function saveProgramService(key: ProgramFeatureKey, choice: ServiceChoice): Promise<Result> {
  const orgUser = await admin()
  if (!orgUser) return { error: 'Only an admin on this account can change the program.' }
  const f = PROGRAM_FEATURES.find((x) => x.key === key)
  if (!f) return { error: 'Unknown service.' }
  if (choice.provider === 'own' && !f.ownAllowed) return { error: `${f.label} only comes from NextChapter.` }
  if (choice.provider === 'nextchapter' && !f.nextchapter) return { error: `NextChapter doesn’t offer ${f.label}; add your own link or note.` }
  const url = choice.url?.trim() || null
  if (url && !/^https:\/\/\S+$/.test(url)) return { error: 'The link must start with https://' }
  const note = choice.note?.trim().slice(0, 300) || null
  if (choice.on && choice.provider === 'own' && !url && !note) return { error: 'Add a link or a note (who to call, how to book) so people know how to use it.' }
  const s = await current(orgUser.orgId)
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programSettings: { ...s, services: { ...s.services, [key]: { on: choice.on, provider: choice.provider, url, note } } } } })
  captureServerEvent(orgUser.userId, 'outplacement_program_service_saved', { orgId: orgUser.orgId, service: key, on: choice.on, provider: choice.provider })
  revalidatePath('/employer/program')
  return { ok: true, message: 'Saved.' }
}

// Packages: who gets what. "Everyone" (all offered services) always exists.
export async function savePackages(packages: ProgramPackage[]): Promise<Result> {
  const orgUser = await admin()
  if (!orgUser) return { error: 'Only an admin on this account can change the program.' }
  const clean = packages
    .map((p) => ({ key: p.key || `p${Math.random().toString(36).slice(2, 8)}`, name: p.name.trim().slice(0, 60), services: p.services.filter((k) => PROGRAM_FEATURES.some((f) => f.key === k)) }))
    .filter((p) => p.key !== EVERYONE)
  if (clean.some((p) => !p.name)) return { error: 'Give every package a name.' }
  if (new Set(clean.map((p) => p.name.toLowerCase())).size !== clean.length) return { error: 'Two packages have the same name.' }
  if (clean.length > 10) return { error: 'Ten packages at most.' }
  const s = await current(orgUser.orgId)
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programSettings: { ...s, packages: clean } } })
  // People on a package that was removed fall back to everything.
  const keys = clean.map((p) => p.key)
  await prisma.outplacementSeat.updateMany({ where: { contract: { orgId: orgUser.orgId }, packageKey: { not: null, notIn: keys } }, data: { packageKey: null } })
  captureServerEvent(orgUser.userId, 'outplacement_program_packages_saved', { orgId: orgUser.orgId, packages: clean.length })
  revalidatePath('/employer', 'layout')
  return { ok: true, message: 'Packages saved.' }
}

export async function setSeatPackage(seatId: string, packageKey: string): Promise<Result> {
  const orgUser = await admin()
  if (!orgUser) return { error: 'Only an admin on this account can change packages.' }
  const s = await current(orgUser.orgId)
  if (packageKey !== EVERYONE && !s.packages.some((p) => p.key === packageKey)) return { error: 'That package no longer exists.' }
  const r = await prisma.outplacementSeat.updateMany({ where: { id: seatId, contract: { orgId: orgUser.orgId } }, data: { packageKey: packageKey === EVERYONE ? null : packageKey } })
  captureServerEvent(orgUser.userId, 'outplacement_seat_package_set', { orgId: orgUser.orgId, packageKey })
  revalidatePath('/employer/roster')
  return r.count ? { ok: true } : { error: 'That seat is gone.' }
}
