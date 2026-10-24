import { StatTile } from '@/components/higher-ed/StatTile'
import { Action, Panel, PortalFrame, Pill, Quiet, SAMPLE_BRANDS, Table, Tile, Title } from './portal-frame'

// Sample-data previews of the college and workforce portal screens, for the public pages
// /higher-education and /government-workforce. They follow the real screens in src/components/higher-ed
// (screens.tsx, screens-hub.tsx): same workspaces, same tiles, same rule of holding back groups under 10.
// Riverside College and Tri-County Workforce Board are made up. Rendered by scripts/marketing/render-screenshots.mjs.

const COLLEGE_NAV = ['Admin', 'Alumni Relations', 'Career Services', 'Development', 'Exec Ed']
const WORKFORCE_NAV = ['Admin', 'Program', 'Your company']

const SERVICES: [string, boolean][] = [
  ['Career coaching', true],
  ['Résumé reviews', true],
  ['Alumni job board', true],
  ['Mentoring', true],
  ['Employer events', false],
  ['Continuing education', false],
]
const WF_SERVICES: [string, boolean][] = [
  ['Résumé help', true],
  ['Training funds', true],
  ['Rapid response', true],
  ['Business services', true],
  ['Job fairs', false],
  ['Veterans services', false],
]

function AdminOverview({ kind }: { kind: 'college' | 'workforce' }) {
  const college = kind === 'college'
  const services = college ? SERVICES : WF_SERVICES
  return (
    <PortalFrame
      type={college ? 'higher_ed' : 'workforce'}
      use={college ? 'Career services' : 'Workforce boards'}
      brand={college ? SAMPLE_BRANDS.higher_ed : SAMPLE_BRANDS.workforce}
      nav={college ? COLLEGE_NAV : WORKFORCE_NAV}
      active="Admin"
      trail={`Admin › Overview`}
    >
      <Title intro={college ? 'Your free workspace. Everything here is counted from your own members.' : 'Your free workspace. Everything here is counted from the people you serve.'} action={<Action>Invite {college ? 'alumni' : 'participants'}</Action>}>
        {college ? 'Riverside College' : 'Tri-County Workforce Board'}
      </Title>
      <div className="grid grid-cols-4 gap-4">
        <Tile label="Active members" value="38 of 50" note="Free workspace limit" />
        <Tile label="Joined NextChapter" value="31" note="82% of active members" />
        <Tile label="Staff" value="4" note="Each with a role" />
        <Tile label="Services listed" value={String(services.filter(([, on]) => on).length)} note="Shown to your members" />
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        <Panel title="Your services" why="each service you switch on becomes a card your members see, so they know what you offer before they ask.">
          <ul className="divide-y divide-border">
            {services.map(([name, on]) => (
              <li key={name} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-ink">{name}</span>
                {on ? <Pill tone="good">Listed</Pill> : <Pill>Off</Pill>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Basic counts" why="small counts are held back, so no one can be picked out of a group of fewer than 10.">
          <ul className="space-y-3 text-sm">
            {[
              ['Joined this month', '9'],
              ['Active this week', '17'],
              ['Looking for work', 'Under 10'],
              ['Landed new roles', 'Under 10'],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold tabular-nums text-ink">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </PortalFrame>
  )
}

export const OrgAdminCollege = () => <AdminOverview kind="college" />
export const OrgAdminWorkforce = () => <AdminOverview kind="workforce" />

export function HigherEdAlumni() {
  return (
    <PortalFrame type="higher_ed" use="Alumni" brand={SAMPLE_BRANDS.higher_ed} nav={COLLEGE_NAV} active="Alumni Relations" trail="Alumni Relations › Home">
      <Title intro="Who is in your community, and who needs you this week." action={<Action>Post an alumni job</Action>}>
        Alumni relations
      </Title>
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Members" value="38" />
        <StatTile label="Claimed" value="31" />
        <StatTile label="Active seats" value="24" />
        <StatTile label="In transition" value="Under 10" note="Open flags show no reasons" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Panel title="Layoff alerts near your alumni" why="we match public layoff filings to where your alumni live, so you can reach out first.">
          <Table
            head={['Employer', 'County', 'Workers', 'Notice']}
            rows={[
              ['Hartwell Foods', 'Franklin', '140', 'Oct 12'],
              ['Lakeshore Logistics', 'Delaware', '85', 'Oct 8'],
              ['Pioneer Medical Billing', 'Franklin', '60', 'Sep 30'],
            ]}
          />
        </Panel>
        <Panel title="Alumni jobs" why="only your alumni see these. A NextChapter admin reviews each one first.">
          <ul className="divide-y divide-border text-sm">
            {[
              ['Operations analyst', 'Northside Logistics', '3 interested'],
              ['Finance manager', 'Southwestern Food Bank', '5 interested'],
              ['Program director', 'Keystone Robotics', '1 interested'],
            ].map(([t, c, n]) => (
              <li key={t} className="flex items-center justify-between py-2.5">
                <span>
                  <span className="font-semibold text-ink">{t}</span> <span className="text-muted-foreground">· {c}</span>
                </span>
                <Pill>{n}</Pill>
              </li>
            ))}
          </ul>
          <Quiet>See all alumni jobs</Quiet>
        </Panel>
      </div>
    </PortalFrame>
  )
}

export function HigherEdCareer() {
  return (
    <PortalFrame type="higher_ed" use="Career services" brand={SAMPLE_BRANDS.higher_ed} nav={COLLEGE_NAV} active="Career Services" trail="Career Services › Caseload">
      <Title intro="People on your caseload, with the next step for each. Alumni who tell a check-in they are looking are added automatically." action={<Action>Add to caseload</Action>}>
        Caseload
      </Title>
      <div className="flex gap-2 text-sm font-semibold text-ink">
        {['Caseload', 'Coaching', 'Alumni jobs', 'Target companies', 'Outcomes', 'Check-ins'].map((t, i) => (
          <span key={t} className={i === 0 ? 'rounded-full bg-ink px-4 py-1.5 text-white' : 'rounded-full border border-border px-4 py-1.5'}>
            {t}
          </span>
        ))}
      </div>
      <Panel title="Your caseload" why="the people who need a conversation come first, so the hour goes to them.">
        <Table
          head={['Person', 'Class', 'Status', 'Last contact', 'Next step']}
          rows={[
            ['Priya S.', '2014', <Pill key="a" tone="warm">Laid off, Oct 12</Pill>, 'Oct 20', 'Review résumé together'],
            ['Marcus T.', '2009', <Pill key="b" tone="good">Interviewing</Pill>, 'Oct 22', 'Mock interview Tuesday'],
            ['Elena R.', '2018', <Pill key="c">Exploring</Pill>, 'Oct 3', 'Send two alumni introductions'],
            ['Daniel K.', '2011', <Pill key="d" tone="warm">Looking, 4 months</Pill>, 'Sep 28', 'Check in this week'],
            ['Grace L.', '2020', <Pill key="e" tone="good">Offer received</Pill>, 'Oct 23', 'Offer review'],
          ]}
        />
      </Panel>
    </PortalFrame>
  )
}

export function WorkforceHubDashboard() {
  return (
    <PortalFrame type="workforce" use="Workforce boards" brand={SAMPLE_BRANDS.workforce} nav={WORKFORCE_NAV} active="Program" trail="Program › Dashboard">
      <Title intro="Your region at a glance. Counts come from participants who joined and, for outcomes, from those who chose to share." action={<Action>Give seats for a layoff</Action>}>
        Dashboard
      </Title>
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Participants" value="412" />
        <StatTile label="Joined NextChapter" value="268" note="65% activation" />
        <StatTile label="Active this week" value="141" />
        <StatTile label="Applying or interviewing" value="97" note="31 interviewing" />
        <StatTile label="Landed new roles" value="44" note="Of people who share their outcome" />
        <StatTile label="Kept in Tri-County" value="71%" note="Local or remote, of hires with a known place" />
        <StatTile label="Seats used" value="268 of 500" />
        <StatTile label="Member companies" value="23" note="3 layoffs with seats" />
      </div>
      <Panel title="Set up your program" why="each step is a thing the portal can do today, in the order most boards do them.">
        <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            ['Set your region', true],
            ['Add member companies', true],
            ['Give seats for a layoff', true],
            ['Choose your services', true],
            ['Invite your team', false],
            ['Load or connect your participants', false],
          ].map(([t, done]) => (
            <li key={t as string} className="flex items-center gap-2">
              <span aria-hidden className={done ? 'text-success' : 'text-muted-foreground'}>{done ? '✓' : '○'}</span>
              <span className={done ? 'text-ink' : 'text-muted-foreground'}>{t as string}</span>
              <span className="sr-only">{done ? 'Done' : 'To do'}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </PortalFrame>
  )
}

export function WorkforceHubLayoffs() {
  return (
    <PortalFrame type="workforce" use="Workforce boards" brand={SAMPLE_BRANDS.workforce} nav={WORKFORCE_NAV} active="Program" trail="Program › Layoffs">
      <Title intro="When a member company has a layoff, you give its people seats from your pool and share one sign-up page." action={<Action>Give seats for a layoff</Action>}>
        Layoffs
      </Title>
      <Panel title="Layoffs with seats" why="a seat gives each affected worker the full job search tools. You see how many signed up, never who.">
        <Table
          head={['Employer', 'County', 'Workers', 'Notice date', 'Seats given', 'Signed up']}
          rows={[
            ['Hartwell Foods', 'Franklin', '140', 'Oct 12', '140', '58'],
            ['Lakeshore Logistics', 'Delaware', '85', 'Oct 8', '85', '31'],
            ['Pioneer Medical Billing', 'Franklin', '60', 'Sep 30', '60', '27'],
          ]}
        />
      </Panel>
      <Panel title="Notices in your region not yet answered" why="these come from public layoff filings. Give seats to any of them in one step.">
        <Table
          head={['Employer', 'County', 'Workers', 'Notice date']}
          rows={[
            ['Cedar Ridge Plastics', 'Union', '95', 'Oct 21'],
            ['Brightwater Insurance', 'Franklin', '210', 'Oct 19'],
          ]}
        />
      </Panel>
    </PortalFrame>
  )
}
