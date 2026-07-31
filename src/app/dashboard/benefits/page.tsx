import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { BenefitsPressureForm } from '@/components/dashboard/BenefitsPressureForm'
import { BenefitsActionPlanCard } from '@/components/dashboard/BenefitsActionPlanCard'
import { getBenefitsActionPlanItems } from '@/lib/benefits/action-plan'
import { isBoardReady } from '@/lib/interim-work/board-readiness'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
    relatedLink: { label: 'Bridging income between roles? See Interim Work →', href: '/dashboard/interim-work' },
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

export default async function BenefitsPage() {
  const profile = await getDashboardData()
  const isSenior = isBoardReady(profile) && !profile.isPivoting
  const budgetingIndex = TOPICS.findIndex((t) => t.title === 'Budgeting through a search')
  const topics = [...TOPICS.slice(0, budgetingIndex), getWioaTopic(isSenior), ...TOPICS.slice(budgetingIndex)]
  const actionPlanLinks = topics.filter((t) => ACTION_PLAN_LINK_TOPICS.includes(t.title)).flatMap(
    (t) => t.links
  )
  const cardTopics = topics.filter((t) => !ACTION_PLAN_LINK_TOPICS.includes(t.title))
  const actionItems = getBenefitsActionPlanItems(profile.benefitsPressures)
  const completedItemIds = new Set(profile.benefitsActionPlanCompletedItems)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Benefits &amp; Financial Bridge</h1>
        <p className="mt-1 text-muted-foreground">
          Practical starting points for the money side of a job search — unemployment, health
          coverage, funded training, and budgeting. General information, not personalized financial
          or legal advice; program details vary by state.
        </p>
      </div>

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
    </div>
  )
}
