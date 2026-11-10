import 'server-only'
import { prisma } from '@/lib/prisma'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { PUBLIC } from '@/lib/seo/job-titles'
import { PLACE_MIN_SHOWN, type PlaceIndexRow, type TitlePlace } from '@/lib/seo/job-title-places'

// A role-in-a-place page redirects to the role page when fewer than PLACE_MIN_SHOWN of its stored listings are still public
// (getEntryPlaceLive). The stored rows are rebuilt twice a day while jobs close all day, so a small place drifts under the bar and the
// sitemap kept listing it: about a quarter of the entry-level sitemap redirected (14 of 60 sampled, 2026-11-10), which Search Console
// reports as "Page with redirect". This keeps the sitemap to the places that answer, with a margin for the six hours it is cached.

/** Places with at least this many stored listings are left out of the check: a few closures cannot take them under the bar. */
const SAFE_JOBS = 14
const MARGIN = 2
const READ_CHUNK = 100
const ID_CHUNK = 5_000

/** The places (index rows) whose page would answer now. Reads only the small places' stored rows, and checks their listing ids in batches. */
export async function placesThatAnswer(index: PlaceIndexRow[]): Promise<PlaceIndexRow[]> {
  const thin = index.filter((p) => p[3] < SAFE_JOBS)
  if (thin.length === 0) return index

  const rows = new Map<PlaceIndexRow, TitlePlace | null>()
  for (let i = 0; i < thin.length; i += READ_CHUNK) {
    const part = thin.slice(i, i + READ_CHUNK)
    const read = await Promise.all(part.map((p) => readBoardFigure<TitlePlace>(`entry-role-place:${p[0]}:${p[1]}`)))
    part.forEach((p, j) => rows.set(p, read[j]))
  }

  const ids = [...new Set([...rows.values()].flatMap((r) => r?.jobIds ?? []))]
  const live = new Set<string>()
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const found = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "ExclusiveJobPosting" WHERE id = ANY(${ids.slice(i, i + ID_CHUNK)}::text[]) AND ${PUBLIC}`
    for (const f of found) live.add(f.id)
  }

  const answers = new Set(thin.filter((p) => (rows.get(p)?.jobIds ?? []).filter((id) => live.has(id)).length >= PLACE_MIN_SHOWN + MARGIN))
  return index.filter((p) => p[3] >= SAFE_JOBS || answers.has(p))
}

