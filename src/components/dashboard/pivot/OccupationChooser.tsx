import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { TitleCandidate } from '@/lib/careers/title-match'
import { confirmOccupation } from '@/app/dashboard/pivot/actions'
import { PivotActionForm } from '@/components/dashboard/pivot/PivotActionForm'

// Shown when we can't tell which occupation the candidate's latest job is. We list
// the closest ones and let them pick, rather than guess. Search is a plain GET form,
// so it works without scripts and the result is a shareable URL.
export function OccupationChooser({
  heading,
  intro,
  candidates,
  query,
}: {
  heading: string
  intro: string
  candidates: TitleCandidate[]
  query: string
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground">{intro}</p>
        </div>

        <form method="get" action="/dashboard/pivot" className="flex flex-wrap items-end gap-2" role="search">
          <input type="hidden" name="change" value="1" />
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Search for a job title</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="For example: financial controller"
              className="block h-10 w-72 max-w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
          <Button type="submit">Search job titles</Button>
        </form>

        {candidates.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {candidates.map((c) => (
              <li key={c.socCode} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="text-sm text-foreground">{c.title}</span>
                <PivotActionForm
                  action={confirmOccupation}
                  fields={[{ name: 'socCode', value: c.socCode }]}
                  label="This is my job"
                  pendingLabel="Saving…"
                  ariaLabel={`Use ${c.title} as my current occupation`}
                />
              </li>
            ))}
          </ul>
        ) : (
          query && (
            <p className="text-sm text-muted-foreground">
              Nothing matched “{query}”. Try a shorter or more general title, such as “accountant” or “project manager”.
            </p>
          )
        )}
      </CardContent>
    </Card>
  )
}
