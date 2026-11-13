import { InboundView } from '@/components/talent-intake/InboundView'
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

// The firm's résumé page as a candidate opens it: the real InboundView with Hartley Search's sample brand settings.
export function RecruiterInbound() {
  return (
    <div className="w-[1440px] overflow-hidden bg-white" data-shot>
      <InboundView
        firm={{ name: 'Hartley Search', slug: 'hartley', logoUrl: null, brandHeroUrl: null, accentColor: '#e07a5f', brandFont: 'editorial', brandTone: 'cream' }}
        recruiter={null}
        recruiterSlug={null}
        notFit={false}
      />
    </div>
  )
}

const FILTERS = ['All', 'Assigned to me', 'Strong fit', 'In your niche', 'Outside focus', 'Next step due']

// The candidate list, wording from src/app/recruiters/(app)/talent/page.tsx.
export function RecruiterCandidates() {
  return (
    <PortalFrame type="recruiter" brand={SAMPLE_BRANDS.recruiter} nav={NAV} active="Talent" trail="Talent › Candidates">
      <Title intro="Every résumé sent to your page, read and sorted. Open one to set its stage and next step.">Candidates</Title>
      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f, i) => (
          <span key={f} className={i === 0 ? 'rounded-full bg-ink px-3 py-1 font-medium text-white' : 'rounded-full border border-border px-3 py-1 text-muted-foreground'}>{f}</span>
        ))}
      </div>
      <Panel title="5 candidates" why="a next step turns orange on the day it is due, and the Next step due filter shows only those.">
        <Table
          head={['Name', 'Stage', 'Tag', 'Why', 'Recruiter', 'Updated']}
          rows={[
            [<span key="a" className="font-medium">Dana Whitfield</span>, <span key="a2">Talking<br /><span className="text-xs font-medium text-orange">Next step Nov 14</span></span>, <Pill key="a3" tone="good">Fit</Pill>, 'VP Finance, matches your open CFO search', 'Pat Hartley', 'Nov 12'],
            [<span key="b" className="font-medium">Marcus Bell</span>, <span key="b2">New<br /><span className="text-xs font-medium text-orange">Next step Nov 13</span></span>, <Pill key="b3" tone="warm">In your niche</Pill>, 'Controller, healthcare services', 'Pat Hartley', 'Nov 11'],
            [<span key="c" className="font-medium">Priya Raman</span>, <span key="c2">Presented to a client<br /><span className="text-xs text-muted-foreground">Next step Nov 20</span></span>, <Pill key="c3" tone="good">Fit</Pill>, 'Director FP&A, matches your focus', 'Lee Ortiz', 'Nov 10'],
            [<span key="d" className="font-medium">Tom Eriksen</span>, <span key="d2">Placed</span>, <Pill key="d3" tone="good">Fit</Pill>, 'CFO, mid-market manufacturing', 'Lee Ortiz', 'Nov 6'],
            [<span key="e" className="font-medium">Ana Kowalski</span>, <span key="e2">Not a fit</span>, <Pill key="e3">Outside focus</Pill>, 'Marketing manager', 'General hopper', 'Nov 5'],
          ]}
        />
      </Panel>
    </PortalFrame>
  )
}

// One candidate: the pipeline and what they chose to share, wording from src/app/recruiters/(app)/talent/[id]/page.tsx.
export function RecruiterCandidateStatus() {
  return (
    <PortalFrame type="recruiter" brand={SAMPLE_BRANDS.recruiter} nav={NAV} active="Talent" trail="Talent › Candidates › Dana Whitfield">
      <Title intro="dana.whitfield@example.com · Inbound page · Nov 4">Dana Whitfield</Title>
      <div className="grid grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-6">
          <Panel title="Pipeline" why="stage, note and next step are for your firm; the candidate never sees them.">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Stage</p>
                <p className="mt-1 rounded-md border border-border px-3 py-2 text-ink">Talking</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next step by</p>
                <p className="mt-1 rounded-md border border-border px-3 py-2 text-ink">2026-11-14</p>
              </div>
            </div>
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">Note</p>
              <p className="mt-1 rounded-md border border-border px-3 py-2 text-ink">Open to relocating to Chicago. Send the CFO brief before Friday.</p>
            </div>
            <Action>Save pipeline</Action>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Nov 12 · New to Talking · Pat Hartley</li>
            </ul>
          </Panel>
          <Panel title="Summary" why="read from the résumé, against your specialties and open searches.">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
              <li>VP Finance with 14 years in healthcare services</li>
              <li>Matches your open CFO search for a regional health system</li>
            </ul>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Where they are now" why="shown only because Dana chose to share her search status and where she lands.">
            <p className="text-sm"><span className="font-medium text-ink">Interviewing</span> <span className="text-muted-foreground">· since 11/10/2026</span></p>
            <p className="text-xs text-muted-foreground">Shared with Hartley Search: My search status · Where I land. They can change this at any time.</p>
          </Panel>
          <Panel title="Resume" why="only your firm can open the file she sent.">
            <p className="text-sm text-ink">whitfield-resume.pdf · 11/4/2026</p>
          </Panel>
        </div>
      </div>
    </PortalFrame>
  )
}
