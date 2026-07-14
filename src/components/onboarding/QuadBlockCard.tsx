'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Statement {
  id: string
  statementText: string
}

export function QuadBlockCard({
  blockId,
  statements,
  onAnswered,
  highlighted,
}: {
  blockId: string
  statements: Statement[]
  onAnswered?: (blockId: string) => void
  highlighted?: boolean
}) {
  const [leastLikeMe, setLeastLikeMe] = useState<string | null>(null)

  return (
    <fieldset
      id={`quad-block-${blockId}`}
      className={cn(
        'space-y-3 rounded-xl border border-border bg-off-white p-4 transition-shadow',
        highlighted && 'border-destructive ring-2 ring-destructive/40'
      )}
    >
      <legend className="sr-only">Pick the statement least like you</legend>
      <div className="space-y-3">
        {statements.map((statement) => {
          const isSelected = leastLikeMe === statement.id
          return (
            <button
              key={statement.id}
              type="button"
              onClick={() => {
                setLeastLikeMe(statement.id)
                onAnswered?.(blockId)
              }}
              aria-pressed={isSelected}
              className={cn(
                'flex w-full items-center gap-4 rounded-lg border-2 bg-white p-4 text-left transition-colors',
                isSelected
                  ? 'border-brand bg-brand/5'
                  : 'border-border hover:border-brand/40 hover:bg-brand/5'
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected ? 'border-brand bg-brand' : 'border-light-gray bg-white'
                )}
              >
                {isSelected && (
                  <svg viewBox="0 0 24 24" fill="none" className="size-3.5 text-white">
                    <path
                      d="M6 12l4 4 8-8"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="text-lg leading-snug text-foreground">{statement.statementText}</span>
            </button>
          )
        })}
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        Tap the one <span className="text-brand">least</span> like you.
      </p>
      {leastLikeMe && (
        <>
          <input type="hidden" name="quadBlockId" value={blockId} />
          <input type="hidden" name="quadLeastLikeMe" value={leastLikeMe} />
        </>
      )}
    </fieldset>
  )
}
