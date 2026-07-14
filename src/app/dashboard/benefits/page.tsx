import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ResourceLink {
  name: string
  url: string
}

interface Topic {
  title: string
  body: string[]
  links: ResourceLink[]
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
    ],
    links: [
      { name: 'Healthcare.gov — losing job-based coverage', url: 'https://www.healthcare.gov/unemployed/' },
      { name: 'U.S. DOL — COBRA basics', url: 'https://www.dol.gov/general/topic/health-plans/cobra' },
    ],
  },
  {
    title: 'WIOA-funded training',
    body: [
      'The Workforce Innovation and Opportunity Act funds free occupational training and career services through your local American Job Center — often including full tuition for approved certificate programs.',
      "Eligibility is broad (most laid-off and many currently-employed job seekers qualify) and it costs nothing to find out. Start with an eligibility conversation at your local center, not by ruling yourself out.",
    ],
    links: [
      { name: 'Find your local American Job Center', url: 'https://www.careeronestop.org/LocalHelp/AmericanJobCenters/american-job-centers.aspx' },
      { name: 'Search WIOA-eligible training programs', url: 'https://www.careeronestop.org/Toolkit/Training/find-training.aspx' },
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
  },
]

export default function BenefitsPage() {
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

      <div className="grid gap-4 sm:grid-cols-2">
        {TOPICS.map((topic) => (
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
