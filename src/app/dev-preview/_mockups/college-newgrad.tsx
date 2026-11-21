import { CareerPathsView } from '@/components/higher-ed/CareerPathsView'
import { FirstFiveYearsView, fiveYearSteps } from '@/components/higher-ed/FirstFiveYears'
import type { PathRole } from '@/lib/higher-ed/career-paths'

// Candidate › Learn's career paths and Home's five-year timeline (W&J sample): an Economics graduate of 2025.
const audit = { key: 'audit:1', kind: 'audit' as const, name: 'Data Analysis for Decision-Making', detail: 'Spring 2027', skills: ['data analysis', 'excel', 'python'], href: '#' }
const ROLES: PathRole[] = [
  { title: 'Financial analyst', skills: [{ name: 'Mathematics', have: true, offerings: [] }, { name: 'Critical Thinking', have: true, offerings: [] }, { name: 'Microsoft Excel', have: false, offerings: [audit] }, { name: 'SQL', have: false, offerings: [] }] },
  { title: 'Budget analyst', skills: [{ name: 'Reading Comprehension', have: true, offerings: [] }, { name: 'Data analysis', have: false, offerings: [audit] }, { name: 'Oracle PeopleSoft', have: false, offerings: [] }] },
]

export function CollegeNewGrad() {
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: '#A4343A', ['--primary-foreground' as string]: '#ffffff' }}>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <FirstFiveYearsView
          college="Washington & Jefferson College"
          steps={fiveYearSteps(2025, [{ kind: 'M6', status: 'RESPONDED' }], 10, new Date('2026-11-21T00:00:00Z'))}
          endsYear={2030}
          helper="Your advisor is Casey Delgado, at Center for Career Advising and Networking (CCAN)."
        />
        <CareerPathsView majorLabel="Economics" roles={ROLES} college="Washington & Jefferson College" slug="washjeff" student={false} />
      </main>
    </div>
  )
}
