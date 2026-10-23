import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Callout } from '@/components/candidate/Callout'
import { Chip, PrimaryButton, SecondaryButton, TextLink } from '@/components/candidate/ui'
import { ExposureFact, ExposureTag, JobsByExposure } from '@/components/candidate/AiExposure'
import { bandOf, summarizeJobsByExposure, type OccupationExposure } from '@/lib/skills/ai-exposure'

// Anthropic Economic Index "observed exposure" on four candidate pages. Sample data, real scores from the
// loaded table. Each page names what the new line replaces, because a change to a candidate page must say
// what it removes (docs/candidate-redesign.md).
const occ = (soc6: string, title: string, score: number): OccupationExposure => ({ soc6, title, score, band: bandOf(score) })
const YOU = occ('11-1021', 'General and Operations Managers', 0.1378)
const MGMT_ANALYST = occ('13-1111', 'Management Analysts', 0.2435)
const FIN_MANAGER = occ('11-3031', 'Financial Managers', 0.3907)
const COMPLIANCE = occ('13-1041', 'Compliance Officers', 0.1211)
const PROJECT = occ('11-9199', 'Managers, All Other', 0.0686)

// The real split of openings today: 453,365 placed in a measured occupation of 747,195 approved openings.
const SPLIT = summarizeJobsByExposure(
  [
    { soc6: '15-1251', count: 151045 },
    { soc6: '11-1021', count: 130253 },
    { soc6: '47-2111', count: 172067 },
    { soc6: null, count: 293830 },
  ],
  new Map([
    ['15-1251', { title: 'high', score: 0.7 }],
    ['11-1021', { title: 'some', score: 0.14 }],
    ['47-2111', { title: 'little', score: 0 }],
  ]),
)

function Replaces({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"><span className="font-semibold text-ink">What this replaces: </span>{children}</p>
}

// 1. Market reality report: one line inside "The short version", not a new section.
export function ExposureMarketReport() {
  return (
    <PreviewShell place="jobs" entry="market" part="market">
      <PageHeader title="Your market reality" intro="How a recruiter, hiring manager and search firm will read you, and what to fix first." action={<PrimaryButton>Start with fix 1</PrimaryButton>} />
      <Replaces>the line “AI is reshaping this work: learning it is critical” in the short version. That line came from a broad job-group estimate; this one is for your occupation and from real usage.</Replaces>
      <Module title="The short version">
        <p className="text-lg text-ink">You are qualified for the roles you want, and few people are. The search will be slow unless a warm introduction opens the door, so build that first and fix the résumé in parallel.</p>
        <div className="rounded-xl bg-muted/70 p-4 space-y-4">
          <p className="text-sm font-semibold text-ink">AI at work, for the roles you are going after</p>
          <ExposureFact exposure={YOU} credit={false} />
          <JobsByExposure split={SPLIT} label="Openings we see by AI exposure" />
        </div>
      </Module>
    </PreviewShell>
  )
}

// 2. Job search strategy: the "AI skills" line in the market section becomes the openings split.
export function ExposureSearchStrategy() {
  return (
    <PreviewShell place="home" entry="tailored">
      <PageHeader title="Your search strategy" intro="How many roles are open to you, and where to point your time." action={<PrimaryButton>Review my target roles</PrimaryButton>} />
      <Replaces>the “AI skills: …” line under the number of open roles. The skills line moves into the Learn page, where the courses are.</Replaces>
      <Module title="Roles open to you">
        <p className="text-lg text-ink"><span className="font-semibold">12,400</span> openings match your target field and level.</p>
        <JobsByExposure split={SPLIT} label="Openings we see by AI exposure" />
        <Callout>Roles in work with less observed AI use are not safer, only less changed so far. Widening to a nearby role with openings in both groups gives you more to apply to. <TextLink>See nearby roles</TextLink></Callout>
      </Module>
    </PreviewShell>
  )
}

// 3. Career pivots: each option carries one tag; the pay-change and market facts stay as they are.
export function ExposurePivots() {
  const options: [OccupationExposure, string, string][] = [
    [MGMT_ANALYST, '+6% pay', '2,310 openings near you'],
    [FIN_MANAGER, '+18% pay', '980 openings near you'],
    [COMPLIANCE, '+4% pay', '1,140 openings near you'],
    [PROJECT, 'Same pay', '3,050 openings near you'],
  ]
  return (
    <PreviewShell place="learn" entry="path" part="roles">
      <PageHeader title="Where you could go next" intro="Roles that use what you already do, with the pay and openings for each." action={<PrimaryButton>Compare my top two</PrimaryButton>} />
      <Replaces>the “AI task exposure: high, medium or low” line on each role, which came from a broad job-group estimate. The tag is now for the exact occupation, from real usage.</Replaces>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {options.map(([o, pay, openings]) => (
          <li key={o.soc6} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="max-w-xl space-y-1">
              <p className="text-base font-semibold text-ink">{o.title}</p>
              <p className="text-sm text-muted-foreground">{pay} compared with your role in your area. {openings}.</p>
              <div className="flex gap-2"><ExposureTag exposure={o} /><Chip>Same skills: 74%</Chip></div>
            </div>
            <SecondaryButton>See this role</SecondaryButton>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">AI exposure measures how much AI is already used for a role&rsquo;s tasks. It is not a forecast. Source: <TextLink href="https://www.anthropic.com/research/labor-market-impacts">Anthropic Economic Index</TextLink>, March 2026.</p>
    </PreviewShell>
  )
}

// 4. Learning: the featured course says why it is first. The need comes from the role's exposure and the openings.
export function ExposureLearn() {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <PageHeader title="What to learn next" intro="One course to start, picked from the roles you are going after." action={<PrimaryButton>Start this course</PrimaryButton>} />
      <Replaces>the generic “AI Training” description line. It now says why an AI course is first for you, or says it is optional.</Replaces>
      <Module title="Start here">
        <div className="space-y-1">
          <p className="text-xl font-semibold text-ink">Using AI for operations and planning</p>
          <p className="text-base text-muted-foreground">3 hours. Practical prompts and checks for the planning, reporting and vendor work in your role.</p>
        </div>
        <div className="rounded-xl bg-muted/70 p-4 space-y-2">
          <p className="text-sm font-semibold text-ink">Why this first</p>
          <p className="text-base text-ink">Learn AI tools alongside your other skills. Part of the work is already changing: AI is used for some of the tasks in general and operations manager work, and 31% of the openings we could place ask for an AI skill.</p>
          <p className="text-sm text-muted-foreground">Exposure is from real usage and is not a forecast of job loss. Openings are what postings ask for, not a test of you.</p>
          <p className="text-xs text-muted-foreground">Source: <a href="https://www.anthropic.com/research/labor-market-impacts" className="underline underline-offset-4">Anthropic Economic Index</a>, March 2026.</p>
        </div>
      </Module>
      <p className="text-sm text-muted-foreground">For a role with little observed use, this line reads &ldquo;AI skills are optional for this role right now. Little use is seen so far,&rdquo; and the course shown is the best match for the roles, not an AI one.</p>
    </PreviewShell>
  )
}
