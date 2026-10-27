'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { emailPayCheck, runPayCheck, type PayCheckState } from '@/lib/tools/pay-check-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

// Pick a title, enter yearly pay, see where it sits. Then, if they want it, the result by email, which leads to one
// question about where they are in their search. No résumé and no account at any step.
export function PayCheck({ titles, journeyChoices }: { titles: { slug: string; name: string }[]; journeyChoices: { slug: string; label: string }[] }) {
  const [state, run, running] = useActionState<PayCheckState, FormData>(runPayCheck, {})
  const [mail, sendMail, mailing] = useActionState<PayCheckState, FormData>(emailPayCheck, {})
  const result = state.result

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <form action={run} noValidate className={cn('space-y-4 rounded-xl border border-border bg-white p-6', running && 'cursor-wait')} onSubmit={() => posthog.capture('pay_check_submitted_client')}>
        <label className="block text-sm font-medium text-navy">
          Job title
          <input
            name="title"
            list="pay-check-titles"
            className={FIELD}
            placeholder="Start typing, like Product Manager"
            autoComplete="off"
          />
          <datalist id="pay-check-titles">
            {titles.map((t) => (
              <option key={t.slug} value={t.name} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium text-navy">
          Your yearly pay
          <input name="pay" inputMode="decimal" className={FIELD} placeholder="120000" />
        </label>
        <Button type="submit" disabled={running} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          {running ? 'Checking…' : 'Check my pay'}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>

      {result && (
        <div role="status" className="space-y-4 rounded-xl border border-border bg-white p-6">
          <p className="text-lg font-semibold text-navy">{result.sentence}</p>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[['Lower quarter', result.p25], ['Median', result.median], ['Upper quarter', result.p75]].map(([label, v]) => (
              <div key={label as string} className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">{label as string}</dt>
                <dd className="mt-1 text-lg font-bold text-navy tabular-nums">{usd(v as number)}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg bg-off-white p-4 text-sm">
            <p className="font-semibold text-navy">A range to cite in a pay conversation</p>
            <p className="mt-1 text-muted-foreground">
              Employers advertise {usd(result.median)} (median) to {usd(result.p75)} (upper quarter) for {result.name.toLowerCase()} roles. Those are listings, not offers: use them as evidence, and expect level, city and industry to move the number.
            </p>
          </div>
          {result.ai && (
            <div className="rounded-lg bg-off-white p-4 text-sm" data-testid="pay-check-ai">
              <p className="font-semibold text-navy">What AI skills add, for {result.ai.label} roles</p>
              <p className="mt-1 text-muted-foreground">{result.ai.sentence}</p>
              {result.ai.illustration && (
                <p className="mt-2 text-muted-foreground">
                  Illustration, not a forecast: moving this title’s median by that {result.ai.illustration.pct > 0 ? '+' : ''}{result.ai.illustration.pct}% gives about {usd(result.ai.illustration.medianWithAi)}.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                From {result.ai.nAi.toLocaleString('en-US')} paid listings that ask for an AI skill and {result.ai.nBase.toLocaleString('en-US')} that never mention AI. A difference in advertised pay is not what people are paid and does not show a skill causes a raise.{' '}
                <Link href="/resources/ai-skills-pay-premium" className="underline underline-offset-2" onClick={() => posthog.capture('ai_pay_link_clicked', { page: 'pay_check', cta: 'explainer', title: result.slug })}>
                  See the table for every function
                </Link>
                .
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            From {result.payCount.toLocaleString('en-US')} current listings that state pay, on employers&apos; own career sites. Listed pay is what employers advertise, not what people are paid, and it does not account for your city, level or industry.{' '}
            <Link href={`/salaries/${result.slug}`} className="underline underline-offset-2">See the full range</Link>.
          </p>

          {!mail.token ? (
            <form action={sendMail} noValidate className={cn('border-t border-border pt-4', mailing && 'cursor-wait')} onSubmit={() => posthog.capture('pay_check_email_submitted_client', { title: result.slug })}>
              <p className="text-sm font-semibold text-navy">Want this by email, plus jobs ranked for you?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">One email, no account needed. Add your résumé later and every open job comes back with a fit score.</p>
              <input type="hidden" name="title" value={result.slug} />
              <input type="hidden" name="pay" value={result.pay} />
              <div className="hidden" aria-hidden>
                <label htmlFor="pc-website">Website</label>
                <input id="pc-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="pc-email">Email address</label>
                <input id="pc-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={mail.email} placeholder="you@example.com" className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base" />
                <Button type="submit" disabled={mailing} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                  {mailing ? 'Saving…' : 'Email me'}
                </Button>
              </div>
              {mail.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {mail.error}
                </p>
              )}
            </form>
          ) : (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {mail.emailed ? <>Check your inbox{mail.email ? <> at <span className="font-medium text-foreground">{mail.email}</span></> : ''}.</> : <>Saved{mail.email ? <> for <span className="font-medium text-foreground">{mail.email}</span></> : ''}. The email is turning on soon.</>}
              </p>
              <p className="mt-4 text-sm font-semibold text-navy">Which sounds most like you? One tap sets up your free profile.</p>
              <div className="mt-3 flex flex-col gap-2">
                {journeyChoices.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/api/job-alerts/journey/${encodeURIComponent(mail.token!)}?p=${c.slug}`}
                    className={i === 0 ? 'rounded-full bg-action px-5 py-3 text-center font-semibold text-action-foreground hover:brightness-95' : 'rounded-full border border-border bg-white px-5 py-3 text-center font-medium text-foreground hover:bg-off-white'}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
