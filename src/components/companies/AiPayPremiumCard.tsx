import type { FunctionPremium } from '@/lib/market/ai-pay-premium'

const fmt = (n: number) => `$${Math.round(n / 1000)}k`

// Shown for the member's own function. Plain about what the number is and is not.
export function AiPayPremiumCard({ row, functionName }: { row: FunctionPremium | null; functionName: string }) {
  if (!row || row.premiumPct === null) return null
  const direction = row.premiumPct > 0 ? 'more' : row.premiumPct < 0 ? 'less' : 'the same'
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">Pay and AI skills in {functionName}</h2>
      <p className="mt-1 text-sm text-foreground">
        {row.premiumPct === 0
          ? `${functionName} postings that ask for AI skills advertise about the same pay as those that do not.`
          : `${functionName} postings that ask for AI skills advertise about ${Math.abs(row.premiumPct)}% ${direction} than comparable ${functionName} postings at the same level.`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        From {row.withAi} postings that ask for AI skills (median {row.medianWithAi ? fmt(row.medianWithAi) : 'n/a'}) and{' '}
        {row.withoutAi} that do not (median {row.medianWithoutAi ? fmt(row.medianWithoutAi) : 'n/a'}) on our board.
        This is advertised pay, not what people were paid, and postings that ask for AI skills also tend to be at
        bigger employers. Read it as a direction, not a promise.
      </p>
    </section>
  )
}
