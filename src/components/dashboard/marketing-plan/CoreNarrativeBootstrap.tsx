'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { generateCoreStatement, generateStoryAdaptations } from '@/app/dashboard/interview-prep/actions'

// First-ever narrative for a candidate with none yet — drafts the row that
// NarrativeManager's list then takes over managing. Split into two Server
// Action calls (not one) for the same reason as MyStoryTab's identical
// handleGenerate: two sequential Anthropic calls in one invocation was
// flirting with Vercel's function duration limit.
export function CoreNarrativeBootstrap() {
  const [isPending, startTransition] = useTransition()

  const handleGenerate = () => {
    startTransition(async () => {
      await generateCoreStatement()
      await generateStoryAdaptations()
    })
  }

  return (
    <Card className={cn(isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm text-muted-foreground">
          One 2-3 sentence statement of who you are professionally — Victoria drafts it from your
          profile, and everything else here adapts from it.
        </p>
        <Button type="button" onClick={handleGenerate} disabled={isPending}>
          {isPending ? 'Drafting…' : 'Draft my Core Narrative Statement'}
        </Button>
      </CardContent>
    </Card>
  )
}
