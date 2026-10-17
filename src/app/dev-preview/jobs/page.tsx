import { MapPin, Search } from 'lucide-react'
import { PageHeader } from '@/components/candidate/PageHeader'
import { SectionPills } from '@/components/candidate/SectionPills'
import { JobRow, type JobRowData } from '@/components/candidate/JobRow'

const factors = (skills: string, culture: string): JobRowData['factors'] => [
  { label: 'Level', state: 'match', note: 'Executive roles are your level.' },
  { label: 'Skills', state: 'unknown', note: skills },
  { label: 'Culture', state: 'unknown', note: culture },
  { label: 'Salary', state: 'match', note: 'Posted range is at or above your target.' },
  { label: 'Goals', state: 'match', note: 'Full-time, on site or hybrid, as you asked.' },
]

const JOBS: JobRowData[] = [
  {
    id: '1',
    title: 'Chief Financial Officer',
    company: 'Arsenault',
    verdict: 'good',
    reason: 'You have led finance at a company this size.',
    fact: 'Few applicants: a search-firm role that is not on the big job boards. Posted 34 hours ago.',
    href: '#',
    factors: factors('Add your tools and we can check this.', 'Add what you like in a workplace and we can check this.'),
  },
  {
    id: '2',
    title: 'Executive Director',
    company: 'Byrdcliffe',
    verdict: 'strong',
    reason: 'Your nonprofit board work and finance background match what they ask for.',
    fact: 'Few applicants: an association board posting. Mention your membership or ties. Posted today.',
    href: '#',
    saved: true,
    factors: factors('Seven of nine listed skills match.', 'Collaborative, mission-led, which matches your answers.'),
  },
  {
    id: '3',
    title: 'Chief Operating Officer',
    company: 'Intercontinental Exchange',
    verdict: 'possible',
    reason: 'You have run operations, but not at this size yet.',
    fact: 'Many applicants: a large employer with over 100 open roles. Posted 3 days ago.',
    href: '#',
    factors: factors('Four of nine listed skills match.', 'Fast-paced and corporate, which may not match your answers.'),
  },
  {
    id: '4',
    title: 'President',
    company: 'Lemaitre Vascular',
    verdict: 'good',
    reason: 'You have led a P&L in a regulated industry.',
    fact: 'Posted 5 days ago. The current president retires December 31.',
    href: '#',
    factors: factors('Six of nine listed skills match.', 'Not enough information yet.'),
  },
]

export default function JobsPreview() {
  return (
    <>
      <PageHeader title="Find a job" intro="Roles that fit your background. For each one, we tell you why." />

      <form className="flex flex-wrap gap-3" role="search" aria-label="Search jobs">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Job title, skill or company</span>
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input className="h-11 w-full rounded-full border border-border bg-white pr-4 pl-10 text-base" placeholder='Try "VP finance" or company:Stripe' />
        </label>
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">City, state or remote</span>
          <MapPin className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input className="h-11 w-full rounded-full border border-border bg-white pr-4 pl-10 text-base" placeholder="City, state or Remote" />
        </label>
        <button type="submit" className="h-11 w-full rounded-full bg-action px-7 sm:w-auto text-base font-semibold text-action-foreground hover:brightness-95">
          Search jobs
        </button>
      </form>

      <SectionPills
        label="Parts of Find a job"
        current="jobs"
        items={[
          { key: 'jobs', label: 'Jobs', href: '#' },
          { key: 'unposted', label: 'Not posted yet', href: '#' },
          { key: 'independent', label: 'Independent work', href: '#' },
          { key: 'resources', label: 'Resources', href: '#' },
        ]}
      />

      <section aria-labelledby="results" className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
          <h2 id="results" className="text-base font-semibold text-ink">
            111 executive jobs in New York or remote
          </h2>
          <details className="relative">
            <summary className="cursor-pointer list-none text-sm font-medium text-brand underline underline-offset-4 [&::-webkit-details-marker]:hidden">Filters</summary>
            <div className="absolute right-0 z-10 mt-2 w-72 space-y-3 rounded-lg border border-border bg-white p-4 text-sm shadow-lg">
              <p className="font-medium text-ink">Work arrangement</p>
              <p className="text-muted-foreground">Any, remote, hybrid, on site</p>
              <p className="font-medium text-ink">Sort</p>
              <p className="text-muted-foreground">Best match, newest, highest pay</p>
            </div>
          </details>
        </div>
        <ul className="divide-y divide-border">
          {JOBS.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
        <div className="pt-4">
          <button type="button" className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted">
            Show 10 more
          </button>
        </div>
      </section>
    </>
  )
}
