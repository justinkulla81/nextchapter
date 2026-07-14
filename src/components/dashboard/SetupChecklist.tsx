import Link from 'next/link'
import { Check, Circle } from 'lucide-react'
import type { SetupChecklistItem } from '@/lib/onboarding/setup-checklist'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function SetupChecklist({ items }: { items: SetupChecklistItem[] }) {
  const completedCount = items.filter((item) => item.completed).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Setup checklist — {completedCount} of {items.length} complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {item.completed ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className={cn(
                  'text-sm',
                  item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                )}
              >
                {item.label}
              </span>
            </div>
            {!item.completed && item.href && (
              <Link
                href={item.href}
                className="shrink-0 text-sm text-primary underline underline-offset-4"
              >
                {item.ctaLabel}
              </Link>
            )}
            {!item.completed && item.action && (
              <form action={item.action}>
                <button
                  type="submit"
                  className="shrink-0 text-sm text-primary underline underline-offset-4"
                >
                  {item.ctaLabel}
                </button>
              </form>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
