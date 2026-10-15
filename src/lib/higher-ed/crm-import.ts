// Roster and gift imports (spec §6.1, HE-05). Rerunnable: members upsert on
// external id (falling back to email), gifts on their dedupe key. Every run
// is a CrmExchangeRun with its per-row errors.
//
// Deliberately NOT done here: linking a roster row to an existing
// NextChapter account. That happens only when the alum joins (./join.ts),
// so the college never sees anyone's NextChapter data before they've agreed.

import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { parseGifts, parseRoster, type RosterRow, type RowError } from './crm-csv'

export type ImportResult = { runId: string; imported: number; updated: number; skipped: number; errors: RowError[]; fileError?: string }

async function startRun(institutionId: string, direction: 'IMPORT_ROSTER' | 'IMPORT_GIFTS', fileName: string, createdBy: string) {
  return prisma.crmExchangeRun.create({ data: { institutionId, direction, fileName, createdBy }, select: { id: true } })
}

async function finishRun(runId: string, rowCount: number, errors: RowError[], fileError?: string) {
  await prisma.crmExchangeRun.update({
    where: { id: runId },
    data: {
      rowCount,
      errorCount: errors.length + (fileError ? 1 : 0),
      errorsJson: (fileError ? [{ row: 1, message: fileError }, ...errors] : errors) as Prisma.InputJsonValue,
      status: fileError ? 'FAILED' : errors.length ? 'PARTIAL' : 'SUCCEEDED',
      completedAt: new Date(),
    },
  })
}

export async function importRoster(args: { institutionId: string; csv: string; fileName: string; createdBy: string }): Promise<ImportResult> {
  const { rows, errors, fileError } = parseRoster(args.csv)
  return importRosterRows({ ...args, rows, errors, fileError })
}

// Shared by the CSV upload and the census API (records already parsed).
export async function importRosterRows(args: { institutionId: string; rows: RosterRow[]; errors: RowError[]; fileError?: string; fileName: string; createdBy: string }): Promise<ImportResult> {
  const run = await startRun(args.institutionId, 'IMPORT_ROSTER', args.fileName, args.createdBy)
  const { rows, errors, fileError } = args
  let imported = 0
  let updated = 0
  if (!fileError) {
    for (const r of rows) {
      const existing = await prisma.institutionMember.findFirst({
        where: { institutionId: args.institutionId, OR: [{ externalId: r.externalId }, { email: r.email }] },
        select: { id: true, externalId: true, email: true },
      })
      // An email already used by another external id in this roster is a
      // conflict in the college's data, not something to silently merge.
      if (existing && existing.externalId && existing.externalId !== r.externalId && existing.email === r.email) {
        errors.push({ row: r.row, column: 'email', message: `${r.email} already belongs to external id ${existing.externalId}.` })
        continue
      }
      const data = {
        externalId: r.externalId,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        affiliation: r.affiliation,
        classYear: r.classYear,
        degree: r.degree,
        major: r.major,
        lastKnownEmployer: r.employer,
        lastKnownEmployerNormalized: r.employer ? normalizeOrgName(r.employer) : null,
        lastKnownTitle: r.title,
        doNotContact: r.doNotContact,
      }
      if (existing) {
        await prisma.institutionMember.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await prisma.institutionMember.create({ data: { ...data, institutionId: args.institutionId, matchMethod: 'ROSTER_EMAIL', status: 'IMPORTED' } })
        imported++
      }
    }
  }
  await finishRun(run.id, rows.length, errors, fileError)
  return { runId: run.id, imported, updated, skipped: errors.length, errors, fileError }
}

export async function importGifts(args: { institutionId: string; csv: string; fileName: string; createdBy: string }): Promise<ImportResult> {
  const run = await startRun(args.institutionId, 'IMPORT_GIFTS', args.fileName, args.createdBy)
  const { rows, errors, fileError } = parseGifts(args.csv)
  let imported = 0
  let skipped = 0
  if (!fileError && rows.length) {
    const members = await prisma.institutionMember.findMany({
      where: { institutionId: args.institutionId, externalId: { in: [...new Set(rows.map((r) => r.externalId))] } },
      select: { id: true, externalId: true },
    })
    const byExternal = new Map(members.map((m) => [m.externalId, m.id]))
    const result = await prisma.institutionGift.createMany({
      data: rows.map((r) => ({
        institutionId: args.institutionId,
        memberId: byExternal.get(r.externalId) ?? null,
        externalConstituentId: r.externalId,
        amountCents: r.amountCents,
        giftDate: r.giftDate,
        fund: r.fund,
        appeal: r.appeal,
        dedupeKey: r.dedupeKey,
        importRunId: run.id,
      })),
      skipDuplicates: true,
    })
    imported = result.count
    skipped = rows.length - result.count
  }
  await finishRun(run.id, rows.length, errors, fileError)
  return { runId: run.id, imported, updated: 0, skipped: skipped + errors.length, errors, fileError }
}
