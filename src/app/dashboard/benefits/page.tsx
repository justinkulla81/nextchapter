import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { BenefitsPressureForm } from '@/components/dashboard/BenefitsPressureForm'
import { BenefitsActionPlanCard } from '@/components/dashboard/BenefitsActionPlanCard'
import { getBenefitsActionPlanItems } from '@/lib/benefits/action-plan'
import { isBoardReady } from '@/lib/interim-work/board-readiness'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { RunwayCard, type RunwayStateFacts } from '@/components/dashboard/RunwayCard'
import { STATE_UI } from '@/lib/data/state-ui'
import { weeksUnemployed } from '@/lib/outcomes/duration-bucket'
import { isRedesignOn } from '@/lib/redesign/flag'
import { moneyGate, stepHeadline, summarizeSteps } from '@/lib/redesign/benefits'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { SeeAllLink } from '@/components/candidate/SeeAllLink'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { setMoneyHelp } from '@/app/dashboard/money-help/actions'

export const metadata: Metadata = { title: 'Benefits & Financial Bridge' }


interface ResourceLink {
  name: string
  url: string
}

interface Topic {
  title: string
  body: string[]
  links: ResourceLink[]
  // Cross-link to another in-app page instead of an external URL — used to
  // point at Interim Work rather than duplicating bridge-income content here.
  relatedLink?: { label: string; href: string }
}

// Prompt 73 — senior candidates (reusing the same board-readiness signal as
// Interim Work, since a title-string match would be unreliable here too)
// get Rapid Response / Dislocated Worker Unit framing instead of generic
// funded-training copy — that program's career-counseling and job-search
// support is the relevant part for someone who isn't looking to reskill.
// Career-changers stay on the training-focused framing even if senior,
// since they may genuinely want a funded certificate program.
function getWioaTopic(isSenior: boolean): Topic {
  if (isSenior) {
    return {
      title: 'State Rapid Response & Dislocated Worker services',
      body: [
        "As an experienced professional, the most useful part of WIOA is usually not a training program — it's your state's Rapid Response team and Dislocated Worker Unit, which provide a dedicated case manager, career counseling, and job-search support whether or not you ever take a course.",
        'If your layoff was part of a larger workforce reduction, Rapid Response may already have reached out to your former employer — but you can request services directly through your state program even if you missed that outreach.',
      ],
      links: [
        { name: 'U.S. DOL — Rapid Response program', url: 'https://www.dol.gov/agencies/eta/layoffs/rapid-response' },
        { name: 'Find your local American Job Center', url: 'https://www.careeronestop.org/LocalHelp/AmericanJobCenters/american-job-centers.aspx' },
      ],
    }
  }
  return {
    title: 'WIOA-funded training',
    body: [
      'The Workforce Innovation and Opportunity Act funds free occupational training and career services through your local American Job Center — often including full tuition for approved certificate programs.',
      "Eligibility is broad (most laid-off and many currently-employed job seekers qualify) and it costs nothing to find out. Start with an eligibility conversation at your local center, not by ruling yourself out.",
    ],
    links: [
      { name: 'Find your local American Job Center', url: 'https://www.careeronestop.org/LocalHelp/AmericanJobCenters/american-job-centers.aspx' },
      { name: 'Search WIOA-eligible training programs', url: 'https://www.careeronestop.org/Toolkit/Training/find-training.aspx' },
    ],
  }
}

const TOPICS: Topic[] = [
  {
    title: 'Unemployment insurance',
    body: [
      "If you were laid off (not fired for cause, and not a voluntary quit without good reason), you're very likely eligible for unemployment benefits — most states let you apply the same week you lose your job, and back-dated payments are common if you wait.",
      'Rules, weekly amounts, and how long benefits last vary a lot by state. File through your state, not a national site.',
    ],
    links: [{ name: 'Find your state unemployment office', url: 'https://www.careeronestop.org/LocalHelp/UnemploymentBenefits/find-unemployment-benefits.aspx' }],
  },
  {
    title: 'Health insurance bridge',
    body: [
      'COBRA lets you keep your employer health plan for up to 18 months after leaving a job — but you pay the full premium yourself (no employer subsidy), so it can be expensive.',
      'A Healthcare.gov marketplace plan is usually cheaper, and losing job-based coverage qualifies you for a Special Enrollment Period outside the normal open-enrollment window — you do not have to wait.',
      "If you had an employer-sponsored HSA, it's yours to keep, but it may start charging maintenance fees once you're no longer on that employer's plan — rolling it over to a no-fee provider like Lively avoids that.",
    ],
    links: [
      { name: 'Healthcare.gov — losing job-based coverage', url: 'https://www.healthcare.gov/unemployed/' },
      { name: 'U.S. DOL — COBRA basics', url: 'https://www.dol.gov/general/topic/health-plans/cobra' },
      { name: 'Lively — no-fee HSA rollover', url: 'https://www.livelyme.com/' },
    ],
  },
  {
    title: 'Budgeting through a search',
    body: [
      'A job search of unknown length is easier to plan for once you know your real monthly "runway" number: essential expenses divided by savings plus expected unemployment benefits.',
      'Before making any big financial decision — early retirement withdrawals, COBRA vs. marketplace, borrowing — a free session with a nonprofit credit counselor can help you see the real tradeoffs. This is general information, not personalized financial advice.',
    ],
    links: [
      { name: 'Find a nonprofit credit counselor (NFCC)', url: 'https://www.nfcc.org/' },
    ],
    relatedLink: { label: 'Bridging income between roles? See Interim Work →', href: '/dashboard/find-my-job?types=part_time,contract,advisory#independent-work' },
  },
  {
    title: 'Tapping retirement savings or home equity',
    body: [
      "If your runway is running out, two options come up often — but both carry real costs. A 401(k) withdrawal before age 59½ usually means a 10% penalty plus ordinary income tax, though hardship withdrawals and 401(k) loans have narrower rules that avoid some of that cost. If you're rolling an old 401(k) into an IRA rather than withdrawing, Capitalize does it free (they're paid by the receiving brokerage, not by you).",
      'A home equity loan or HELOC can offer a lower interest rate than credit cards or personal loans, but your home is the collateral — missed payments put it at risk. Talk to your plan administrator or lender directly before deciding, and see the credit counselor above first if you can.',
      "This is also a good moment to make sure your beneficiary designations and any will are current — job loss and a change in income are exactly the kind of life event that makes people put this off longer than they should. Trust & Will handles both for a flat fee, well below a traditional estate attorney.",
    ],
    links: [
      { name: 'IRS — hardships, early withdrawals, and 401(k) loans', url: 'https://www.irs.gov/retirement-plans/hardships-early-withdrawals-and-loans' },
      { name: 'CFPB — home equity loans and HELOCs', url: 'https://www.consumerfinance.gov/consumer-tools/home-equity/' },
      { name: 'Capitalize — free 401(k) rollover', url: 'https://www.hicapitalize.com/' },
      { name: 'Trust & Will — wills & beneficiary planning', url: 'https://trustandwill.com/' },
    ],
  },
  {
    title: 'Severance packages & negotiation',
    body: [
      "A severance offer is usually a starting point, not a final number — especially if you're being asked to sign a release of claims in exchange for it. It's reasonable to ask for a few days to review before signing, and to ask whether the weeks-of-pay formula, COBRA subsidy, or outplacement support is negotiable.",
      "What to check for in the package: how severance is calculated (often weeks of pay per year of service), whether unused PTO is paid out, whether COBRA premiums are subsidized and for how long, whether unvested equity accelerates or is forfeited, and exactly what you're releasing legal claims to in exchange.",
      "If you're 40 or older, U.S. law (the Older Workers Benefit Protection Act) requires at least 21 days to consider an individual severance offer and a 7-day revocation window after signing — don't let anyone rush you past that.",
      'A short consultation with an employment attorney (many offer a flat-fee severance review) is often worth it before signing anything, particularly for a package above a few weeks of pay or if you suspect the separation wasn\'t routine.',
    ],
    links: [
      { name: 'EEOC — Older Workers Benefit Protection Act (OWBPA) basics', url: 'https://www.eeoc.gov/older-workers-benefit-protection-act' },
      { name: 'U.S. DOL — severance pay overview', url: 'https://www.dol.gov/general/topic/wages/severancepay' },
    ],
  },
]

// These two topics' own detail boxes are folded into the action plan below
// instead of getting a separate panel — their links are pulled in there,
// keeping WIOA/budgeting/retirement/severance as the standalone topic cards.
const ACTION_PLAN_LINK_TOPICS = ['Unemployment insurance', 'Health insurance bridge']

export default async function BenefitsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [profile, params] = await Promise.all([getDashboardProfile(), searchParams])
  const redesign = isRedesignOn(profile.email)
  const gate = moneyGate(profile.moneyHelp)
  const fullPage = !redesign || params.view === 'all'

  // Money is the member's to ask for: the question comes first, and a no leaves the page quiet.
  if (redesign && !fullPage && gate !== 'on') {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Finances and benefits"
          intro={gate === 'ask' ? 'Money is personal, so we only get into it if you want us to.' : 'Help with money is off, so nothing here asks about pay or savings.'}
          action={gate === 'off' ? <ActionLink variant="primary" href="/dashboard/money-help" event="money_help_turn_on_clicked" props={{ surface: 'benefits_page' }}>Turn on money help</ActionLink> : undefined}
        />
        {gate === 'ask' && (
          <section aria-labelledby="money-ask" className="space-y-4 rounded-2xl border border-border p-6 sm:p-7">
            <h2 id="money-ask" className="font-display text-2xl font-semibold text-ink">Would you like help with money while you search?</h2>
            <p className="max-w-xl text-base text-ink">Yes shows how long your money lasts and the deadlines you could miss, like health coverage and unemployment. You can change your mind any time, and nothing here is shared with employers, recruiters or schools.</p>
            <div className="flex flex-wrap gap-3">
              <form action={setMoneyHelp}>
                <input type="hidden" name="moneyHelp" value="yes" />
                <input type="hidden" name="surface" value="benefits_page" />
                <ActionSubmit variant="secondary" pendingLabel="Turning it on…" event="money_help_chosen" props={{ choice: 'yes', surface: 'benefits_page' }}>Yes, help me with money</ActionSubmit>
              </form>
              <form action={setMoneyHelp}>
                <input type="hidden" name="moneyHelp" value="no" />
                <input type="hidden" name="surface" value="benefits_page" />
                <ActionSubmit variant="secondary" pendingLabel="Saving…" event="money_help_chosen" props={{ choice: 'no', surface: 'benefits_page' }}>No, keep money out of it</ActionSubmit>
              </form>
            </div>
          </section>
        )}
        <SeeAllLink href="/dashboard/benefits?view=all">Read the general benefits guide anyway</SeeAllLink>
      </div>
    )
  }

  const isSenior = isBoardReady(profile) && !isPivotingProfile(profile)
  const budgetingIndex = TOPICS.findIndex((t) => t.title === 'Budgeting through a search')
  const topics = [...TOPICS.slice(0, budgetingIndex), getWioaTopic(isSenior), ...TOPICS.slice(budgetingIndex)]
  const actionPlanLinks = topics.filter((t) => ACTION_PLAN_LINK_TOPICS.includes(t.title)).flatMap(
    (t) => t.links
  )
  const cardTopics = topics.filter((t) => !ACTION_PLAN_LINK_TOPICS.includes(t.title))
  const actionItems = getBenefitsActionPlanItems(profile.benefitsPressures)
  const completedItemIds = new Set(profile.benefitsActionPlanCompletedItems)

  const code = profile.currentState && profile.currentState.length === 2 ? profile.currentState.toUpperCase() : null
  const ui = code ? STATE_UI[code] : undefined
  const runwayFacts: RunwayStateFacts | null = ui
    ? {
        stateCode: ui.code,
        agencyName: ui.agencyName.value,
        fileUrl: ui.fileUrl.value,
        maxWeeks: ui.maxWeeks.value,
        maxWeeklyBenefit: ui.maxWeeklyBenefit.value,
        durationVaries: ui.durationVaries.value,
        severanceNote: ui.severance.value,
        asOf: ui.maxWeeks.asOf,
      }
    : null
  const weeksSinceLastJob = weeksUnemployed(profile.lastJobEndedAt, new Date())

  if (redesign && !fullPage) {
    // Benefits and deadlines in the redesign: your next steps, your runway, and the full guide behind one fold.
    const steps = summarizeSteps(actionItems, completedItemIds)
    const fileUrl = runwayFacts?.fileUrl ?? null
    return (
      <div className="space-y-8">
        <PageHeader
          title="Benefits and deadlines"
          intro="The paperwork that has a date on it, in the order it matters. Private to you."
          action={
            fileUrl ? (
              <ActionLink variant="primary" href={fileUrl} external event="benefits_state_site_opened" props={{ state: runwayFacts?.stateCode ?? null, source: 'benefits_header' }}>
                Open {runwayFacts?.agencyName ?? 'your state'}’s site
              </ActionLink>
            ) : steps.next ? (
              <ActionLink href="#steps" variant="primary" event="benefits_next_step_clicked" props={{ step: steps.next.id }}>
                See your next step
              </ActionLink>
            ) : undefined
          }
        />

        <Section id="steps" title={profile.benefitsPressures.length === 0 ? 'What is weighing on you?' : 'Your next steps'}>
          {profile.benefitsPressures.length === 0 ? (
            <BenefitsPressureForm />
          ) : actionItems.length === 0 ? (
            <p className="rounded-2xl border border-border p-5 text-base text-ink">No steps are open. If something changes, tell us and we will update your list.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {steps.done} of {steps.total} done. We chose these from what you told us is weighing on you.{steps.next ? ` Next: ${stepHeadline(steps.next.text)}.` : ' You have finished them all.'}
              </p>
              <div className="space-y-2">
                {actionItems.slice(0, 3).map((item) => (
                  <BenefitsActionPlanCard key={item.id} item={item} completed={completedItemIds.has(item.id)} />
                ))}
              </div>
              {actionItems.length > 3 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">Show the other {actionItems.length - 3} {actionItems.length - 3 === 1 ? 'step' : 'steps'}</summary>
                  <div className="mt-2 space-y-2">
                    {actionItems.slice(3).map((item) => (
                      <BenefitsActionPlanCard key={item.id} item={item} completed={completedItemIds.has(item.id)} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </Section>

        <RunwayCard facts={runwayFacts} weeksSinceLastJob={weeksSinceLastJob} />

        <MoreDetails summary="Show more: the full benefits guide">
          {actionPlanLinks.length > 0 && (
            <div className="space-y-1">
              <p className="text-base font-semibold text-ink">Where to start</p>
              {actionPlanLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-brand underline underline-offset-4">
                  {link.name}
                </a>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {cardTopics.map((topic) => (
              <section key={topic.title} className="space-y-3 rounded-2xl border border-border p-5">
                <h2 className="font-display text-lg font-semibold text-ink">{topic.title}</h2>
                {topic.body.map((paragraph, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{paragraph}</p>
                ))}
                <div className="space-y-1">
                  {topic.links.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-brand underline underline-offset-4">
                      {link.name}
                    </a>
                  ))}
                  {topic.relatedLink && (
                    <Link href={topic.relatedLink.href} className="block text-sm font-medium text-brand underline underline-offset-4">
                      {topic.relatedLink.label}
                    </Link>
                  )}
                </div>
              </section>
            ))}
          </div>
          <p className="text-sm text-ink">
            Looking for discounts on programs and degrees?{' '}
            <Link href="/dashboard/benefits-network" className="font-medium text-brand underline underline-offset-4">See the higher education benefits network</Link>.
          </p>
          <GuideCallout pageSlot="benefits" currentJobStatus={profile.currentJobStatus} />
        </MoreDetails>

        <p className="text-xs text-muted-foreground">General information, not financial or legal advice. Rules differ by state. Only you see this page. <Link href="/dashboard/money-help" className="font-medium text-brand underline underline-offset-4">Money help settings</Link></p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {redesign && <SeeAllLink href="/dashboard/benefits">Back to benefits and deadlines</SeeAllLink>}
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Benefits &amp; Financial Bridge</h1>
        <p className="mt-1 text-muted-foreground">
          Practical starting points for the money side of a job search — unemployment, health
          coverage, funded training, and budgeting. General information, not personalized financial
          or legal advice; program details vary by state.
        </p>
        <PageHeaderBoxes pageKey="benefits" candidateId={profile.id} />
      </div>

      <RunwayCard facts={runwayFacts} weeksSinceLastJob={weeksSinceLastJob} />

      {profile.benefitsPressures.length === 0 ? (
        <BenefitsPressureForm />
      ) : (
        <>
          {actionItems.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Your action plan</h2>
              <div className="space-y-2">
                {actionItems.map((item) => (
                  <BenefitsActionPlanCard key={item.id} item={item} completed={completedItemIds.has(item.id)} />
                ))}
              </div>
              <div className="space-y-1 border-t border-border pt-3">
                {actionPlanLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-primary underline underline-offset-4"
                  >
                    {link.name} →
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {cardTopics.map((topic) => (
              <Card key={topic.title}>
                <CardHeader>
                  <CardTitle className="text-base">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topic.body.map((paragraph, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                  <div className="space-y-1 pt-1">
                    {topic.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary underline underline-offset-4"
                      >
                        {link.name} →
                      </a>
                    ))}
                    {topic.relatedLink && (
                      <Link
                        href={topic.relatedLink.href}
                        className="block text-sm text-primary underline underline-offset-4"
                      >
                        {topic.relatedLink.label}
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <GuideCallout pageSlot="benefits" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
