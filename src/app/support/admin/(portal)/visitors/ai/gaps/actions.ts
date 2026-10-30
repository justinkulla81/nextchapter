'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { runCitationCheck } from '@/lib/ai-visibility/run'
import { PROVIDERS } from '@/lib/ai-visibility/providers'

// The one-off baseline pass for an assistant whose key exists only in production. Each click asks the next BATCH unanswered
// questions on that one assistant under its own budget, so a click fits a function's time limit and cannot spend past the
// budget. The standing monthly cap is not changed. "Unanswered" means no answer since BASELINE_SINCE.
const BASELINE_SINCE = new Date('2026-10-30T00:00:00Z')
const BATCH = 60
const BUDGET_PER_BATCH_USD = 3

export type BatchResult = { ok: true; asked: number; cited: number; spentUsd: number; skippedForCap: boolean } | { ok: false; message: string }

export async function runBaselineBatch(providerId: string): Promise<BatchResult> {
  await requireAdmin()
  const p = PROVIDERS.find((x) => x.id === providerId)
  if (!p || !p.enabled()) return { ok: false, message: 'That assistant has no key in this environment.' }
  try {
    const r = await runCitationCheck({ all: true, providerIds: [providerId], budgetUsd: BUDGET_PER_BATCH_USD, concurrency: 8, skipAnsweredSince: BASELINE_SINCE, maxPerProvider: BATCH })
    revalidatePath('/support/admin/visitors/ai/gaps')
    return { ok: true, asked: r.asked, cited: r.cited, spentUsd: r.spentUsd, skippedForCap: r.skippedForCap }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message.slice(0, 200) : 'The run failed. Try again.' }
  }
}
