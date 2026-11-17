import { BoardSearchBar } from '@/components/dashboard/one-board/BoardSearchBar'
import { LookingForChoice } from '@/components/dashboard/one-board/LookingForChoice'
import { ExpertNetworkRow } from '@/components/dashboard/one-board/ExpertNetworkRow'

const NETWORKS = [
  { id: 'glg', name: 'GLG', url: 'https://example.com', description: 'x', logoUrl: null, stage: null },
  { id: 'alpha', name: 'AlphaSights', url: 'https://example.com', description: 'x', logoUrl: null, stage: null },
  { id: 'guide', name: 'Guidepoint', url: 'https://example.com', description: 'x', logoUrl: null, stage: null },
  { id: 'third', name: 'Third Bridge', url: 'https://example.com', description: 'x', logoUrl: null, stage: 'Signed up' },
  { id: 'dialectica', name: 'Dialectica', url: 'https://example.com', description: null, logoUrl: null, stage: 'Accepted' },
  { id: 'coleman', name: 'Coleman Research', url: 'https://example.com', description: null, logoUrl: null, stage: null },
]

// Find a job, Jobs view, with the "What are you looking for?" choice (owner, 2026-11-17). Sample data.
export function FindLookingFor() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <BoardSearchBar />
      <LookingForChoice selected="both" />
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">[job list]</div>
      <p className="text-sm text-muted-foreground">
        No fractional or independent roles match yet. <a href="#" className="text-primary underline underline-offset-4">See independent work</a>
      </p>
      <ExpertNetworkRow networks={NETWORKS as never} />
    </div>
  )
}
