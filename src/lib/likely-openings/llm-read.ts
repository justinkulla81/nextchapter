// Claude Haiku second pass over an 8-K Item 5.02 section the rules already
// flagged. The rules are ~85-90% right; their misses are judgment calls a
// regex can't make: "President" of a division vs the company, a merger
// closing that lists a dozen boilerplate appointments, a promotion read as a
// departure. One Haiku call per flagged filing (~$0.003), cached per
// accession number so a re-run never pays twice. Any failure falls back to
// the rules' read.

import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type Anthropic from '@anthropic-ai/sdk'
import { ROLE_LABELS, type OfficerRole } from './roles'
import { execSignalsFrom, type ExecSignalDraft, type Item502Read } from './parse-8k'

export const LLM_READ_MODEL = 'claude-haiku-4-5-20251001'
// Haiku 4.5 list price, US dollars per token.
export const HAIKU_INPUT_USD_PER_TOKEN = 1 / 1_000_000
export const HAIKU_OUTPUT_USD_PER_TOKEN = 5 / 1_000_000
export const MAX_SECTION_CHARS = 6000

const ROLE_CODES = Object.keys(ROLE_LABELS) as [OfficerRole, ...OfficerRole[]]

export const llmReadSchema = z.object({
  changes: z.array(
    z.object({
      role: z.enum([...ROLE_CODES, 'OTHER']),
      scope: z.enum(['company', 'division']),
      change: z.enum(['departure', 'appointment', 'interim', 'promotion']),
      permanentSuccessorNamed: z.boolean(),
    })
  ),
  mergerDriven: z.boolean(),
  summary: z.string(),
})
export type LlmRead = z.infer<typeof llmReadSchema>

export function usageCostUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * HAIKU_INPUT_USD_PER_TOKEN + outputTokens * HAIKU_OUTPUT_USD_PER_TOKEN
}

function prompt(companyName: string, section: string): string {
  return `Below is Item 5.02 of an SEC Form 8-K filed by ${companyName}. List each executive officer change it reports.

For each change:
- role: the officer seat, normalized. CEO, PRESIDENT, CFO, COO, CTO, CIO (also Chief Digital/Information Officer), CHRO (Chief People/Human Resources/Talent Officer), GC (General Counsel or Chief Legal Officer), CMO, CRO (Chief Revenue/Commercial/Sales Officer), CPO (Chief Product Officer), CAO (Chief/Principal Accounting Officer), CSO (Chief Strategy Officer), CMEDO (Chief Medical Officer). Anything else (directors, board chairs, vice presidents, other officers) is OTHER.
- scope: "company" if it is the seat for the whole filer (or its parent). "division" if it is the head of a business unit, segment, subsidiary, region or brand (e.g. "President of the Americas", "President, Industrial Segment", "CEO of our Acme Bank subsidiary").
- change: "departure" (resigning, retiring, terminated, leaving the seat), "appointment" (permanent new person in the seat), "interim" (interim/acting person in the seat), or "promotion" (an existing employee moved up into the seat). When someone is promoted out of another officer seat, also list that seat they leave as a separate "departure".
- permanentSuccessorNamed: for a departure, true if the filing names a permanent (not interim) successor for that seat; otherwise false. Someone only taking on the duties for now (e.g. "will serve as principal financial officer" until a CFO is hired) is interim, not a permanent successor.

A person who takes on an extra title while keeping their current seat has not departed that seat. Someone who resigns only as a director but keeps an officer title is not an officer change.

Ignore changes that the filing says were previously disclosed, biographies of past jobs, compensation terms, and seats someone keeps.

mergerDriven: true if the officer changes happen because of a merger, acquisition, business combination or de-SPAC closing (e.g. "in connection with the closing of the Merger, each officer of the Company resigned...").

summary: one plain-language sentence for a job seeker saying what happened, naming ${companyName} and the seat (e.g. "${companyName}'s Chief Financial Officer is retiring at year-end, and the controller will serve as interim CFO."). No legal jargon, no person's age.

Item 5.02 text:
${section.slice(0, MAX_SECTION_CHARS)}`
}

export interface LlmReadResult {
  read: LlmRead
  inputTokens: number
  outputTokens: number
}

/** One Haiku call. Throws on any API or parse failure — callers fall back to the rules. */
export async function callHaiku(client: Anthropic, companyName: string, section: string): Promise<LlmReadResult> {
  const stream = client.messages.stream({
    model: LLM_READ_MODEL,
    max_tokens: 1024,
    thinking: { type: 'disabled' },
    output_config: { format: zodOutputFormat(llmReadSchema) },
    messages: [{ role: 'user', content: prompt(companyName, section) }],
  })
  const message = await stream.finalMessage()
  const read = message.parsed_output
  if (!read) throw new Error(`no parsed output (stop_reason ${message.stop_reason})`)
  return { read, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }
}

/**
 * Turn Haiku's read into signals. Pure. Division-level seats and OTHER are
 * dropped; a merger-driven filing yields nothing (its "appointments" are
 * closing boilerplate and its departures leave no seat to fill). The search
 * flag still comes from the rules' regex.
 */
export function signalsFromLlmRead(companyName: string, llm: LlmRead, rules: Item502Read): ExecSignalDraft[] {
  if (llm.mergerDriven) return []
  const departed = new Set<OfficerRole>()
  const appointed = new Set<OfficerRole>()
  const interim = new Set<OfficerRole>()
  for (const c of llm.changes) {
    if (c.role === 'OTHER' || c.scope !== 'company') continue
    if (c.change === 'interim') interim.add(c.role)
    else if (c.change === 'appointment' || c.change === 'promotion') appointed.add(c.role)
    else if (c.permanentSuccessorNamed) appointed.add(c.role)
    else departed.add(c.role)
  }
  for (const r of interim) appointed.delete(r)
  const openings = [...new Set([...departed, ...interim])].filter((r) => !appointed.has(r))
  const read: Item502Read = {
    openings,
    appointed: [...appointed],
    interim: [...interim].filter((r) => openings.includes(r)),
    searchUnderway: rules.searchUnderway,
  }
  const lead = llm.summary.trim().replace(/\s+/g, ' ')
  return execSignalsFrom(companyName, read, lead ? (/[.!?]$/.test(lead) ? lead : `${lead}.`) : undefined)
}

export interface CachedFilingRead {
  model: string
  result: LlmRead
  inputTokens: number
  outputTokens: number
}

/** Per-accession store for Haiku reads. get() throwing means "cache unavailable" — no call is made then. */
export interface FilingReadCache {
  get(accessionNumber: string): Promise<CachedFilingRead | null>
  set(accessionNumber: string, entry: CachedFilingRead): Promise<void>
}

export interface LlmPassStats {
  llmCalls: number
  llmCacheHits: number
  llmFailures: number
  llmSkipped: number
  inputTokens: number
  outputTokens: number
}

export function emptyLlmStats(): LlmPassStats {
  return { llmCalls: 0, llmCacheHits: 0, llmFailures: 0, llmSkipped: 0, inputTokens: 0, outputTokens: 0 }
}

export type ExecSignalsSource = 'none' | 'rules' | 'llm' | 'cache'

/**
 * Signals for one Item 5.02 section: rules first; when the rules see a
 * signal, a cached or fresh Haiku read decides the final signals. Never
 * throws — any cache or API failure keeps the rules' signals.
 */
export async function execSignalsWithLlm(opts: {
  accessionNumber: string
  companyName: string
  section: string
  rules: Item502Read
  cache: FilingReadCache
  client: () => Anthropic
  stats: LlmPassStats
  log?: (msg: string) => void
}): Promise<{ signals: ExecSignalDraft[]; source: ExecSignalsSource }> {
  const { accessionNumber, companyName, section, rules, cache, stats, log = () => {} } = opts
  const ruleSignals = execSignalsFrom(companyName, rules)
  if (ruleSignals.length === 0) return { signals: [], source: 'none' }

  let cached: CachedFilingRead | null
  try {
    cached = await cache.get(accessionNumber)
  } catch (e) {
    // No cache, no call: spending without a cache could re-bill on every run.
    stats.llmSkipped++
    log(`read cache unavailable for ${accessionNumber}: ${e instanceof Error ? e.message : e}`)
    return { signals: ruleSignals, source: 'rules' }
  }
  if (cached) {
    stats.llmCacheHits++
    const parsed = llmReadSchema.safeParse(cached.result)
    if (parsed.success) return { signals: signalsFromLlmRead(companyName, parsed.data, rules), source: 'cache' }
  }

  try {
    const res = await callHaiku(opts.client(), companyName, section)
    stats.llmCalls++
    stats.inputTokens += res.inputTokens
    stats.outputTokens += res.outputTokens
    try {
      await cache.set(accessionNumber, { model: LLM_READ_MODEL, result: res.read, inputTokens: res.inputTokens, outputTokens: res.outputTokens })
    } catch (e) {
      log(`read cache write failed for ${accessionNumber}: ${e instanceof Error ? e.message : e}`)
    }
    return { signals: signalsFromLlmRead(companyName, res.read, rules), source: 'llm' }
  } catch (e) {
    stats.llmFailures++
    log(`Haiku read failed for ${accessionNumber}: ${e instanceof Error ? e.message : e}`)
    return { signals: ruleSignals, source: 'rules' }
  }
}
