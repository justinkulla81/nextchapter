import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { pickTitle } from './title-tests'

interface State {
  status: string
  winner: string | null
}

// One read an hour per test, shared by every page of the type. A failed read throws inside the cached function, which Next does not store.
const read = unstable_cache(
  async (key: string): Promise<State | null> => prisma.seoTitleTest.findUnique({ where: { key }, select: { status: true, winner: true } }),
  ['seo-title-test'],
  { revalidate: 3600, tags: ['seo-title-test'] },
)

/** The title for a page in a title test: the winner once decided, the page's arm while running, the current title when there is no test row or the read fails. */
export async function testedTitle<T>(key: string, path: string, current: T, alternate: T): Promise<T> {
  try {
    return pickTitle(await read(key), path, current, alternate)
  } catch {
    return current
  }
}
