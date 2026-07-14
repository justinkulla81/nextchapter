import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Week1Artifact } from '@/lib/sprint/week1'

export function Week1ArtifactSprint({ artifacts }: { artifacts: Week1Artifact[] }) {
  const completedCount = artifacts.filter((a) => a.complete).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Your First Week: 5 Real Things
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">
          This week isn&apos;t about hitting a points target — it&apos;s about producing 5 real
          artifacts you&apos;ll use for the rest of your search. Victoria will check in with you on
          Day 2 either way.
        </p>

        <div className="flex gap-1.5">
          {artifacts.map((artifact) => (
            <span
              key={artifact.id}
              className={cn('h-1.5 flex-1 rounded-full', artifact.complete ? 'bg-success' : 'bg-border')}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {completedCount} of {artifacts.length} done
        </p>

        <div className="divide-y divide-border">
          {artifacts.map((artifact) => (
            <Link
              key={artifact.id}
              href={artifact.href}
              className="flex items-start justify-between gap-3 py-2.5 hover:bg-off-white"
            >
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    artifact.complete ? 'text-muted-foreground line-through' : 'text-foreground'
                  )}
                >
                  {artifact.complete ? '✓ ' : ''}
                  {artifact.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{artifact.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
