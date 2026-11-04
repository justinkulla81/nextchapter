import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { FindTwoPane } from '@/components/dashboard/find/FindTwoPane'
import { entries } from './jobs-find-live'

// A member who searches from a public link (https://launchyournextchapter.com/jobs?q=...&loc=...) lands here, in the portal.
// It must read as the same search, only better: the same search box with their words in it, the results straight away,
// each one ranked for them with its reason. The tune card and the filters stay one line each and do not push the jobs down.
// Real list components, sample data. Dev-only.

export function FindFromPublicSearch() {
  const all = entries()
  return (
    <PreviewShell place="jobs" entry="find" part="jobs" wide>
      <PageHeader title="Executive jobs in New York" intro="Ranked for you. Each one says why it fits, and saving it builds your search plan." />
      <form action="#" role="search" className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="q">Job title or keyword</label>
        <input id="q" name="q" defaultValue="executive" className="h-11 min-w-0 flex-1 basis-56 rounded-lg border border-border bg-white px-3 text-base" />
        <label className="sr-only" htmlFor="loc">City or state</label>
        <input id="loc" name="loc" defaultValue="New York" className="h-11 min-w-0 flex-1 basis-40 rounded-lg border border-border bg-white px-3 text-base" />
        <button type="submit" className="h-11 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:opacity-90">Search jobs</button>
      </form>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
        <span><span className="font-semibold">Search 70% tuned.</span> <span className="text-muted-foreground">Two answers would add about 150 jobs.</span></span>
        <a href="#" className="font-medium text-brand underline underline-offset-4">Answer two questions</a>
        <a href="#" className="font-medium text-brand underline underline-offset-4">Filters and views</a>
      </p>
      <FindTwoPane items={all.map((e) => e.item)} details={Object.fromEntries(all.map((e) => [e.item.id, e.detail]))} summary={`${all.length} jobs, best fit first`} />
    </PreviewShell>
  )
}
