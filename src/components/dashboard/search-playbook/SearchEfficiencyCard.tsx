import { Card, CardContent } from '@/components/ui/card'
import type { SearchEfficiency } from '@/lib/jobs/search-efficiency'

const TREND_TEXT = { BETTER: 'Better than the four weeks before.', WORSE: 'Worse than the four weeks before.', SAME: 'About the same as the four weeks before.' } as const

// Applications per conversation over the last four weeks. A conversation is an
// interview that landed or a networking meeting. Hidden until there is enough
// activity to read.
export function SearchEfficiencyCard({ efficiency }: { efficiency: SearchEfficiency }) {
  if (efficiency.state === 'NOT_ENOUGH_DATA') return null
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <p className="text-sm font-medium text-foreground">Applications per conversation</p>
        <p className="text-sm text-foreground">{efficiency.headline}</p>
        {efficiency.advice && <p className="text-sm text-muted-foreground">{efficiency.advice}</p>}
        {efficiency.trend && <p className="text-xs text-muted-foreground">{TREND_TEXT[efficiency.trend]}</p>}
        <p className="text-xs text-muted-foreground">
          A conversation is an interview or a networking meeting. Benchmarks come from job-tracker users, who tend to apply more than most.
        </p>
      </CardContent>
    </Card>
  )
}
