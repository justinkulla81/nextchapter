// An outplacement firm's census: the people on its program, pushed from a
// spreadsheet or its HR system. Each person is matched to a live seat by the
// firm's own id (externalId), else by email, and then:
//   - new: enrolled (invited, or linked if they already have an account),
//   - on the roster: name, cohort, package and access end brought up to date
//     (a package change re-syncs coaching and recruiter access),
//   - remove: the seat is deactivated and its access stops.
// Fields left out of a row are left as they are.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { grantSeatAccess, revokeSeatAccess } from '@/lib/access/grants'
import { enrollOneSeat } from '@/lib/employer/outplacement-enrollment'
import { EVERYONE, readProgramSettings } from '@/lib/employer/program-settings'

export type CensusPerson = {
  row?: number
  email: string
  name?: string | null
  externalId?: string | null
  cohort?: string | null
  /** Package key or name; "all" or blank = everything the program offers. */
  package?: string | null
  /** YYYY-MM-DD; blank = the contract's end. */
  accessEnds?: string | null
  remove?: boolean
}

export type CensusError = { row?: number; email?: string; message: string }
export type CensusResult = { invited: number; linked: number; updated: number; removed: number; unchanged: number; failed: number; errors: CensusError[]; contractId?: string; fileError?: string }

export const MAX_CENSUS_ROWS = 2000

const empty = (): CensusResult => ({ invited: 0, linked: 0, updated: 0, removed: 0, unchanged: 0, failed: 0, errors: [] })

export function parseDay(v: string | null | undefined): Date | null | 'bad' {
  if (v === undefined || v === null || v.trim() === '') return null
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 'bad'
  const [y, mo, d] = m[0].includes('/') ? [Number(m[3]), Number(m[1]), Number(m[2])] : [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59))
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : 'bad'
}

export async function applyOutplacementCensus(args: {
  orgId: string
  actor: string
  method: 'BULK_CSV' | 'API'
  people: CensusPerson[]
  contractId?: string | null
  /** New people in rows with no package column get this (the upload form's choice). */
  defaultPackage?: string | null
}): Promise<CensusResult> {
  const out = empty()
  if (args.people.length > MAX_CENSUS_ROWS) return { ...out, fileError: `${MAX_CENSUS_ROWS} people at most per upload. Split it up.` }

  const org = await prisma.outplacementEmployerOrg.findUnique({ where: { id: args.orgId }, select: { name: true, programSettings: true } })
  if (!org) return { ...out, fileError: 'Organization not found.' }
  const contracts = await prisma.outplacementContract.findMany({
    where: { orgId: args.orgId, status: 'ACTIVE' },
    select: { id: true, seatCount: true, _count: { select: { seats: { where: { status: { not: 'DEACTIVATED' } } } } } },
  })
  const contract = args.contractId ? contracts.find((c) => c.id === args.contractId) : contracts.length === 1 ? contracts[0] : undefined
  if (!contract) return { ...out, fileError: args.contractId ? 'That contract isn’t active for enrollment.' : contracts.length ? 'You have more than one active contract. Say which one (contractId).' : 'You have no active contract. Contact NextChapter.' }
  out.contractId = contract.id
  let free = contract.seatCount - contract._count.seats

  const settings = readProgramSettings(org.programSettings)
  const resolvePackage = (v: string | null | undefined): string | null | undefined | 'bad' => {
    if (v === undefined) return undefined
    const t = (v ?? '').trim().toLowerCase()
    if (!t || t === EVERYONE || t === 'everyone') return null
    return settings.packages.find((p) => p.key.toLowerCase() === t || p.name.toLowerCase() === t)?.key ?? 'bad'
  }

  const live = await prisma.outplacementSeat.findMany({
    where: { contract: { orgId: args.orgId }, status: { not: 'DEACTIVATED' } },
    select: { id: true, invitedEmail: true, invitedName: true, externalId: true, cohort: true, packageKey: true, accessEndsAt: true, status: true },
  })
  const byExt = new Map(live.filter((s) => s.externalId).map((s) => [s.externalId!, s]))
  const byEmail = new Map(live.map((s) => [s.invitedEmail.toLowerCase(), s]))
  const seen = new Set<string>()

  for (const p of args.people) {
    const email = (p.email ?? '').trim().toLowerCase()
    const fail = (message: string) => {
      out.failed++
      out.errors.push({ row: p.row, email: email || undefined, message })
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      fail('Not a valid email address.')
      continue
    }
    const key = p.externalId?.trim() || email
    if (seen.has(key)) {
      fail('Listed twice. Only the first was used.')
      continue
    }
    seen.add(key)
    // A row with no package column leaves an existing seat's package alone;
    // a new seat gets the form's choice.
    const pkg = resolvePackage(p.package)
    if (pkg === 'bad') {
      fail(`No package called “${p.package}”. Use one from Program › Packages, or leave it blank.`)
      continue
    }
    const ends = p.accessEnds === undefined ? undefined : parseDay(p.accessEnds)
    if (ends === 'bad') {
      fail(`“${p.accessEnds}” isn’t a date. Use YYYY-MM-DD.`)
      continue
    }
    const ext = p.externalId?.trim() || null
    const seat = (ext && byExt.get(ext)) || byEmail.get(email)

    if (p.remove) {
      if (!seat) {
        out.unchanged++
        continue
      }
      await prisma.outplacementSeat.update({ where: { id: seat.id }, data: { status: 'DEACTIVATED', deactivatedAt: new Date() } })
      await revokeSeatAccess(seat.id, args.actor)
      out.removed++
      free++
      continue
    }

    if (seat) {
      const data: Record<string, unknown> = {}
      if (p.name !== undefined && (p.name?.trim() || null) !== seat.invitedName) data.invitedName = p.name?.trim() || null
      if (ext && ext !== seat.externalId) data.externalId = ext
      if (p.cohort !== undefined && (p.cohort?.trim() || null) !== seat.cohort) data.cohort = p.cohort?.trim().slice(0, 80) || null
      if (pkg !== undefined && pkg !== seat.packageKey) data.packageKey = pkg
      if (ends !== undefined && (ends?.getTime() ?? null) !== (seat.accessEndsAt?.getTime() ?? null)) data.accessEndsAt = ends
      if (email !== seat.invitedEmail.toLowerCase() && seat.status === 'INVITED') data.invitedEmail = email
      if (!Object.keys(data).length) {
        out.unchanged++
        continue
      }
      await prisma.outplacementSeat.update({ where: { id: seat.id }, data })
      if (seat.status === 'ACTIVATED' && ('packageKey' in data || 'accessEndsAt' in data)) await grantSeatAccess(seat.id, args.actor, { prune: 'packageKey' in data }).catch(() => null)
      out.updated++
      continue
    }

    if (free <= 0) {
      fail('No seats left on this contract. Contact NextChapter to add seats.')
      continue
    }
    const r = await enrollOneSeat(contract.id, org.name, email, p.name?.trim() || null, args.method, pkg === undefined ? (args.defaultPackage ?? null) : pkg, { externalId: ext, cohort: p.cohort?.trim().slice(0, 80) || null, accessEndsAt: ends ?? null })
    if (r.outcome === 'error') fail(r.error ?? 'Couldn’t enroll.')
    else {
      free--
      if (r.outcome === 'invited') out.invited++
      else out.linked++
    }
  }

  captureServerEvent(args.actor, 'outplacement_census_applied', {
    orgId: args.orgId,
    contractId: contract.id,
    method: args.method,
    rows: args.people.length,
    invited: out.invited,
    linked: out.linked,
    updated: out.updated,
    removed: out.removed,
    failed: out.failed,
  })
  return out
}
