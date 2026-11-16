import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Reads of a whole large table in its physical order: one block range at a time (a TID range scan), so every heap block is read once and
 * in sequence. The id-keyset pages these replace walked the primary-key index, and because ids are random and two thirds of
 * ExclusiveJobPosting's rows are archived, each 20,000-row page fetched ~26,000 scattered blocks (~210 MB): a full pass read the 2 GB heap
 * about three times over, took 10-50 s a page, and pushed the rest of the site's data out of the 1 GB buffer cache (weekly database
 * report of 2026-11-16: the two such loaders were #3 and #4 by time, cache hit rate 82.3%). A 10,000-block range measured 0.4 s and 9,478
 * blocks read for 29,146 rows.
 *
 * The ranges are not one snapshot: a row updated while a pass runs can be read twice (callers keep one copy per id) or, when its new
 * version lands in a range already read, missed until the next pass.
 */

/** Blocks per range: ~8,000 × 8 KB = 64 MB of heap, about 20,000 live jobs today (at most ~50,000 if every row in it were live). */
export const HEAP_RANGE_BLOCKS = 8_000

/** The table's heap size in blocks, now. Rows added past it during a pass are read by the last range, which has no upper end. */
export async function heapBlockCount(table: 'ExclusiveJobPosting'): Promise<number> {
  const rows = await prisma.$queryRaw<{ blocks: bigint | number }[]>`
    SELECT (pg_relation_size(${`"${table}"`}::regclass) / current_setting('block_size')::int)::bigint AS blocks`
  return Number(rows[0]?.blocks ?? 0)
}

export interface HeapRange {
  /** First tid of the range, '(block,0)'. */
  from: string
  /** First tid after the range, or null for the last range, which runs to the end of the table. */
  to: string | null
}

/** The ranges covering `blocks` blocks; always at least one, and the last is open-ended. */
export function heapRanges(blocks: number, size = HEAP_RANGE_BLOCKS): HeapRange[] {
  const out: HeapRange[] = []
  for (let start = 0; start + size < blocks; start += size) out.push({ from: `(${start},0)`, to: `(${start + size},0)` })
  const last = out.length * size
  out.push({ from: `(${last},0)`, to: null })
  return out
}

/** The WHERE condition for one range (planned as a Tid Range Scan; an OR on the upper end would turn it into a full scan). */
export function heapRangeSql(r: HeapRange): Prisma.Sql {
  return r.to
    ? Prisma.sql`ctid >= ${r.from}::tid AND ctid < ${r.to}::tid`
    : Prisma.sql`ctid >= ${r.from}::tid`
}
