import 'server-only'
import type { Prisma } from '@prisma/client'
import { fetchOpportunityText } from './fetch-doc'
import { readDocument } from './read-doc'
import { loadContext } from './context'
import { evaluate, type EvalResult } from './evaluate'
import type { Profile } from './profile'
import { evaluationId, findCandidate, getEvaluation, loadFacts, writeEvaluation, type SourceKind } from './store'

const asJson = (v: unknown) => v as Prisma.InputJsonValue

/** Read one opportunity's document and evaluate it. One document fetch and one model call. */
export async function evaluateSource(kind: SourceKind, sourceId: string, by: string, now = new Date()): Promise<{ id: string; verdict: string; score: number | null; error: string | null }> {
  const c = await findCandidate(kind, sourceId)
  if (!c) throw new Error('That opportunity is no longer in the database.')
  const id = evaluationId(kind, sourceId)
  const base = { sourceKind: kind, sourceId, title: c.title, url: c.url, state: c.state, issuer: c.issuer, dueAt: c.dueAt, evaluatedAt: now, evaluatedBy: by }

  const doc = await fetchOpportunityText(c.url, c.title)
  if (doc.error && doc.text.trim().length < 200) {
    await writeEvaluation(id, { ...base, docUrls: doc.docUrls, textChars: doc.text.length, fetchError: doc.error, verdict: 'UNREAD', route: null, score: null })
    return { id, verdict: 'UNREAD', score: null, error: doc.error }
  }

  const profile = await readDocument({ title: c.title, url: c.url, text: doc.text, now })
  const facts = await loadFacts()
  const ctx = await loadContext({ ...profile, state: profile.state ?? c.state }, doc.text, c.issuerOrgId)
  const result = evaluate({ ...profile, state: profile.state ?? c.state }, facts, ctx, now)
  const due = profile.dates.due ? new Date(profile.dates.due) : c.dueAt
  await writeEvaluation(id, {
    ...base,
    title: profile.title || c.title,
    state: profile.state ?? c.state,
    issuer: profile.issuer ?? c.issuer,
    dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
    docUrls: doc.docUrls,
    textChars: doc.text.length,
    fetchError: null,
    profile: asJson(profile),
    result: asJson({ ...result, competitorsInText: ctx.competitorsInText, warmContactsAtIssuer: ctx.warmContactsAtIssuer }),
    verdict: result.verdict,
    route: result.route,
    score: result.score,
  })
  return { id, verdict: result.verdict, score: result.score, error: null }
}

/** Re-score from the stored profile after company facts change. No fetch, no model call. */
export async function rescore(id: string, now = new Date()): Promise<EvalResult | null> {
  const row = await getEvaluation(id)
  if (!row?.profile) return null
  const profile = row.profile as unknown as Profile
  const prev = (row.result ?? {}) as Partial<EvalResult> & { competitorsInText?: string[]; warmContactsAtIssuer?: number }
  const facts = await loadFacts()
  const result = evaluate(profile, facts, {
    pastWinners: prev.pastWinners ?? [],
    partners: prev.partners ?? [],
    warmContactsAtIssuer: prev.warmContactsAtIssuer ?? 0,
    competitorsInText: prev.competitorsInText ?? [],
  }, now)
  await writeEvaluation(id, {
    sourceKind: row.sourceKind, sourceId: row.sourceId, title: row.title, url: row.url,
    result: asJson({ ...result, competitorsInText: prev.competitorsInText ?? [], warmContactsAtIssuer: prev.warmContactsAtIssuer ?? 0 }),
    verdict: result.verdict, route: result.route, score: result.score,
  })
  return result
}
