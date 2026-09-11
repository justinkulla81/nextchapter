import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { strictOrgKey } from '@/lib/crm/normalize'
import { WARN_SOURCES, isKnowledgeSector, type WarnRow } from './sources'

export interface WarnSyncResult {
  state: string
  fetched: number
  created: number
  promoted: number
  skippedSector: number
  skippedSmall: number
  error?: string
}

/** Below this a filing is a small closure, not an outplacement opportunity. */
const MIN_EMPLOYEES = 40

/**
 * Fetches a state's WARN notices, stages them, and promotes the ones worth
 * pursuing into outplacement leads.
 *
 * Staging first is the point: WARN covers every industry above the threshold,
 * so most filings are real layoffs and bad leads. Everything is kept, and only
 * knowledge-sector filings above the size floor become opportunities — which
 * means the promotion rule can be changed later without re-fetching, and a bad
 * rule cannot quietly fill the pipeline with restaurant closures.
 */
export async function syncWarnState(stateCode: string, promote = true): Promise<WarnSyncResult> {
  const source = WARN_SOURCES.find((s) => s.state === stateCode)
  if (!source) return { state: stateCode, fetched: 0, created: 0, promoted: 0, skippedSector: 0, skippedSmall: 0, error: 'no_source' }

  const run = await prisma.warnSyncRun.create({ data: { state: stateCode } })
  const result: WarnSyncResult = { state: stateCode, fetched: 0, created: 0, promoted: 0, skippedSector: 0, skippedSmall: 0 }

  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(60_000),
      headers: { 'User-Agent': 'NextChapterAdmin/1.0 (outplacement lead sync)' },
    })
    if (!res.ok) throw new Error(`${source.state} WARN returned ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const rows = source.parse(buf, source.url)
    result.fetched = rows.length

    for (const row of rows) {
      const created = await stageNotice(row, source.url)
      if (created) result.created++
      if (!promote) continue

      if (!isKnowledgeSector(row.industry)) { result.skippedSector++; continue }
      if (!row.employees || row.employees < MIN_EMPLOYEES) { result.skippedSmall++; continue }
      if (await promoteNotice(row, source.url)) result.promoted++
    }

    await prisma.warnSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), fetched: result.fetched, created: result.created, promoted: result.promoted },
    })
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await prisma.warnSyncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), error: message } })
    return { ...result, error: message }
  }
}

/** Records the filing. Returns true when it is new. */
async function stageNotice(row: WarnRow, sourceUrl: string): Promise<boolean> {
  const existing = await prisma.warnNotice.findFirst({
    where: {
      state: row.state, normalizedEmployer: row.normalizedEmployer,
      noticeDate: row.noticeDate, employees: row.employees,
    },
    select: { id: true },
  })
  if (existing) return false
  await prisma.warnNotice.create({
    data: {
      state: row.state, employer: row.employer, normalizedEmployer: row.normalizedEmployer,
      noticeDate: row.noticeDate, effectiveDate: row.effectiveDate, employees: row.employees,
      layoffType: row.layoffType, county: row.county, address: row.address,
      industry: row.industry, sourceUrl,
    },
  })
  return true
}

/** Turns a staged notice into an organization, a profile and an opportunity. */
async function promoteNotice(row: WarnRow, sourceUrl: string): Promise<boolean> {
  const notice = await prisma.warnNotice.findFirst({
    where: {
      state: row.state, normalizedEmployer: row.normalizedEmployer,
      noticeDate: row.noticeDate, employees: row.employees,
    },
  })
  if (!notice || notice.promotedAt || notice.dismissedAt) return false

  // Match an existing organization before creating one, using the same strict
  // key the importer and dedupe share — otherwise a WARN filing for "Genentech,
  // Inc." creates a second Genentech next to the one already on file.
  const strict = strictOrgKey(row.employer, normalizeOrgName)
  const all = await prisma.crmOrganization.findMany({ select: { id: true, name: true, orgTypes: true } })
  const match = all.find((o) => strictOrgKey(o.name, normalizeOrgName) === strict)

  const org = match
    ? await prisma.crmOrganization.update({
        where: { id: match.id },
        data: {
          usState: row.state,
          ...(match.orgTypes.includes('OUTPLACEMENT_LEAD') ? {} : { orgTypes: { push: 'OUTPLACEMENT_LEAD' } }),
          ...(match.orgTypes.includes('EMPLOYER') ? {} : {}),
          goals: { push: 'SALES' },
        },
      })
    : await prisma.crmOrganization.create({
        data: {
          name: row.employer,
          canonicalNameNormalized: normalizeOrgName(row.employer),
          orgTypes: ['OUTPLACEMENT_LEAD', 'EMPLOYER'],
          goals: ['SALES'],
          usState: row.state,
          industry: row.industry,
          hqRegion: row.county,
        },
      })

  await prisma.crmOutplacementProfile.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id, headcountAffected: row.employees,
      announcedAt: row.noticeDate, sourceUrl,
      outreachAngle: `WARN filing${row.effectiveDate ? `, effective ${row.effectiveDate.toISOString().slice(0, 10)}` : ''}${row.layoffType ? ` — ${row.layoffType}` : ''}`,
    },
    update: {
      headcountAffected: row.employees ?? undefined,
      announcedAt: row.noticeDate ?? undefined,
      sourceUrl,
    },
  })

  // The effective date is the deadline that matters: outreach lands best
  // before people have already left, so it is stored as a real date rather
  // than buried in a note.
  if (row.effectiveDate) {
    const existing = await prisma.crmDeadline.findFirst({ where: { orgId: org.id, label: 'Layoff effective' } })
    if (!existing) {
      await prisma.crmDeadline.create({
        data: { orgId: org.id, label: 'Layoff effective', dueAt: row.effectiveDate, kind: 'EVENT', sourceUrl },
      })
    }
  }

  const pipeline = await prisma.crmPipeline.findUnique({
    where: { key: 'outplacement' },
    include: { stages: { where: { key: 'identified' }, take: 1 } },
  })
  if (pipeline?.stages[0]) {
    const dupe = await prisma.crmOpportunity.findFirst({ where: { pipelineId: pipeline.id, orgId: org.id } })
    if (!dupe) {
      await prisma.crmOpportunity.create({
        data: {
          pipelineId: pipeline.id, stageId: pipeline.stages[0].id, orgId: org.id,
          title: `${row.employer} — ${row.employees ?? '?'} roles`,
          leadQuality: (row.employees ?? 0) >= 200 ? 'A' : 'B',
          eligibility: 'NOT_APPLICABLE',
          nextStep: `WARN filed ${row.noticeDate?.toISOString().slice(0, 10) ?? 'recently'}${row.county ? ` in ${row.county}` : ''}. Find the CHRO or VP People.`,
        },
      })
    }
  }

  await prisma.warnNotice.update({
    where: { id: notice.id },
    data: { promotedAt: new Date(), promotedOrgId: org.id },
  })
  return true
}

export async function syncAllWarnStates(promote = true): Promise<WarnSyncResult[]> {
  const out: WarnSyncResult[] = []
  for (const source of WARN_SOURCES) {
    // One state failing must not cost the others their results.
    out.push(await syncWarnState(source.state, promote))
  }
  return out
}
