'use client'

import { useState, useTransition } from 'react'
import { reviewReferenceQuote } from '@/app/dashboard/references/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface PendingReferenceQuote {
  id: string
  theme: string
  quoteText: string
  refereeName: string
}

// Mandatory candidate-approval gate (Prompt 48) — nothing here becomes
// Dossier-eligible until the candidate explicitly approves it. Each card
// disappears from this list once acted on (revalidatePath re-fetches only
// the still-pending ones).
export function ReferenceQuoteReview({ quotes, redesign = false }: { quotes: PendingReferenceQuote[]; redesign?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [actingOn, setActingOn] = useState<string | null>(null)

  if (quotes.length === 0) return null

  function act(quoteId: string, approve: boolean) {
    setActingOn(quoteId)
    startTransition(async () => {
      await reviewReferenceQuote(quoteId, approve)
      setActingOn(null)
    })
  }

  // The redesign: each quote is a sentence you can approve or set aside; the uppercase theme label and the card are gone.
  if (redesign) {
    return (
      <section aria-labelledby="quote-review" className="space-y-3">
        <h2 id="quote-review" className="font-display text-xl font-semibold text-ink">Review quotes for your dossier</h2>
        <p className="max-w-xl text-base text-muted-foreground">Victoria drafted these from what your references wrote. Nothing is used until you approve it.</p>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {quotes.map((quote) => (
            <li key={quote.id} className={cn('space-y-3 p-5', pending && actingOn === quote.id && 'opacity-60')}>
              <blockquote className="border-l-2 border-border pl-4 text-base text-ink">&ldquo;{quote.quoteText}&rdquo;</blockquote>
              <p className="text-sm text-muted-foreground">{quote.refereeName}, on {quote.theme.toLowerCase()}</p>
              <div className={cn('flex flex-wrap gap-3', pending && actingOn === quote.id && 'cursor-progress [&_*]:cursor-progress')}>
                <button type="button" onClick={() => act(quote.id, true)} disabled={pending} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70">
                  Approve for my dossier
                </button>
                <button type="button" onClick={() => act(quote.id, false)} disabled={pending} className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-70">
                  Do not use this
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Review quotes for your Dossier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Victoria drafted these from what your references wrote. Nothing gets used until you approve it.
        </p>
      </div>
      {quotes.map((quote) => (
        <Card key={quote.id}>
          <CardContent className={cn('space-y-3 pt-6', pending && actingOn === quote.id && 'opacity-60')}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{quote.theme}</p>
            <blockquote className="border-l-2 border-border pl-4 text-sm italic text-foreground">
              &ldquo;{quote.quoteText}&rdquo;
            </blockquote>
            <p className="text-xs text-muted-foreground">— {quote.refereeName}</p>
            <div
              className={cn('flex gap-2 pt-1', pending && actingOn === quote.id && 'cursor-progress [&_*]:cursor-progress')}
            >
              <Button size="sm" onClick={() => act(quote.id, true)} disabled={pending}>
                Approve for my Dossier
              </Button>
              <Button size="sm" variant="outline" onClick={() => act(quote.id, false)} disabled={pending}>
                Don&apos;t use this
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
