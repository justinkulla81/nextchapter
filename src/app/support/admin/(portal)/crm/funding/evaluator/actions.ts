'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { evaluateSource, rescore } from '@/lib/bid-evaluator/run'
import { evaluatedKeys, getEvaluation, loadCandidates, loadFacts, loadLibrary, saveFacts, saveLibraryBlock, type SourceKind } from '@/lib/bid-evaluator/store'
import { draftResponse } from '@/lib/bid-evaluator/draft'
import { FACT_DEFS, LIBRARY_DEFS } from '@/lib/bid-evaluator/facts'
import type { Profile } from '@/lib/bid-evaluator/profile'
import type { EvalResult } from '@/lib/bid-evaluator/evaluate'

const BASE = '/support/admin/crm/funding/evaluator'
const KINDS: SourceKind[] = ['FEDERAL', 'BOARD_BID', 'CRM_GRANT']
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.').slice(0, 200)

export async function evaluateOneAction(form: FormData) {
  const user = await requireAdmin()
  const kind = String(form.get('kind')) as SourceKind
  const sourceId = String(form.get('sourceId') ?? '')
  if (!KINDS.includes(kind) || !sourceId) redirect(`${BASE}?error=${encodeURIComponent('Unknown opportunity.')}`)
  let target = BASE
  try {
    const r = await evaluateSource(kind, sourceId, user.email ?? user.id)
    captureServerEvent(user.id, 'bid_evaluated', { evaluationId: r.id, sourceKind: kind, sourceId, verdict: r.verdict, score: r.score, unread: !!r.error })
    target = `${BASE}/${r.id}`
  } catch (e) {
    target = `${BASE}?error=${encodeURIComponent(`Could not evaluate: ${msg(e)}`)}`
  }
  revalidatePath(BASE)
  redirect(target)
}

/** Evaluate the next few unread opportunities, soonest due first. Three per click keeps one request under the time limit. */
export async function evaluateNextAction() {
  const user = await requireAdmin()
  const [cands, done] = await Promise.all([loadCandidates(), evaluatedKeys()])
  const next = cands.filter((c) => !done.has(`${c.sourceKind}:${c.sourceId}`)).slice(0, 3)
  const results: string[] = []
  for (const c of next) {
    try {
      const r = await evaluateSource(c.sourceKind, c.sourceId, user.email ?? user.id)
      results.push(r.verdict)
    } catch {
      results.push('ERROR')
    }
  }
  captureServerEvent(user.id, 'bid_batch_evaluated', { count: next.length, verdicts: results })
  revalidatePath(BASE)
  redirect(`${BASE}?done=${next.length}`)
}

export async function draftAction(form: FormData) {
  const user = await requireAdmin()
  const id = String(form.get('id') ?? '')
  const row = await getEvaluation(id)
  if (!row?.profile || !row.result) redirect(`${BASE}/${id}?error=${encodeURIComponent('Evaluate it first.')}`)
  let error = ''
  try {
    const now = new Date()
    const [facts, library] = await Promise.all([loadFacts(), loadLibrary()])
    const draft = await draftResponse({ profile: row.profile as unknown as Profile, result: row.result as unknown as EvalResult, facts, library, now })
    await prisma.bidEvaluation.update({ where: { id }, data: { draft: draft as unknown as Prisma.InputJsonValue, draftedAt: now } })
    captureServerEvent(user.id, 'bid_draft_generated', { evaluationId: id, sourceKind: row.sourceKind, verdict: row.verdict, sections: draft.sections.length, missingFacts: draft.missingFacts.length })
  } catch (e) {
    error = `Could not draft: ${msg(e)}`
  }
  revalidatePath(`${BASE}/${id}`)
  redirect(`${BASE}/${id}${error ? `?error=${encodeURIComponent(error)}` : '#draft'}`)
}

/** Save company facts, then re-score every evaluated opportunity from its stored profile (no document reads, no model calls). */
export async function saveFactsAction(form: FormData) {
  const user = await requireAdmin()
  const values: Record<string, string> = {}
  for (const d of FACT_DEFS) values[d.key] = String(form.get(d.key) ?? '')
  const changed = await saveFacts(values, user.email ?? user.id)
  if (changed.length) {
    const rows = await prisma.bidEvaluation.findMany({ where: { profile: { not: undefined }, verdict: { notIn: ['UNREAD'] } }, select: { id: true }, take: 500 })
    for (const r of rows) await rescore(r.id).catch(() => null)
  }
  captureServerEvent(user.id, 'bid_company_facts_saved', { changedKeys: changed })
  revalidatePath(BASE)
  redirect(`/support/admin/crm/funding/company-facts?saved=${changed.length}`)
}

export async function saveLibraryAction(form: FormData) {
  const user = await requireAdmin()
  const key = String(form.get('key') ?? '')
  if (!LIBRARY_DEFS.some((d) => d.key === key)) redirect('/support/admin/crm/funding/company-facts')
  await saveLibraryBlock(key, String(form.get('body') ?? ''), user.email ?? user.id)
  captureServerEvent(user.id, 'bid_content_saved', { key })
  redirect(`/support/admin/crm/funding/company-facts?saved=1#lib-${key}`)
}
