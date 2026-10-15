import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { TitleCandidate } from '@/lib/careers/title-match'

// "Look up any role": a plain GET search, so it works without scripts and the result is a link.
// Picking a title opens that role's card below, compared with the person's current work.
export function RoleLookup({ query, candidates }: { query: string; candidates: TitleCandidate[] }) {
  return (
    <div className="space-y-3">
      <form method="get" action="/dashboard/pivot-paths#look-up-a-role" role="search" className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Job title</span>
          <input
            name="lookup"
            defaultValue={query}
            placeholder="For example: product manager"
            className="block h-10 w-72 max-w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </label>
        <Button type="submit" variant="outline">
          Search job titles
        </Button>
      </form>
      {query && candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">We found no occupation for “{query}”. Try a shorter or more common title, such as “analyst” or “controller”.</p>
      )}
      {candidates.length > 0 && (
        <ul className="space-y-1 text-sm">
          {candidates.map((c) => (
            <li key={c.socCode}>
              <Link href={`/dashboard/pivot-paths?role=${encodeURIComponent(c.socCode)}#look-up-a-role`} className="text-primary underline underline-offset-4">
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
