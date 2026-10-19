import { JobSearchForm } from '@/components/home/JobSearchForm'

// The homepage's job section: only the search box. Results, and what you don't get without a
// profile, are on /jobs.
export function HomeJobSearch() {
  return (
    <section className="bg-off-white py-14" aria-labelledby="home-board-heading">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 id="home-board-heading" className="font-display text-3xl font-semibold tracking-tight text-ink text-balance">
            Look around first. No account needed.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Search current openings. They are not matched to you.</p>
        </div>
        <div className="mt-8">
          <JobSearchForm source="home" />
        </div>
      </div>
    </section>
  )
}
