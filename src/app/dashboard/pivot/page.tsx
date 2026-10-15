import { redirect } from 'next/navigation'

// "Explore other roles" is now part of Pivot paths. Old links and bookmarks land there, keeping the
// pay choice and the occupation search they carried.
export default async function ExploreOtherRolesRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const next = new URLSearchParams()
  const floor = one(params.floor)
  if (floor) next.set('floor', floor)
  if (one(params.change) === '1') next.set('change', '1')
  const q = one(params.q)
  if (q) next.set('q', q)
  const query = next.toString()
  redirect(`/dashboard/pivot-paths${query ? `?${query}` : ''}${floor && !next.has('change') ? '#similar-skills' : ''}`)
}
