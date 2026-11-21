import { MemberJourneyView } from '@/components/higher-ed/MemberJourneyView'

// Alumni › Members › one alum (W&J sample): five years with the college, each step with the office that acted.
const d = (s: string) => new Date(`${s}T12:00:00Z`)
const ITEMS = [
  { at: d('2026-10-02'), what: 'Made a gift', office: 'Office of Development' },
  { at: d('2026-07-14'), what: 'Search over: asks can resume after the quiet period', office: 'Office of Development' },
  { at: d('2026-07-10'), what: 'Reported a new job, and said the college helped', office: 'Center for Career Advising and Networking' },
  { at: d('2026-05-02'), what: 'Applied to Graduate Certificate in Professional Writing', office: 'Graduate and Continuing Studies' },
  { at: d('2026-04-20'), what: 'Opened a program for a skills gap: grant writing', office: 'Graduate and Continuing Studies' },
  { at: d('2026-03-03'), what: 'On Casey Delgado’s caseload', office: 'Center for Career Advising and Networking' },
  { at: d('2026-03-02'), what: 'In a search: donation asks paused', office: 'Office of Development' },
  { at: d('2026-03-02'), what: 'Answered a check-in: “I was laid off”', office: 'Center for Career Advising and Networking' },
  { at: d('2026-02-11'), what: 'Their employer filed a layoff notice', office: 'Office of Alumni Engagement' },
  { at: d('2024-11-20'), what: 'Answered a check-in: “All good”', office: 'Center for Career Advising and Networking' },
  { at: d('2023-06-01'), what: 'Joined the college’s career portal', office: 'Office of Alumni Engagement' },
]

export function CollegeJourney() {
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: '#A4343A', ['--primary-foreground' as string]: '#ffffff' }}>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <MemberJourneyView name="Dana Whitaker" classYear={2019} items={ITEMS} />
      </main>
    </div>
  )
}
