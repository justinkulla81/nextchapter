// Pure decisions for the Job Search Daily cron (src/app/api/cron/job-search-daily/route.ts), kept here so they can be tested.

/**
 * The run fails (and the job watchdog emails) when any member was left unsent: skipped for time, or failed (their build threw or hit
 * the per-member cap). On 2026-11-09 every member hit the cap and the run was still recorded OK, so nothing alerted.
 */
export function runStatus(counts: { failed: number; skippedForTime: number }): 200 | 500 {
  return counts.failed > 0 || counts.skippedForTime > 0 ? 500 : 200
}

/** Waits for `work` up to `ms`. Never throws: the answer says whether it finished, how long it took, and why not. */
export async function finishesWithin(work: Promise<unknown>, ms: number): Promise<{ ok: true; ms: number } | { ok: false; ms: number; reason: string }> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`not finished after ${ms}ms`)), ms)
      }),
    ])
    return { ok: true, ms: Date.now() - started }
  } catch (error) {
    return { ok: false, ms: Date.now() - started, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}
