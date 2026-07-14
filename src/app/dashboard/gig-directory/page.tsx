import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Platform {
  name: string
  description: string
  url: string
}

interface PlatformCategory {
  title: string
  description: string
  platforms: Platform[]
}

const CATEGORIES: PlatformCategory[] = [
  {
    title: 'Fractional & interim leadership',
    description: 'Part-time executive roles — CFO, CMO, COO, and similar — at growing companies.',
    platforms: [
      { name: 'Toptal', description: 'Vetted freelance network for top-tier engineering, design, and finance talent.', url: 'https://www.toptal.com' },
      { name: 'Catalant', description: 'Marketplace connecting consultants and fractional executives with enterprise projects.', url: 'https://www.catalant.com' },
      { name: 'Business Talent Group', description: 'Independent consultants and executives for strategy, ops, and marketing engagements.', url: 'https://www.businesstalentgroup.com' },
    ],
  },
  {
    title: 'Management & strategy consulting',
    description: 'Project-based consulting work, often for former in-house strategy/ops professionals.',
    platforms: [
      { name: 'GLG (Gerson Lehrman Group)', description: 'Expert network connecting professionals with paid consulting calls and projects.', url: 'https://glg.it' },
      { name: 'Guidepoint', description: 'Expert network similar to GLG, spanning most industries.', url: 'https://www.guidepoint.com' },
      { name: 'MBO Partners', description: 'Platform and back-office support for independent consultants building a client base.', url: 'https://www.mbopartners.com' },
    ],
  },
  {
    title: 'Specialized freelance (finance, legal, HR)',
    description: 'Marketplaces built around a specific function rather than general freelancing.',
    platforms: [
      { name: 'Paro', description: 'Freelance marketplace for accounting, finance, and bookkeeping professionals.', url: 'https://paro.ai' },
      { name: 'Hire an Esquire', description: 'Freelance and contract marketplace for lawyers.', url: 'https://www.hireanesquire.com' },
      { name: 'Chief', description: 'Network and community for senior women executives, including fractional roles.', url: 'https://chief.com' },
    ],
  },
  {
    title: 'General freelance marketplaces',
    description: 'Broad platforms covering a wide range of skills and project sizes.',
    platforms: [
      { name: 'Upwork', description: 'The largest general freelance marketplace, spanning nearly every skill.', url: 'https://www.upwork.com' },
      { name: 'Fiverr Pro', description: "Fiverr's vetted tier for more senior, higher-rate freelance work.", url: 'https://www.fiverr.com/pro' },
      { name: 'Malt', description: 'Freelance marketplace strong in Europe, spanning tech, marketing, and consulting.', url: 'https://www.malt.com' },
      { name: 'We Work Remotely', description: 'Remote-first job board covering both contract and full-time roles.', url: 'https://weworkremotely.com' },
    ],
  },
]

export default function GigDirectoryPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fractional &amp; Gig Directory</h1>
        <p className="mt-1 text-muted-foreground">
          Real platforms for fractional, consulting, and contract work — useful as a bridge while you
          search, or as a real Gap Analysis remediation path in its own right. NextChapter isn&apos;t
          affiliated with any of these; do your own diligence before signing up.
        </p>
      </div>

      {CATEGORIES.map((category) => (
        <div key={category.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{category.title}</h2>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {category.platforms.map((platform) => (
              <Card key={platform.name}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {platform.name}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{platform.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
