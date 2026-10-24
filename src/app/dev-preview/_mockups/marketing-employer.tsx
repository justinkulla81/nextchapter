import { CohortAiGapPanel } from '@/components/skills/CohortAiGapPanel'
import { StatTile as StaffTile } from '@/components/employer/StaffStats'
import { SAMPLE_COMPLIANCE_PACK_TEXT } from '@/lib/marketing/sample-compliance-pack'
import type { CohortAiGap } from '@/lib/skills/cohort-ai-gap'
import { Action, Panel, Pill, PortalFrame, Quiet, SAMPLE_BRANDS, Table, Tile, Title } from './portal-frame'

// Sample-data previews of the employer portal, for the public pages /talent, /employees, /outplacement and /employers.
// Northwind Foods is made up, and so is every person, count and role. The layouts follow the real pages:
// src/app/talent/(app)/dashboard, src/lib/reports/evidence-brief.ts, src/app/employer/(app)/learning, growth and reporting.
// Rules the real pages keep, and these show: employees are counted by team and never named, small groups are held
// back, and an employer never sees an individual's activity. Rendered by scripts/marketing/render-screenshots.mjs.

const HIRING_NAV = ['Dashboard', 'Roles', 'Candidates', 'Messages', 'Analytics', 'Team']
const EMPLOYER_NAV = ['Overview', 'Growth', 'Learning', 'Enroll', 'Reporting', 'Downloads and activity']
const OUT_NAV = ['Overview', 'Enroll', 'Roster', 'Program', 'Reporting', 'Invoices', 'Team', 'Downloads and activity', 'HR system and emails', 'Compliance pack']

// ── Hiring ──────────────────────────────────────────────────────────────────

export function HiringDashboard() {
  return (
    <PortalFrame type="employer" use="Hiring" brand={SAMPLE_BRANDS.employer} nav={HIRING_NAV} active="Dashboard" trail="Hiring › Dashboard">
      <Title intro="Candidates who chose to be seen, matched on what they say they are looking for." action={<Action>Post a role</Action>}>
        Welcome back, Northwind Foods
      </Title>
      <Panel title="Candidates looking for roles like yours" why="matched on what each person says they want, across all your active roles, not on a job title search.">
        <ul className="grid grid-cols-2 gap-4">
          {[
            ['Candidate 1', 'Plant controller · Columbus, OH', 'Matches: Finance manager', 'Led finance for a 300-person food producer. Two references describe the same strength in budgeting.'],
            ['Candidate 2', 'Supply chain manager · Dayton, OH', 'Matches: Operations lead', 'Ran a three-site distribution network. Shared a work sample on carrier cost reduction.'],
          ].map(([n, t, m, e]) => (
            <li key={n} className="space-y-2 rounded-xl border border-border p-4 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-base font-semibold text-ink">{n}</span>
                <Pill tone="good">Chose to be seen</Pill>
              </p>
              <p className="text-ink">{t}</p>
              <p className="text-muted-foreground">{m}</p>
              <p className="text-muted-foreground">Evidence: {e}</p>
              <Quiet>Open evidence brief</Quiet>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid grid-cols-5 gap-4">
        <Tile label="Active roles" value="3" />
        <Tile label="Candidates in pipeline" value="14" />
        <Tile label="In conversation" value="4" />
        <Tile label="Hired via NextChapter" value="1" />
        <Tile label="Postings pending review" value="1" />
      </div>
    </PortalFrame>
  )
}

export function HiringEvidenceBrief() {
  return (
    <PortalFrame type="employer" use="Hiring" brand={SAMPLE_BRANDS.employer} nav={HIRING_NAV} active="Candidates" trail="Hiring › Candidates › Candidate 1">
      <Title intro="Plant controller · Columbus, OH · Available in 4 weeks. Name and contact stay private until the candidate agrees." action={<Action>Ask for an introduction</Action>}>
        Evidence brief
      </Title>
      <div className="grid grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6">
          <Panel title="Why they might fit" why="written only from the facts below. The label says what kind of evidence backs it.">
            <p className="text-base text-ink">Led finance at a company of your size and has done the monthly close with a small team. Two references independently describe careful, early forecasting.</p>
            <Pill tone="good">Backed by references</Pill>
          </Panel>
          <Panel title="Work history" why="the roles the candidate chose to show, newest first, with one achievement each.">
            <ul className="space-y-3 text-sm">
              {[
                ['Finance manager', 'Harbor Foods', '2019 to now', 'Cut the monthly close from 9 days to 5.'],
                ['Senior analyst', 'Lakeview Packaging', '2015 to 2019', 'Built the plant cost model used in budgeting.'],
                ['Staff accountant', 'Midland Dairy', '2012 to 2015', 'Took over audit preparation for three plants.'],
              ].map(([t, c, d, a]) => (
                <li key={t} className="rounded-lg bg-muted/60 p-3">
                  <p className="font-semibold text-ink">{t} <span className="font-normal text-muted-foreground">· {c} · {d}</span></p>
                  <p className="text-muted-foreground">{a}</p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Work samples">
            <p className="text-sm text-ink"><span className="font-semibold">Plant cost model.</span> A walk-through of how standard costs were rebuilt. <span className="text-muted-foreground">Outcome: variance reviews moved from quarterly to monthly.</span></p>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Effort" why="minutes of real search work, so you can see how seriously the person is looking.">
            <ul className="space-y-1.5 text-sm text-ink">
              <li>5 hours of search work in the last 7 days</li>
              <li>Applied to 11 roles in the last 30 days</li>
              <li>Finished 2 skills courses this month</li>
            </ul>
          </Panel>
          <Panel title="Gaps" why="listed so you can decide what matters for the role.">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
              <li>No ERP migration on the résumé</li>
              <li>Has not managed more than 4 people</li>
            </ul>
          </Panel>
          <Panel title="Questions worth asking">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
              <li>How large was the team during the close redesign?</li>
              <li>Which ERP did the plant cost model sit in?</li>
            </ul>
          </Panel>
        </div>
      </div>
    </PortalFrame>
  )
}

export function HiringRoles() {
  return (
    <PortalFrame type="employer" use="Hiring" brand={SAMPLE_BRANDS.employer} nav={HIRING_NAV} active="Roles" trail="Hiring › Roles">
      <Title intro="Describe a role and get matched candidates. Posting is free." action={<Action>Post a role</Action>}>
        Roles
      </Title>
      <Panel title="Your roles" why="each role shows how many candidates match and how many you are talking to, so you know where to spend today.">
        <Table
          head={['Role', 'Location', 'Matched', 'In conversation', 'Status']}
          rows={[
            ['Finance manager', 'Columbus, OH', '9', '2', <Pill key="a" tone="good">Active</Pill>],
            ['Operations lead', 'Dayton, OH', '6', '2', <Pill key="b" tone="good">Active</Pill>],
            ['Quality systems analyst', 'Remote', '4', '0', <Pill key="c" tone="good">Active</Pill>],
            ['Plant controller', 'Columbus, OH', '—', '—', <Pill key="d">Filled</Pill>],
          ]}
        />
      </Panel>
      <Panel title="Your hiring team" why="seats let colleagues review candidates with you. Each person sees only what the candidate shared.">
        <ul className="grid grid-cols-3 gap-3 text-sm">
          {['Sam (owner)', 'Priya (member)', 'Luis (member)'].map((p) => (
            <li key={p} className="rounded-lg bg-muted/60 p-3 font-medium text-ink">{p}</li>
          ))}
        </ul>
      </Panel>
    </PortalFrame>
  )
}

// ── Employees: learning and development, retention ─────────────────────────

const SAMPLE_GAP: CohortAiGap = {
  counted: 84,
  showAnyAi: 31,
  missingAsked: 58,
  topMissing: [
    { id: 'prompting', label: 'Prompting for analysis', people: 36 },
    { id: 'automation', label: 'Workflow automation', people: 27 },
    { id: 'ai-tools', label: 'AI tools in everyday work', people: 19 },
  ],
  functions: [
    { fn: 'finance', people: 30, postingsAskingPct: 41 },
    { fn: 'operations', people: 24, postingsAskingPct: 29 },
  ],
}

export function EmployeesLearning() {
  return (
    <PortalFrame type="employer" use="Learning and development" brand={SAMPLE_BRANDS.employer} nav={EMPLOYER_NAV} active="Learning" trail="Employer › Learning">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Learning</p>
        <h1 className="text-2xl font-semibold tracking-tight">Skills for the roles ahead</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Each person gets a skills plan for their role and the next one, with your courses first. You see counts only, once at least 10 people have joined.</p>
        <div className="flex items-center gap-3 pt-2"><Action>Enroll people</Action><span className="text-sm text-muted-foreground underline underline-offset-4">Add a course you cover</span></div>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Participation</h2>
        <div className="grid grid-cols-4 gap-3">
          <StaffTile label="Joined" value={84} of={120} />
          <StaffTile label="Active in the last 30 days" value={61} />
          <StaffTile label="Started one of your courses" value={47} />
          <StaffTile label="Finished one of your courses" value={22} />
        </div>
      </section>
      <CohortAiGapPanel gap={SAMPLE_GAP} who="people" />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">By team</h2>
        <p className="text-sm text-muted-foreground">Teams are the group you enrolled people with. Teams under 10 people are pooled.</p>
        <Table
          head={['Team', 'Joined', 'Started a course', 'Finished a course']}
          rows={[
            ['Finance', '30', '19', '9'],
            ['Operations', '24', '15', '7'],
            ['Customer support', '18', '9', '4'],
            ['Pooled small teams', '12', '4', '2'],
          ]}
        />
      </section>
    </PortalFrame>
  )
}

export function EmployeesRetention() {
  return (
    <PortalFrame type="employer" use="Retention" brand={SAMPLE_BRANDS.employer} nav={EMPLOYER_NAV} active="Growth" trail="Employer › Growth">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Growth</p>
        <h1 className="text-2xl font-semibold tracking-tight">Keep and grow your people</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Counts only. Nobody’s individual activity is shown here, and each count waits until at least 10 people have joined. Promotions and raises count only people who chose to share them.</p>
        <div className="flex items-center gap-3 pt-2"><Action>Enroll people</Action><span className="text-sm text-muted-foreground underline underline-offset-4">Post an internal role</span></div>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Participation</h2>
        <div className="grid grid-cols-3 gap-3">
          <StaffTile label="Joined" value={96} of={140} />
          <StaffTile label="Active in the last 30 days" value={64} />
          <StaffTile label="Using review, wins and feedback tools" value={52} />
          <StaffTile label="Building a promotion plan" value={29} />
          <StaffTile label="Finished review prep this year" value={38} />
          <StaffTile label="Raised a hand for an internal role" value={17} />
        </div>
      </section>
      <div className="grid grid-cols-2 gap-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Outcomes, last 12 months</h2>
          <p className="text-sm text-muted-foreground">41 people share their review outcomes with you.</p>
          <div className="grid grid-cols-2 gap-3">
            <StaffTile label="Promoted" value={9} of={41} />
            <StaffTile label="Got a raise" value={14} of={41} />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Internal roles</h2>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {[
              ['Senior planner', 'Open · 6 raised a hand'],
              ['Quality lead', 'Open · 4 raised a hand'],
              ['Regional supervisor', 'Closed'],
            ].map(([r, s]) => (
              <li key={r} className="flex justify-between px-3 py-2.5">
                <span className="font-medium text-ink">{r}</span>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PortalFrame>
  )
}

// ── Outplacement ─────────────────────────────────────────────────────────────

export function OutplacementReporting() {
  return (
    <PortalFrame type="employer" use="Outplacement" brand={SAMPLE_BRANDS.employer} nav={OUT_NAV} active="Reporting" trail="Employer › Reporting">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Aggregate only. No individual is ever identifiable from these numbers. Cohorts under 10 seats are suppressed entirely; under 50 seats, numbers round to the nearest 5; under 20 seats, this section reports quarterly instead of live.</p>
      </div>
      <section className="space-y-4 rounded-xl border border-border p-6">
        <div>
          <h2 className="text-lg font-semibold">Sample cohort, Plus</h2>
          <p className="text-sm text-muted-foreground">Plus · 60 seats · as of October 24</p>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[['Seats', '60', ''], ['Activated', '50', ''], ['Activation rate', '83%', ''], ['Engagement', '65%', 'checked in, last 7 days']].map(([l, v, n]) => (
            <div key={l}>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{l}</p>
              <p className="text-2xl font-semibold tabular-nums">{v}</p>
              {n && <p className="text-xs text-muted-foreground">{n}</p>}
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Time to placement, by function and level</h2>
        <p className="text-sm text-muted-foreground">Across all cohorts for this account. Shown once enough people have recorded a placement.</p>
        <Table
          head={['Function', 'Level', 'People', 'Avg. days to placement']}
          rows={[
            ['Operations', 'Director', '15', '60'],
            ['Finance', 'Manager', '10', '45'],
          ]}
        />
      </section>
    </PortalFrame>
  )
}

export function OutplacementRoster() {
  return (
    <PortalFrame type="employer" use="Outplacement" brand={SAMPLE_BRANDS.employer} nav={OUT_NAV} active="Roster" trail="Employer › Roster">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Who holds a seat and whether the seat is in use. You never see anyone’s activity, grade or progress.</p>
      </div>
      <section className="space-y-3 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Cohorts</h2>
        <div className="flex gap-2 text-sm font-semibold">
          {['Everyone · 60', 'Operations · 22', 'Finance · 18', 'Sales · 20'].map((c, i) => (
            <span key={c} className={i === 0 ? 'rounded-full bg-ink px-4 py-1.5 text-white' : 'rounded-full border border-border px-4 py-1.5 text-ink'}>{c}</span>
          ))}
        </div>
        <Table
          head={['Person', 'Cohort', 'Seat', 'Term ends']}
          rows={[
            ['Taylor B.', 'Operations', <Pill key="a" tone="good">Activated</Pill>, 'Apr 2027'],
            ['Jordan P.', 'Finance', <Pill key="b" tone="good">Activated</Pill>, 'Apr 2027'],
            ['Riley C.', 'Sales', <Pill key="c" tone="warm">Invited</Pill>, 'Apr 2027'],
            ['Morgan D.', 'Operations', <Pill key="d" tone="good">Activated</Pill>, 'Apr 2027'],
            ['Casey W.', 'Finance', <Pill key="e">Not yet invited</Pill>, 'Apr 2027'],
          ]}
        />
      </section>
    </PortalFrame>
  )
}

export function OutplacementCompliance() {
  return (
    <PortalFrame type="employer" use="Outplacement" brand={SAMPLE_BRANDS.employer} nav={OUT_NAV} active="Compliance pack" trail="Employer › Compliance pack">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">A record for each seat showing the outplacement obligation was offered and delivered. Download it for your legal team.</p>
      </div>
      <pre className="overflow-hidden rounded-xl border border-border bg-muted/50 px-5 py-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">{SAMPLE_COMPLIANCE_PACK_TEXT}</pre>
    </PortalFrame>
  )
}

export function EmployeesEnroll() {
  return (
    <PortalFrame type="employer" use="Learning and development" brand={SAMPLE_BRANDS.employer} nav={EMPLOYER_NAV} active="Enroll" trail="Employer › Enroll">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enroll</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Add the people who should get a plan. Each person gets an invitation at their work email and chooses to join. Teams are the group you enroll people with.</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Panel title="Add one person" why="an invitation goes to their work email, so only they can join under their name.">
          <div className="space-y-3 text-sm">
            {[['Program', 'Learning and development'], ['Work email', 'jane@example.com'], ['Name', 'Jane Doe'], ['Team', 'Finance']].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs font-medium text-muted-foreground">{l}</p>
                <p className="mt-1 rounded-md border border-input px-3 py-2 text-ink">{v}</p>
              </div>
            ))}
            <Action>Enroll</Action>
          </div>
        </Panel>
        <Panel title="Upload a list" why="one file enrolls a whole team, and the team column is what your reporting is grouped by.">
          <div className="space-y-3 text-sm text-ink">
            <p>A CSV with email, name and team. The first rows of a sample file:</p>
            <pre className="rounded-lg bg-muted/60 p-3 font-mono text-xs">{`email,name,team
jane@example.com,Jane Doe,Finance
sam@example.com,Sam Lee,Operations
ana@example.com,Ana Ruiz,Finance`}</pre>
            <Quiet>Upload and enroll</Quiet>
          </div>
        </Panel>
      </div>
    </PortalFrame>
  )
}
