import { Action, Panel, Pill, PortalFrame, Quiet, SAMPLE_BRANDS, Table, Title } from './portal-frame'

// Sample-data previews of the recruiter portal, for /recruiters. Hartley Search and every candidate are made up.
// The packet shows only the fields of SubmissionPacketData in src/lib/recruiter/submission-packet.ts (an allowlist: no
// grades, detections, badges or application history). The export panel is the real wording of
// src/lib/recruiter/ats-export.ts: a file for you to import in your own ATS, not a live connection.
// Rendered by scripts/marketing/render-screenshots.mjs.

const NAV = ['Home', 'Talent', 'Candidate Search', 'My Candidates', 'Messages', 'Post to Job Board', 'Downloads and activity', 'Settings']

export function RecruiterPacket() {
  return (
    <PortalFrame type="recruiter" brand={SAMPLE_BRANDS.recruiter} nav={NAV} active="Candidate Search" trail="Candidate Search › Avery R. › Submission packet and export">
      <Title intro="The packet carries your firm’s logo and colors and is built from the candidate’s Dossier. Only candidates who agreed to be introduced to you can be packaged." action={<Action>Download packet (PDF)</Action>}>
        Submission packet and export
      </Title>
      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4">
            <span className="font-display text-lg font-semibold text-ink">Hartley Search</span>
            <span className="text-xs text-muted-foreground">Candidate submission packet</span>
          </div>
          <div className="space-y-5 p-6">
            <div>
              <p className="text-xl font-semibold text-ink">Avery R. · VP Operations</p>
              <p className="text-sm text-muted-foreground">Chicago, IL</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="good">3 references on file</Pill>
              <Pill tone="good">2 open to a hiring-manager call</Pill>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Positioning</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">An operations leader who scales process without slowing teams down. Two references describe the same pattern: sets a clear bar and gives people room to meet it.</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Strengths</p>
              <ul className="mt-1 space-y-1 text-sm text-ink">
                <li><span className="font-semibold">Operating cadence.</span> Weekly reviews that shortened planning cycles.</li>
                <li><span className="font-semibold">Hiring and coaching.</span> Built a six-person leadership bench.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">What references said</p>
              <p className="mt-1 text-sm italic text-ink">“She tells you where the bar is on day one, and then she gets out of the way.” <span className="not-italic text-muted-foreground">Former CEO</span></p>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Panel title="Export file" why="the file uses each system’s own field names, so you can import it or paste it into your own ATS. It is not a live connection.">
            <div className="flex flex-wrap gap-2">
              {['Greenhouse', 'Lever', 'Bullhorn'].map((d) => <Quiet key={d}>Download for {d}</Quiet>)}
            </div>
            <p className="text-xs text-muted-foreground">Shown for the systems your firm has switched on.</p>
          </Panel>
          <Panel title="Never in the packet" why="the packet is built from a fixed list of fields, so nothing else can reach it.">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
              <li>Market reality assessment and grades</li>
              <li>Detections and badges</li>
              <li>Application history</li>
              <li>Any other candidate</li>
            </ul>
          </Panel>
        </div>
      </div>
    </PortalFrame>
  )
}

export function RecruiterSearch() {
  return (
    <PortalFrame type="recruiter" brand={SAMPLE_BRANDS.recruiter} nav={NAV} active="Candidate Search" trail="Candidate Search">
      <Title intro="Candidates who chose to be found. You ask for an introduction, and each candidate decides." action={<Action>Save this search</Action>}>
        Candidate search
      </Title>
      <div className="flex gap-2 text-sm">
        {['Function: Operations', 'Level: VP', 'Remote: Hybrid', 'Location: Midwest'].map((f) => (
          <span key={f} className="rounded-full border border-border px-3 py-1.5 font-medium text-ink">{f}</span>
        ))}
      </div>
      <Panel title="12 candidates match" why="each row shows how much evidence is on file, so you can pick who to ask first.">
        <Table
          head={['Candidate', 'Target role', 'Location', 'References on file', 'Introduction']}
          rows={[
            ['Avery R.', 'VP Operations', 'Chicago, IL', '3, 2 open to a call', <Pill key="a" tone="good">Introduced</Pill>],
            ['Noah K.', 'COO', 'Columbus, OH', '3, 3 open to a call', <Pill key="b" tone="warm">Requested</Pill>],
            ['Mira S.', 'VP Supply Chain', 'Indianapolis, IN', '2, 1 open to a call', <Quiet key="c">Ask for introduction</Quiet>],
            ['Theo L.', 'Head of Operations', 'Minneapolis, MN', '3, 0 open to a call', <Quiet key="d">Ask for introduction</Quiet>],
            ['Jules F.', 'VP Operations', 'Detroit, MI', '1, 1 open to a call', <Quiet key="e">Ask for introduction</Quiet>],
          ]}
        />
      </Panel>
    </PortalFrame>
  )
}

const STAGES = ['Reviewed', 'Screened', 'Submitted', 'Interviewed', 'Placed']

export function RecruiterPipeline() {
  return (
    <PortalFrame type="recruiter" brand={SAMPLE_BRANDS.recruiter} nav={NAV} active="My Candidates" trail="My Candidates › Feedback and placement">
      <Title intro="Move each candidate through the stages, or pass with a reason. Every change is logged with a date, so nothing is lost in an inbox.">
        Feedback and placement
      </Title>
      <Panel title="Submissions" why="the days since the last change show which candidates are going quiet.">
        <Table
          head={['Candidate', 'Client search', ...STAGES, 'Days since update']}
          rows={[
            ['Avery R.', 'VP Operations, Client A', '✓', '✓', '✓', <Pill key="a" tone="ink">Now</Pill>, '', '4'],
            ['Noah K.', 'COO, Client B', '✓', '✓', <Pill key="b" tone="ink">Now</Pill>, '', '', '9'],
            ['Mira S.', 'VP Supply Chain, Client C', '✓', <Pill key="c" tone="ink">Now</Pill>, '', '', '', '2'],
            ['Theo L.', 'Head of Operations, Client A', '✓', '✓', '✓', '✓', <Pill key="d" tone="good">Placed</Pill>, '—'],
            ['Jules F.', 'VP Operations, Client D', <Pill key="e" tone="warm">Passed: needs relocation</Pill>, '', '', '', '', '12'],
          ]}
        />
      </Panel>
    </PortalFrame>
  )
}
