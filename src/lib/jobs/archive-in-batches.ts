/**
 * Runs a bounded UPDATE over and over until it touches fewer rows than the batch size, or the time budget is spent.
 *
 * The full ncrawl sync archives every listing it did not confirm. Done as one statement that touched ~250,000 rows
 * after a missed fortnight, it outran the database's 2-minute statement limit, failed with a 500 and archived nothing,
 * and each failed night made the next backlog bigger. In batches each statement stays short, and a call that runs out
 * of budget reports `done: false` so the caller finalizes again (the work is idempotent: it only ever picks rows
 * that are still stale).
 */
export async function archiveInBatches(
  runBatch: (limit: number) => Promise<number>,
  opts: { batchSize?: number; budgetMs?: number; now?: () => number } = {},
): Promise<{ archived: number; done: boolean }> {
  const batchSize = opts.batchSize ?? 5_000
  const budgetMs = opts.budgetMs ?? 200_000
  const now = opts.now ?? Date.now
  const t0 = now()
  let archived = 0
  let lastMs = 0
  for (;;) {
    // Do not start a batch the budget cannot hold, assuming it takes as long as the last one.
    if (archived > 0 && now() - t0 + lastMs > budgetMs) return { archived, done: false }
    const started = now()
    const n = await runBatch(batchSize)
    lastMs = now() - started
    archived += n
    if (n < batchSize) return { archived, done: true }
  }
}
