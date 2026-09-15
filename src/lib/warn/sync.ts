import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { strictOrgKey } from '@/lib/crm/normalize'
import { matchOrCreateCompanyForEmployer } from './company-match'
import { WARN_SOURCES, WARN_USER_AGENT, RENDERED_STATES, sourceUrl, isKnowledgeSector, type WarnRow } from './sources'
import { toWarnRows, type LayoffsFyiRow } from './layoffs'
import { TABLE_SPECS, makeTableParser } from './states'

/** Recorded as the "state" on sync runs so the tracker shows up in history. */
export const LAYOFFS_FYI_SOURCE = 'layoffs.fyi'
export const LAYOFFS_FYI_URL = 'https://layoffs.fyi/'

export interface WarnSyncResult {
  state: string
  fetched: number
  created: number
  promoted: number
  skippedSector: number
  skippedSmall: number
  skippedOld: number
  /** Staged but not auto-promoted, because the source has no sector field. */
  needsReview: number
  error?: string
}

/** Below this a filing is a small closure, not an outplacement opportunity. */
const MIN_EMPLOYEES = 40

/**
 * How far back a notice is worth storing at all.
 *
 * Several states publish their entire history on one page — Alabama lists a
 * thousand notices back to 2019, the Geographic Solutions portals go to 1999.
 * Someone laid off two years ago has already landed somewhere, so those rows
 * are not leads; they are just a slower sync and a review queue nobody can
 * face. Notices with no date at all are kept, since there is nothing to judge.
 */
const MAX_AGE_DAYS = 540

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
  if (!source) return { state: stateCode, fetched: 0, created: 0, promoted: 0, skippedSector: 0, skippedSmall: 0, skippedOld: 0, needsReview: 0, error: 'no_source' }

  const run = await prisma.warnSyncRun.create({ data: { state: stateCode } })
  const result: WarnSyncResult = { state: stateCode, fetched: 0, created: 0, promoted: 0, skippedSector: 0, skippedSmall: 0, skippedOld: 0, needsReview: 0 }

  try {
    // A source that only links to its data resolves that link first.
    const url = source.resolve ? await source.resolve() : sourceUrl(source)

    const res = await fetch(url, {
      signal: AbortSignal.timeout(60_000),
      // Several state sites reject an unfamiliar user agent outright, so this
      // identifies as a browser rather than failing on half the country.
      headers: { 'User-Agent': WARN_USER_AGENT },
    })
    if (!res.ok) throw new Error(`${source.state} WARN returned ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    let rows = source.parse(buf, url)
    // Sources that publish the headcount on a separate page fill it in here.
    if (source.enrich) rows = await source.enrich(rows)
    result.fetched = rows.length

    const staleBefore = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000)

    for (const row of rows) {
      if (row.noticeDate && row.noticeDate < staleBefore) { result.skippedOld++; continue }

      const created = await stageNotice(row, url)
      if (created) result.created++
      if (!promote) continue

      // A source with no sector cannot be triaged automatically: there is no
      // way to tell a software reduction from a cannery closure, and promoting
      // on size alone fills the pipeline with leads nobody will call. Those
      // notices stage and wait for a human.
      if (!source.hasIndustry) { result.needsReview++; continue }

      if (!isKnowledgeSector(row.industry)) { result.skippedSector++; continue }
      if (!row.employees || row.employees < MIN_EMPLOYEES) { result.skippedSmall++; continue }
      if (await promoteNotice(row, url)) result.promoted++
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

/**
 * Strips characters Postgres will not accept in a text column.
 *
 * PDF-derived text is the reason this exists — a single NUL byte fails the
 * insert for the whole row — but it guards every source.
 */
function clean<T extends string | null>(value: T): T {
  if (typeof value !== 'string') return value
  return (value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() || null) as T
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
  const match = await matchOrCreateCompanyForEmployer(row.employer)
  await prisma.warnNotice.create({
    data: {
      state: row.state, employer: clean(row.employer), normalizedEmployer: row.normalizedEmployer,
      noticeDate: row.noticeDate, effectiveDate: row.effectiveDate, employees: row.employees,
      layoffType: clean(row.layoffType), county: clean(row.county), address: clean(row.address),
      industry: clean(row.industry), sourceUrl,
      companyId: match.companyId,
      companyMatchStatus: match.status,
      ...(match.candidates ? { companyMatchCandidates: match.candidates } : {}),
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


/** Promotes one staged notice by id, from the review page. */
export async function promoteWarnNoticeById(noticeId: string): Promise<boolean> {
  const n = await prisma.warnNotice.findUnique({ where: { id: noticeId } })
  if (!n || n.promotedAt || n.dismissedAt) return false
  return promoteNotice(
    {
      state: n.state, employer: n.employer, normalizedEmployer: n.normalizedEmployer,
      noticeDate: n.noticeDate, effectiveDate: n.effectiveDate, employees: n.employees,
      layoffType: n.layoffType, county: n.county, address: n.address, industry: n.industry,
    },
    n.sourceUrl ?? ''
  )
}

/**
 * Imports layoffs.fyi rows posted by the weekly browser job.
 *
 * These are promoted on size alone, without the sector test the state sources
 * get. That is not a relaxation of the rule but the same rule applied a step
 * earlier: layoffs.fyi tracks only technology companies, so the filtering a
 * state source needs — telling a software reduction from a cannery closure —
 * has already been done by the source. A "Retail" row here is a retail
 * *technology* company.
 *
 * The tracker publishes no effective date, so these leads say when a layoff
 * was reported, not when it lands. Outreach timing has to come from elsewhere.
 */
export async function importLayoffsFyi(rows: LayoffsFyiRow[]): Promise<WarnSyncResult> {
  const result: WarnSyncResult = {
    state: LAYOFFS_FYI_SOURCE, fetched: 0, created: 0, promoted: 0,
    skippedSector: 0, skippedSmall: 0, skippedOld: 0, needsReview: 0,
  }

  const mapped = toWarnRows(rows)
  result.fetched = mapped.length
  const staleBefore = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000)

  for (const row of mapped) {
    if (row.noticeDate && row.noticeDate < staleBefore) { result.skippedOld++; continue }

    if (await stageNotice(row, LAYOFFS_FYI_URL)) result.created++
    if (!row.employees || row.employees < MIN_EMPLOYEES) { result.skippedSmall++; continue }
    if (await promoteNotice(row, LAYOFFS_FYI_URL)) result.promoted++
  }
  return result
}

/**
 * Records one sync-history row for a whole import.
 *
 * The rows arrive in chunks because a single request covering the table runs
 * past both the client's header timeout and the serverless function limit, but
 * the history should still read as one weekly sync rather than four.
 */
export async function recordLayoffsRun(totals: {
  fetched: number
  created: number
  promoted: number
  error?: string
}): Promise<void> {
  await prisma.warnSyncRun.create({
    data: {
      state: LAYOFFS_FYI_SOURCE,
      finishedAt: new Date(),
      fetched: totals.fetched,
      created: totals.created,
      promoted: totals.promoted,
      error: totals.error ?? null,
    },
  })
}

/**
 * Imports a WARN page that the weekly browser job rendered.
 *
 * Identical to a server-fetched state once the HTML is in hand — same column
 * mapping, same recency cutoff, same promotion rule. Only the fetching differs,
 * because these states either build their list client-side or refuse scripted
 * requests outright.
 */
export async function importRenderedState(state: string, html: string): Promise<WarnSyncResult> {
  const spec = TABLE_SPECS.find((s) => s.state === state)
  const result: WarnSyncResult = {
    state, fetched: 0, created: 0, promoted: 0,
    skippedSector: 0, skippedSmall: 0, skippedOld: 0, needsReview: 0,
  }
  if (!spec) return { ...result, error: 'no_spec' }

  const run = await prisma.warnSyncRun.create({ data: { state } })
  const url = RENDERED_STATES[state] ?? ''

  try {
    const rows = makeTableParser(spec)(Buffer.from(html, 'utf8'), url)
    result.fetched = rows.length
    if (!rows.length) throw new Error(`${state}: rendered page produced no rows — its table has changed`)

    const staleBefore = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000)
    for (const row of rows) {
      if (row.noticeDate && row.noticeDate < staleBefore) { result.skippedOld++; continue }
      if (await stageNotice(row, url)) result.created++
      // Neither rendered state publishes a sector code, so both wait for review.
      result.needsReview++
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
