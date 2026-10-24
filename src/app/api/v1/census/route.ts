// The census hook: an outplacement firm or a college pushes its people from
// its HR system or CRM. Authorization: Bearer <org API key>.
//
// Outplacement  POST { contractId?, people: [{ email, name?, externalId?, cohort?, package?, accessEnds?, remove? }] }
// College       POST { people: [{ external_id, email, first_name, last_name, affiliation, class_year?, ... }] }
//               POST { cohortId, learners: [{ email, first_name, last_name, payer?, employer? }] }
// Both          GET  ?cursor=<id>  → who's on the roster and their status (1,000 a page)
//
// Up to 2,000 people per call. Rows are matched on the org's own id, then
// email; fields left out are left as they are. Nothing about anyone's
// activity in NextChapter comes back, only enrollment status.

import { NextResponse } from 'next/server'
import type { ProgramPayer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyOrgKey } from '@/lib/census/api-keys'
import { applyOutplacementCensus, MAX_CENSUS_ROWS, type CensusPerson } from '@/lib/census/outplacement'
import { parseRosterRecords, type LearnerRow } from '@/lib/higher-ed/crm-csv'
import { importRosterRows } from '@/lib/higher-ed/crm-import'
import { importLearners } from '@/lib/higher-ed/programs'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status })
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? undefined : String(v))

export async function POST(req: Request) {
  const key = await verifyOrgKey(req.headers.get('authorization'))
  if (!key) return bad('Missing or invalid API key. Send Authorization: Bearer <key>.', 401)
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return bad('The body must be JSON.')
  }

  if (key.orgKind === 'outplacement') {
    if (!Array.isArray(body.people)) return bad('Send people: an array.')
    if (body.people.length > MAX_CENSUS_ROWS) return bad(`${MAX_CENSUS_ROWS} people at most per call.`)
    const people: CensusPerson[] = (body.people as Record<string, unknown>[]).map((p, i) => ({
      row: i + 1,
      email: str(p?.email) ?? '',
      name: 'name' in (p ?? {}) ? (str(p.name) ?? null) : undefined,
      externalId: str(p?.externalId) ?? null,
      cohort: 'cohort' in (p ?? {}) ? (str(p.cohort) ?? null) : undefined,
      package: 'package' in (p ?? {}) ? (str(p.package) ?? null) : undefined,
      accessEnds: 'accessEnds' in (p ?? {}) ? (str(p.accessEnds) ?? null) : undefined,
      remove: p?.remove === true,
    }))
    const r = await applyOutplacementCensus({ orgId: key.orgId, actor: `apikey:${key.keyId}`, method: 'API', contractId: str(body.contractId) ?? null, people })
    if (r.fileError) return bad(r.fileError, 422)
    return NextResponse.json(r)
  }

  // College
  if (Array.isArray(body.learners)) {
    const cohortId = str(body.cohortId)
    if (!cohortId) return bad('Send cohortId with learners.')
    if (body.learners.length > MAX_CENSUS_ROWS) return bad(`${MAX_CENSUS_ROWS} learners at most per call.`)
    const rows: LearnerRow[] = []
    const errors: { row: number; message: string }[] = []
    ;(body.learners as Record<string, unknown>[]).forEach((l, i) => {
      const email = (str(l?.email) ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !str(l?.first_name) || !str(l?.last_name)) return errors.push({ row: i + 1, message: 'email, first_name and last_name are required.' })
      rows.push({ row: i + 1, email, firstName: str(l.first_name)!.trim(), lastName: str(l.last_name)!.trim(), payer: str(l.payer)?.toUpperCase() ?? null, employer: str(l.employer) ?? null })
    })
    const r = await importLearners({ institutionId: key.orgId, cohortId, rows, defaultPayer: 'SELF_PAY' as ProgramPayer, defaultClientId: null })
    captureServerEvent(`apikey:${key.keyId}`, 'he_census_learners_pushed', { institutionId: key.orgId, cohortId, enrolled: r.enrolled, already: r.already })
    return NextResponse.json({ ...r, errors: [...errors, ...r.errors] })
  }
  if (!Array.isArray(body.people)) return bad('Send people (roster) or cohortId + learners.')
  if (body.people.length > MAX_CENSUS_ROWS) return bad(`${MAX_CENSUS_ROWS} people at most per call.`)
  const parsed = parseRosterRecords(body.people as Record<string, unknown>[])
  const r = await importRosterRows({ institutionId: key.orgId, rows: parsed.rows, errors: parsed.errors, fileName: 'census-api', createdBy: `apikey:${key.keyId}` })
  captureServerEvent(`apikey:${key.keyId}`, 'he_census_roster_pushed', { institutionId: key.orgId, imported: r.imported, updated: r.updated, skipped: r.skipped })
  return NextResponse.json(r, r.capReached ? { status: 402 } : undefined)
}

export async function GET(req: Request) {
  const key = await verifyOrgKey(req.headers.get('authorization'))
  if (!key) return bad('Missing or invalid API key. Send Authorization: Bearer <key>.', 401)
  const cursor = new URL(req.url).searchParams.get('cursor')
  const page = { take: 1000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' as const } }
  if (key.orgKind === 'outplacement') {
    const seats = await prisma.outplacementSeat.findMany({
      where: { contract: { orgId: key.orgId } },
      select: { id: true, contractId: true, externalId: true, invitedEmail: true, invitedName: true, status: true, cohort: true, packageKey: true, accessEndsAt: true, enrolledAt: true, activatedAt: true, deactivatedAt: true, placedAt: true },
      ...page,
    })
    return NextResponse.json({ people: seats.map(({ invitedEmail, invitedName, packageKey, ...s }) => ({ ...s, email: invitedEmail, name: invitedName, package: packageKey })), next: seats.length === 1000 ? seats[seats.length - 1].id : null })
  }
  const members = await prisma.institutionMember.findMany({
    where: { institutionId: key.orgId },
    select: { id: true, externalId: true, email: true, firstName: true, lastName: true, affiliation: true, classYear: true, status: true, claimedAt: true },
    ...page,
  })
  return NextResponse.json({ people: members, next: members.length === 1000 ? members[members.length - 1].id : null })
}
