import type { CSSProperties } from 'react'
import { PortalTypeBar } from '@/components/partners/PortalTypeBar'
import { PORTAL_TYPES, type PortalType } from '@/lib/partners/portal-types'
import type { PartnerBrand } from '@/lib/partners/brand'
import { Squiggle } from '@/components/ui/squiggle'
import { Highlight } from '@/components/ui/highlight'
import { cn } from '@/lib/utils'

// The portal look (owner decision, 2026-11-17): the partner portals take the candidate site's look (white page, serif
// headline in navy ink, squiggle, one orange action, tinted panels) and each portal is told apart by its own type color:
// the squiggle, the active menu item and one signature tint. The customer's brand stays a logo, a name and the thin rule
// under the top bar; it no longer colors the buttons. Working tables stay dense (40px rows). Every name and figure here is
// invented sample data.

interface Row {
  title: string
  why: string
  action: string
}

interface TableRow {
  cells: string[]
}

interface PortalLook {
  type: PortalType
  use?: string
  brand: PartnerBrand
  /** The signature tint: the panel for "needs you" and the active menu item. Dark text on it passes AA. */
  tint: string
  nav: string[]
  active: string
  eyebrow: string
  title: string
  intro: string
  action: string
  needsTitle: string
  needs: Row[]
  stats: { value: string; label: string; source: string; highlight?: boolean }[]
  tableTitle: string
  tableLink: string
  columns: string[]
  rows: TableRow[]
}

const LOOKS: Record<PortalType, PortalLook> = {
  employer: {
    type: 'employer',
    use: 'Outplacement',
    brand: { name: 'Northwind Foods', logoUrl: null, accent: '#f4a259' },
    tint: '#e7f0fb',
    nav: ['Home', 'People', 'Invite', 'Reporting', 'Compliance', 'Settings'],
    active: 'Home',
    eyebrow: 'Tuesday, November 17 · Week 6 of the Columbus program',
    title: 'Good morning, Dana',
    intro: '61 of your 212 people have landed. Three things need you this week.',
    action: 'Invite the next group',
    needsTitle: 'Needs you this week',
    needs: [
      { title: '38 people have not signed in yet', why: 'They were invited on November 2. A reminder from you doubles the join rate.', action: 'Send a reminder' },
      { title: 'The WARN notice for the Dayton plant is due December 1', why: 'Your compliance record is missing the notice date for 14 people.', action: 'Add the dates' },
      { title: 'Finance asked for the October report', why: 'It is ready: placements, time to land and pay against previous pay.', action: 'Download the report' },
    ],
    stats: [
      { value: '61', label: 'Landed a new role', source: 'Reported by your people, confirmed by offer letters', highlight: true },
      { value: '9.4 wks', label: 'Median time to land', source: 'From their last day at Northwind' },
      { value: '97%', label: 'Pay against previous pay', source: 'Median, from the 44 who shared pay' },
    ],
    tableTitle: 'Latest from your people',
    tableLink: 'See all 212',
    columns: ['Person', 'Role before', 'Status', 'Last active'],
    rows: [
      { cells: ['Marcus Bell', 'Plant controller', 'Landed · Senior controller', 'Today'] },
      { cells: ['Priya Raman', 'Supply planner', 'Interviewing (3)', 'Today'] },
      { cells: ['Tom Okafor', 'HR business partner', 'Applying', 'Yesterday'] },
      { cells: ['Lena Fischer', 'Quality manager', 'Interviewing (1)', '2 days ago'] },
      { cells: ['Andre Silva', 'Logistics lead', 'Not signed in', 'Never'] },
    ],
  },
  higher_ed: {
    type: 'higher_ed',
    use: 'Career services',
    brand: { name: 'Riverside College', logoUrl: null, accent: '#d9b84a' },
    tint: '#fff1e0',
    nav: ['Home', 'Students', 'Alumni', 'Employers', 'Events', 'Reports', 'Settings'],
    active: 'Home',
    eyebrow: 'Tuesday, November 17 · Fall term, week 12',
    title: 'Good morning, Jordan',
    intro: '412 seniors are on NextChapter. 74 have an offer, and 19 have gone quiet.',
    action: 'Message the class of 2026',
    needsTitle: 'Needs you this week',
    needs: [
      { title: '19 seniors have not been active in three weeks', why: 'Most have no résumé on file. A note from career services brings half of them back.', action: 'See the 19' },
      { title: 'Midwest Mutual wants six finance interns', why: 'They posted on November 14. Eleven of your juniors match the brief.', action: 'Share with the 11' },
      { title: 'The provost asked for first-destination numbers', why: 'The fall snapshot is ready for the class of 2025.', action: 'Open the snapshot' },
    ],
    stats: [
      { value: '74', label: 'Seniors with an offer', source: 'Reported by students this term', highlight: true },
      { value: '63%', label: 'Seniors with a scored résumé', source: '260 of 412' },
      { value: '28', label: 'Employers hiring your students', source: 'Posted in the last 30 days' },
    ],
    tableTitle: 'Your caseload',
    tableLink: 'See all students',
    columns: ['Student', 'Major', 'Next step', 'Last active'],
    rows: [
      { cells: ['Ava Thompson', 'Accounting', 'Offer to decide by Dec 1', 'Today'] },
      { cells: ['Noah Kim', 'Computer science', 'Second interview Thursday', 'Today'] },
      { cells: ['Maria Lopez', 'Nursing', 'Résumé scored C, fixes ready', 'Yesterday'] },
      { cells: ['Ethan Brooks', 'Marketing', 'No applications yet', '4 days ago'] },
      { cells: ['Zoe Chen', 'Economics', 'Applying (6)', '5 days ago'] },
    ],
  },
  workforce: {
    type: 'workforce',
    use: 'Workforce boards',
    brand: { name: 'Tri-County Workforce Board', logoUrl: null, accent: '#7fb7e0' },
    tint: '#e6f4ee',
    nav: ['Home', 'People', 'Employers', 'Partners', 'Funding', 'Jobs', 'Market', 'Reports'],
    active: 'Home',
    eyebrow: 'Tuesday, November 17 · Program year 2026',
    title: 'Good morning, Sam',
    intro: 'Two layoffs were filed in your region this week. 340 people may need you.',
    action: 'Answer the Acme Logistics layoff',
    needsTitle: 'Needs you this week',
    needs: [
      { title: 'Acme Logistics filed a WARN notice for 220 jobs', why: 'Filed November 15, cuts start January 10. Nobody has contacted the employer yet.', action: 'Log the first call' },
      { title: 'Halden Health is cutting 120 jobs in Springfield', why: 'From a news story on November 16, not yet filed. 80 are clinical admin roles.', action: 'Open the layoff' },
      { title: 'The state talent grant report is due November 30', why: 'Households served and cost per household are filled in. Proof is missing for 12.', action: 'Finish the report' },
    ],
    stats: [
      { value: '1,180', label: 'People served this year', source: 'Signed up through your pages and partners', highlight: true },
      { value: '412', label: 'Back at work', source: 'Reported by participants' },
      { value: '$2,140', label: 'Cost per person placed', source: 'From the funding ledger' },
    ],
    tableTitle: 'Layoffs in your region',
    tableLink: 'See all 14',
    columns: ['Employer', 'Jobs', 'Filed', 'Response'],
    rows: [
      { cells: ['Acme Logistics', '220', 'Nov 15', 'Not started'] },
      { cells: ['Halden Health', '120', 'News, Nov 16', 'Not started'] },
      { cells: ['Brightline Print', '45', 'Oct 30', 'Benefits session held'] },
      { cells: ['Corvel Steel', '310', 'Oct 2', '186 joined, 74 placed'] },
      { cells: ['Mason County Schools', '28', 'Sep 18', 'Closed, 24 placed'] },
    ],
  },
  recruiter: {
    type: 'recruiter',
    brand: { name: 'Hartley Search', logoUrl: null, accent: '#e07a5f' },
    tint: '#f1eaf5',
    nav: ['Home', 'Search', 'Candidates', 'Talent', 'Messages', 'Job board', 'Settings'],
    active: 'Home',
    eyebrow: 'Tuesday, November 17',
    title: 'Good morning, Chris',
    intro: 'Six new people match your open searches. Two candidates are waiting on you.',
    action: 'Review the 6 new matches',
    needsTitle: 'Waiting on you',
    needs: [
      { title: 'Elena Park replied to your CFO search', why: 'She asked about the equity terms on November 16. Replies within a day get twice the interviews.', action: 'Reply to Elena' },
      { title: 'Midway Health wants feedback on two finalists', why: 'Their hiring manager asked on Friday. The submission packets are ready.', action: 'Send feedback' },
      { title: 'Four candidates you added are not invited yet', why: 'They cannot see your search until you invite them.', action: 'Invite the four' },
    ],
    stats: [
      { value: '6', label: 'New matches this week', source: 'Across your 4 open searches', highlight: true },
      { value: '23', label: 'Candidates in play', source: 'Submitted or interviewing' },
      { value: '2', label: 'Placements this quarter', source: 'Marked placed by you' },
    ],
    tableTitle: 'Your open searches',
    tableLink: 'See all candidates',
    columns: ['Search', 'Client', 'Stage', 'Updated'],
    rows: [
      { cells: ['Chief Financial Officer', 'Midway Health', '2 finalists', 'Today'] },
      { cells: ['VP Sales, West', 'Arsenault', '8 submitted', 'Today'] },
      { cells: ['Controller', 'Pell & Rowe', '3 interviewing', 'Yesterday'] },
      { cells: ['Head of People', 'Corvid Labs', 'Sourcing', '3 days ago'] },
    ],
  },
  coach: {
    type: 'coach',
    brand: { name: 'Maya Ortiz Coaching', logoUrl: null, accent: '#8ab17d' },
    tint: '#e2f2f3',
    nav: ['Home', 'Clients', 'Booking', 'Messages', 'Activity', 'Settings'],
    active: 'Home',
    eyebrow: 'Tuesday, November 17',
    title: 'Good morning, Maya',
    intro: 'Three sessions today. Dana Whitfield is first, at 10:00.',
    action: 'Prepare for Dana',
    needsTitle: 'Before your sessions',
    needs: [
      { title: 'Dana Whitfield, 10:00', why: 'Since your last session she applied to 7 roles and got 2 interviews. She wants help with salary.', action: 'Open the prep page' },
      { title: 'Rob Alvarez, 13:30', why: 'He has not logged in for 9 days. His last note said he felt stuck on networking.', action: 'Open the prep page' },
      { title: 'Notes from Friday are not reviewed', why: 'The summary for Kim Lee is drafted from the call. Follow-ups go out once you approve it.', action: 'Review the notes' },
    ],
    stats: [
      { value: '14', label: 'Active clients', source: 'With a session in the last 30 days' },
      { value: '3', label: 'Landed this quarter', source: 'Reported by your clients', highlight: true },
      { value: '11', label: 'Sessions this week', source: 'From your booking calendar' },
    ],
    tableTitle: 'Your clients',
    tableLink: 'See all 14',
    columns: ['Client', 'Goal', 'Since last session', 'Next session'],
    rows: [
      { cells: ['Dana Whitfield', 'VP Finance', '7 applications, 2 interviews', 'Today 10:00'] },
      { cells: ['Rob Alvarez', 'Director of Ops', 'Quiet for 9 days', 'Today 13:30'] },
      { cells: ['Kim Lee', 'Product lead', 'Offer from Corvid Labs', 'Today 16:00'] },
      { cells: ['Sara Nunez', 'HR director', '3 applications', 'Thursday'] },
      { cells: ['Ben Carter', 'CFO', '1 interview', 'Next week'] },
    ],
  },
}

function PortalHome({ look }: { look: PortalLook }) {
  const color = PORTAL_TYPES[look.type].chrome
  const vars = { '--portal': color, '--portal-tint': look.tint } as CSSProperties
  return (
    <div className="theme-candidate theme-redesign w-[1440px] bg-white text-ink" style={vars} data-shot>
      <PortalTypeBar type={look.type} use={look.use} brand={look.brand}>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Sample data</span>
      </PortalTypeBar>
      <div className="flex min-h-[860px]">
        {/* Light menu: the active item takes the portal's tint and color, nothing else is colored. */}
        <aside className="w-60 shrink-0 border-r border-border bg-white px-4 py-8" aria-label="Portal menu">
          <nav className="space-y-1">
            {look.nav.map((label) => {
              const on = label === look.active
              return (
                <span
                  key={label}
                  aria-current={on ? 'page' : undefined}
                  className={cn('block rounded-lg border-l-[3px] px-3 py-2 text-sm font-semibold', on ? '' : 'border-transparent text-ink/75')}
                  style={on ? { borderColor: color, backgroundColor: look.tint, color } : undefined}
                >
                  {label}
                </span>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-12 py-10">
          <div className="max-w-5xl space-y-8">
            {/* The opening: one headline, the squiggle in the portal's color, one line, one primary action. */}
            <header className="flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">{look.eyebrow}</p>
                <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink">{look.title}</h1>
                <span className="block pt-1" style={{ color }}>
                  <Squiggle className="text-inherit" />
                </span>
                <p className="max-w-2xl pt-1 text-base text-muted-foreground">{look.intro}</p>
              </div>
              <span className="nc-action inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-sm">{look.action}</span>
            </header>

            {/* 1. What to act on: the signature tint, each row with its reason and one action. */}
            <section aria-labelledby={`${look.type}-needs`} className="rounded-3xl p-6" style={{ backgroundColor: look.tint }}>
              <h2 id={`${look.type}-needs`} className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                <span aria-hidden="true" className="inline-block h-5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {look.needsTitle}
              </h2>
              <ul className="mt-4 space-y-2">
                {look.needs.map((n) => (
                  <li key={n.title} className="flex items-center justify-between gap-6 rounded-2xl bg-white px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.why}</p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold text-ink">{n.action}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 2. The numbers, each with where it comes from. One number gets the marker. */}
            <section aria-labelledby={`${look.type}-numbers`}>
              <h2 id={`${look.type}-numbers`} className="sr-only">
                Your numbers
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {look.stats.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border border-t-4 bg-white p-5" style={{ borderTopColor: color }}>
                    <p className="font-display text-3xl font-semibold text-ink">{s.highlight ? <Highlight>{s.value}</Highlight> : s.value}</p>
                    <p className="mt-1 font-semibold text-ink">{s.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.source}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. The working table stays dense: 40px rows, hairlines, no boxes. */}
            <section aria-labelledby={`${look.type}-table`}>
              <div className="flex items-baseline justify-between">
                <h2 id={`${look.type}-table`} className="font-display text-xl font-semibold text-ink">
                  {look.tableTitle}
                </h2>
                <span className="text-sm font-semibold underline underline-offset-4" style={{ color }}>
                  {look.tableLink}
                </span>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {look.columns.map((c) => (
                      <th key={c} className="h-10 pr-4 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {look.rows.map((r) => (
                    <tr key={r.cells[0]} className="border-b border-border/70">
                      {r.cells.map((c, i) => (
                        <td key={i} className={cn('h-10 pr-4', i === 0 ? 'font-semibold text-ink' : 'text-ink/80')}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export const PortalLookEmployer = () => <PortalHome look={LOOKS.employer} />
export const PortalLookHigherEd = () => <PortalHome look={LOOKS.higher_ed} />
export const PortalLookWorkforce = () => <PortalHome look={LOOKS.workforce} />
export const PortalLookRecruiter = () => <PortalHome look={LOOKS.recruiter} />
export const PortalLookCoach = () => <PortalHome look={LOOKS.coach} />
