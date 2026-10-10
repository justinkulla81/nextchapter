// Shared helper for the one-off research runs: calls Claude, meters the exact
// cost from the usage block, appends to a ledger, and refuses to pass a cap.
import 'dotenv/config'
import { appendFileSync, existsSync, readFileSync } from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-haiku-4-5-20251001'
// List prices (USD): Haiku 4.5 $1 / $5 per million tokens in / out; web search $10 per 1,000.
const PRICE = { inPerM: 1, outPerM: 5, perSearch: 0.01 }
const LEDGER = path.join(process.cwd(), 'data', 'geo', 'research', 'cost-ledger.jsonl')
const client = new Anthropic()

export function spent(step: string): number {
  if (!existsSync(LEDGER)) return 0
  return readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.step === step).reduce((s, r) => s + r.cost, 0)
}

export async function ask(step: string, cap: number, prompt: string, opts: { searches?: number; fetches?: number; maxTokens?: number; system?: string } = {}) {
  if (spent(step) >= cap) throw new Error(`cap reached for ${step}: $${spent(step).toFixed(2)} >= $${cap}`)
  const tools: unknown[] = []
  if (opts.searches) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: opts.searches })
  if (opts.fetches) tools.push({ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: opts.fetches, max_content_tokens: 25000 })
  let r: { usage: unknown; content: { type: string; text?: string }[] } | undefined
  for (let attempt = 0; attempt < 4 && !r; attempt++) {
    try {
      r = await (client.beta.messages.create as unknown as (a: unknown) => Promise<NonNullable<typeof r>>)({
        model: MODEL, max_tokens: opts.maxTokens ?? 4000, system: opts.system, betas: ['web-fetch-2025-09-10'],
        ...(tools.length ? { tools } : {}), messages: [{ role: 'user', content: prompt }],
      })
    } catch (e) {
      const status = (e as { status?: number }).status
      if (attempt === 3 || (status && status < 429 && status !== 408)) throw e
      await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)))
    }
  }
  if (!r) throw new Error('no response')
  const u = r.usage as unknown as { input_tokens: number; output_tokens: number; server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number } }
  const searches = u.server_tool_use?.web_search_requests ?? 0
  const cost = (u.input_tokens * PRICE.inPerM + u.output_tokens * PRICE.outPerM) / 1e6 + searches * PRICE.perSearch
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), step, in: u.input_tokens, out: u.output_tokens, searches, fetches: u.server_tool_use?.web_fetch_requests ?? 0, cost }) + '\n')
  const text = r.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  return { text, cost }
}

/** The first JSON array/object in a model reply. */
export function jsonOf<T>(text: string): T | null {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text]
  const body = (m[1] as string).trim()
  const start = body.search(/[\[{]/)
  if (start < 0) return null
  for (let end = body.length; end > start; end--) {
    const ch = body[end - 1]
    if (ch !== ']' && ch !== '}') continue
    try { return JSON.parse(body.slice(start, end)) as T } catch { /* shorten */ }
  }
  return null
}

/** Runs fn over items with a small worker pool. */
export async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i) }
  }))
}
