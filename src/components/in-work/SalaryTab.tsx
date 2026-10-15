'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { posthog } from '@/lib/posthog/client'
import { loadMarketRange, type MarketRangeResult } from '@/app/dashboard/in-work/actions'
import { computeAskRange, formatUsd, type NegotiationSituation } from '@/lib/in-work/ask-range'
import { NEGOTIATION_SCRIPTS, fillTemplate } from '@/lib/in-work/templates'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'
import { ChoiceButtons, CopyBlock, Field, Section } from './shared'

const SITUATIONS: readonly { key: NegotiationSituation; label: string }[] = [
  { key: 'RAISE', label: 'A raise' },
  { key: 'PROMOTION', label: 'A promotion' },
  { key: 'COUNTER_OFFER', label: 'Counter to an offer' },
]

function num(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null
}

export function SalaryTab() {
  const [situation, setSituation] = useState<NegotiationSituation>('RAISE')
  const [base, setBase] = useState('')
  const [offer, setOffer] = useState('')
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const [market, setMarket] = useState<Extract<MarketRangeResult, { ok: true }> | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [calcAt, setCalcAt] = useState(0)

  const result = useMemo(
    () =>
      calcAt === 0
        ? null
        : computeAskRange({
            situation,
            currentBase: num(base) ?? 0,
            marketLow: num(low),
            marketHigh: num(high),
            competingOfferBase: num(offer),
          }),
    // Recompute only when the member presses Calculate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calcAt],
  )

  function showMarket() {
    setMarketError(null)
    startLoad(async () => {
      try {
        const r = await loadMarketRange()
        if (!r.ok) {
          setMarketError(r.error)
          return
        }
        setMarket(r)
        if (r.available && r.low && r.high) {
          setLow(String(r.low))
          setHigh(String(r.high))
        }
      } catch {
        setMarketError('We could not load the market range. Try again.')
      }
    })
  }

  const script = NEGOTIATION_SCRIPTS[situation]
  const ask = result?.ok ? formatUsd(result.range.target) : undefined
  const opener = fillTemplate(script.opener, {
    period: '[time period]',
    win: '[your top result, with a number]',
    ask,
    level: '[the title or level]',
    offer: num(offer) ? formatUsd(num(offer)!) : undefined,
    date: '[date]',
  })

  return (
    <div className="space-y-6">
      <Section
        title="Market range for your role"
        intro="From our own data. If we do not have enough, we say so and show no number."
      >
        <div className={cn('space-y-3', loading && 'cursor-wait')}>
          <Button variant="outline" disabled={loading} onClick={showMarket}>
            {loading ? 'Looking up…' : market ? 'Refresh market range' : 'Show market range'}
          </Button>
          {marketError && <p className="text-sm text-destructive">{marketError}</p>}
          {market && market.available && market.low && market.high && (
            <div className="space-y-1 text-sm">
              <p className="text-base font-semibold text-foreground">
                {formatUsd(market.low)} to {formatUsd(market.high)}
              </p>
              <p className="text-muted-foreground">
                {market.note} Based on {market.sampleSize} posting{market.sampleSize === 1 ? '' : 's'}
                {market.role ? ` for ${market.role}` : ''}
                {market.place ? ` in ${market.place}` : ''}. Posted ranges are what employers advertise, not what people are paid.
              </p>
              {market.source === 'adzuna' && <AdzunaAttribution surface="in_work_salary" />}
            </div>
          )}
          {market && !market.available && <p className="text-sm text-muted-foreground">{market.note}</p>}
        </div>
      </Section>

      <Section title="Ask-range calculator" intro="Your numbers stay in this browser tab. We do not store your pay.">
        <div className="space-y-4">
          <Field label="What are you asking for?">
            <ChoiceButtons value={situation} options={SITUATIONS} onChange={setSituation} label="Situation" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your current annual base pay">
              <Input inputMode="numeric" placeholder="120000" value={base} onChange={(e) => setBase(e.target.value)} />
            </Field>
            {situation === 'COUNTER_OFFER' && (
              <Field label="Base pay in the competing offer">
                <Input inputMode="numeric" placeholder="140000" value={offer} onChange={(e) => setOffer(e.target.value)} />
              </Field>
            )}
            {situation !== 'COUNTER_OFFER' && (
              <>
                <Field label="Market range, low (optional)" hint="Filled from our data when you load it above. You can use your own.">
                  <Input inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value)} />
                </Field>
                <Field label="Market range, high (optional)">
                  <Input inputMode="numeric" value={high} onChange={(e) => setHigh(e.target.value)} />
                </Field>
              </>
            )}
          </div>
          <Button
            disabled={!num(base) || (situation === 'COUNTER_OFFER' && !num(offer))}
            onClick={() => {
              setCalcAt(Date.now())
              posthog.capture('in_work_ask_range_calculated', {
                situation,
                hasMarketRange: !!(num(low) && num(high)),
                marketSource: market?.source ?? 'manual',
              })
            }}
          >
            Calculate my ask range
          </Button>
          {(!num(base) || (situation === 'COUNTER_OFFER' && !num(offer))) && (
            <p className="text-xs text-muted-foreground">
              Enter your current base{situation === 'COUNTER_OFFER' ? ' and the offer base' : ''} to calculate.
            </p>
          )}

          {result && !result.ok && <p className="text-sm text-destructive">{result.error}</p>}
          {result?.ok && (
            <div className="space-y-3 rounded-lg border border-border bg-off-white p-4">
              <div className="grid gap-3 text-center sm:grid-cols-3">
                <Figure label="Lowest to accept" value={formatUsd(result.range.floor)} />
                <Figure label="Your target" value={formatUsd(result.range.target)} strong />
                <Figure label="Open with" value={formatUsd(result.range.stretch)} />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Why these numbers</p>
                <ul className="list-disc space-y-1 pl-5 text-foreground/80">
                  {result.range.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              {result.range.cautions.length > 0 && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">Watch for</p>
                  <ul className="list-disc space-y-1 pl-5 text-foreground/80">
                    {result.range.cautions.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title="Who, when and how" intro="Pick your situation for a plan you can follow.">
        <ChoiceButtons
          value={situation}
          options={SITUATIONS}
          onChange={(s) => {
            setSituation(s)
            posthog.capture('in_work_script_viewed', { situation: s })
          }}
          label="Script situation"
        />
        <div className="space-y-3 text-sm">
          <p className="text-base font-semibold text-foreground">{script.title}</p>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium text-foreground">Who</dt>
              <dd className="text-foreground/80">{script.who}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">When</dt>
              <dd className="text-foreground/80">{script.when}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">How</dt>
              <dd className="text-foreground/80">{script.how}</dd>
            </div>
          </dl>
          <div>
            <p className="font-medium text-foreground">Outline</p>
            <ol className="list-decimal space-y-1 pl-5 text-foreground/80">
              {script.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Opening line</p>
            <CopyBlock text={opener} label="Copy opening line" />
            <p className="mt-1 text-xs text-muted-foreground">Words in [brackets] are yours to fill in.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Avoid</p>
            <ul className="list-disc space-y-1 pl-5 text-foreground/80">
              {script.pitfalls.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Practice with feedback">
        <p className="text-sm text-foreground/80">
          The counter-offer practice tool gives written feedback on your draft ask. It lives on each job in your list under
          Find a Full-time Job, and it uses an AI model to read your draft.
        </p>
        <Link href="/dashboard/find-my-job" className="text-sm font-medium text-brand underline">
          Open Find a Full-time Job
        </Link>
      </Section>
    </div>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-background px-3 py-3', strong ? 'border-brand' : 'border-border')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-semibold text-foreground', strong ? 'text-xl' : 'text-lg')}>{value}</p>
    </div>
  )
}
