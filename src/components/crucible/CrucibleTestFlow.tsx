'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import {
  startCrucibleSession,
  captureCrucibleEmail,
  submitCrucibleChallenge,
  submitCrucibleAiTools,
  submitCrucibleResume,
  logCrucibleInterest,
  type CrucibleResultSummary,
} from '@/app/crucible/actions'
import { CRUCIBLE_VARIANTS, type CrucibleJobIntentKey, type CrucibleVariantKey } from '@/lib/crucible/variants'
import { MECHANISM_OPTIONS, type CrucibleFlag, type CrucibleSeverity, type CrucibleVerdictValue } from '@/lib/crucible/scoring-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CrucibleSource } from '@prisma/client'

type Step = 'fork' | 'email' | 'intro' | 'challenge' | 'tools' | 'resume' | 'results'

const JOB_INTENT_OPTIONS: { value: CrucibleJobIntentKey; label: string }[] = [
  { value: 'TECH', label: 'Tech / Software' },
  { value: 'MARKETING', label: 'Marketing / Content' },
  { value: 'DATA', label: 'Data / Analytics' },
  { value: 'DESIGN', label: 'Design / Creative' },
  { value: 'BUSINESS', label: 'Business / Ops' },
  { value: 'UNSURE', label: 'Not sure yet' },
]

const SEVERITY_OPTIONS: { value: CrucibleSeverity; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'minor', label: 'Minor' },
  { value: 'cosmetic', label: 'Cosmetic' },
]

const AI_TOOL_OPTIONS = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'Copilot', 'Other', 'None, just me']

export function CrucibleTestFlow({ source, skipEmail: initialSkipEmail, skipResume: initialSkipResume }: { source: CrucibleSource; skipEmail: boolean; skipResume: boolean }) {
  const posthog = usePostHog()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('fork')
  const [error, setError] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [variant, setVariant] = useState<CrucibleVariantKey | null>(null)
  const [skipEmail, setSkipEmail] = useState(initialSkipEmail)
  const [skipResume, setSkipResume] = useState(initialSkipResume)

  const [email, setEmail] = useState('')
  const [flags, setFlags] = useState<Map<number, CrucibleFlag>>(new Map())
  const [openLine, setOpenLine] = useState<number | null>(null)
  const [worstThing, setWorstThing] = useState('')
  const [verdict, setVerdict] = useState<CrucibleVerdictValue | null>(null)
  const [aiTools, setAiTools] = useState<string[]>([])
  const [bestMove, setBestMove] = useState('')
  const [result, setResult] = useState<CrucibleResultSummary | null>(null)

  function pickJobIntent(intent: CrucibleJobIntentKey) {
    setError(null)
    startTransition(async () => {
      try {
        const started = await startCrucibleSession(source, intent)
        setSessionId(started.sessionId)
        setVariant(started.variant)
        setSkipEmail(started.skipEmail)
        setSkipResume(started.skipResume)
        posthog?.capture('crucible_fork_pick', { intent, variant: started.variant })
        setStep(started.skipEmail ? 'intro' : 'email')
      } catch {
        setError('Could not start the challenge. Please try again.')
      }
    })
  }

  function submitEmail() {
    if (!sessionId || !email.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await captureCrucibleEmail(sessionId, email.trim())
        setStep('intro')
      } catch {
        setError('Something went wrong saving your email.')
      }
    })
  }

  function toggleLine(line: number) {
    setOpenLine((cur) => (cur === line ? null : line))
  }

  function updateFlag(line: number, patch: Partial<CrucibleFlag>) {
    setFlags((prev) => {
      const next = new Map(prev)
      const existing = next.get(line) ?? { line, severity: 'minor' as CrucibleSeverity, mechanism: MECHANISM_OPTIONS[0].value, note: '' }
      next.set(line, { ...existing, ...patch })
      return next
    })
    posthog?.capture('crucible_flag_added', { line })
  }

  function removeFlag(line: number) {
    setFlags((prev) => {
      const next = new Map(prev)
      next.delete(line)
      return next
    })
  }

  function submitChallenge() {
    if (!sessionId || !verdict || !worstThing.trim()) {
      setError('Give a verdict and answer the required question before continuing.')
      return
    }
    setError(null)
    const start = Date.now()
    startTransition(async () => {
      try {
        await submitCrucibleChallenge({ sessionId, flags: Array.from(flags.values()), verdict, worstThing: worstThing.trim() })
        posthog?.capture('crucible_verdict', { verdict, ms: Date.now() - start })
        setStep('tools')
      } catch {
        setError('Something went wrong submitting your review.')
      }
    })
  }

  function toggleTool(tool: string) {
    setAiTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]))
  }

  function submitTools() {
    if (!sessionId) return
    setError(null)
    startTransition(async () => {
      try {
        const summary = await submitCrucibleAiTools(sessionId, aiTools, bestMove.trim())
        setResult(summary)
        setStep(skipResume ? 'results' : 'resume')
      } catch {
        setError('Something went wrong scoring your submission.')
      }
    })
  }

  function submitResume(file: File | null) {
    if (!sessionId) return
    setError(null)
    startTransition(async () => {
      try {
        await submitCrucibleResume(sessionId, file)
      } catch {
        // Resume upload failing must never block seeing results.
      }
      setStep('results')
    })
  }

  function submitInterest(kind: 'FULL' | 'LESSON') {
    if (!sessionId || !email.trim()) return
    startTransition(async () => {
      await logCrucibleInterest(sessionId, kind, email.trim())
    })
  }

  const content = variant ? CRUCIBLE_VARIANTS[variant] : null

  return (
    <div className={cn('mx-auto max-w-3xl px-6 py-12', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {step === 'fork' && (
        <div className="space-y-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">What kind of work are you going for?</h1>
          <p className="text-muted-foreground">No wrong door — &quot;not sure yet&quot; is a first-class answer.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {JOB_INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={isPending}
                onClick={() => pickJobIntent(opt.value)}
                className="rounded-xl border-2 border-border bg-white p-4 text-left font-medium text-foreground hover:border-brand"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'email' && (
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Where should we send your result?</h1>
          <p className="text-muted-foreground">No account, no password — just your email.</p>
          <div className="mx-auto max-w-sm space-y-3 text-left">
            <Label htmlFor="crucible-email">Email</Label>
            <Input id="crucible-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Button className="w-full" disabled={!email.trim() || isPending} onClick={submitEmail}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'intro' && content && (
        <div className="space-y-5 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Here&apos;s the situation.</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {`An AI agent wrote ${content.key === 'CODE' ? 'code' : content.key === 'MARKETING' ? 'marketing copy' : 'a memo'} for a real product. It looks finished. Your job is the one that matters now: decide if it ships. Use any AI you want — ChatGPT, Claude, Gemini, all of them. Copy the artifact into anything. We're measuring your judgment, not your typing. ~15 minutes. Instant result.`}
          </p>
          <Button size="lg" onClick={() => setStep('challenge')}>
            Show me {content.artifactLabel.toLowerCase()}
          </Button>
        </div>
      )}

      {step === 'challenge' && content && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{content.scenarioTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{content.brief}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Click any line to flag something you&apos;d raise before this ships.
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-[#0D0A14] font-mono text-sm">
            {content.lines.map((line) => {
              const flag = flags.get(line.line)
              return (
                <div key={line.line}>
                  <button
                    type="button"
                    onClick={() => toggleLine(line.line)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-1 text-left hover:bg-white/5',
                      flag && 'bg-orange/20'
                    )}
                  >
                    <span className="w-6 shrink-0 text-right text-white/30">{line.line}</span>
                    <span className="flex-1 whitespace-pre text-white/90">{line.text || ' '}</span>
                    {flag && (
                      <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[10px] font-semibold text-white">
                        {flag.severity}
                      </span>
                    )}
                  </button>
                  {openLine === line.line && (
                    <div className="space-y-3 border-t border-white/10 bg-white p-4 font-sans">
                      <div className="flex flex-wrap gap-2">
                        {SEVERITY_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => updateFlag(line.line, { severity: s.value })}
                            className={cn(
                              'rounded-full border px-3 py-1 text-xs font-medium',
                              flag?.severity === s.value ? 'border-brand bg-brand text-white' : 'border-border text-foreground'
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <select
                        value={flag?.mechanism ?? MECHANISM_OPTIONS[0].value}
                        onChange={(e) => updateFlag(line.line, { mechanism: e.target.value as CrucibleFlag['mechanism'] })}
                        className="w-full rounded-md border border-border p-2 text-sm"
                      >
                        {MECHANISM_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <Textarea
                        placeholder="One-line note (optional but helps calibrate credit)"
                        value={flag?.note ?? ''}
                        onChange={(e) => updateFlag(line.line, { note: e.target.value })}
                        rows={2}
                      />
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeFlag(line.line)}>
                          Remove flag
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="worst-thing">{content.worstThingPrompt}</Label>
            <Textarea id="worst-thing" value={worstThing} onChange={(e) => setWorstThing(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Your verdict</p>
            <div className="flex flex-wrap gap-2">
              {(['SHIP', 'BLOCK', 'SHIP_WITH_CONDITIONS'] as CrucibleVerdictValue[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerdict(v)}
                  className={cn(
                    'rounded-full border-2 px-4 py-2 text-sm font-semibold',
                    verdict === v ? 'border-brand bg-brand text-white' : 'border-border text-foreground'
                  )}
                >
                  {v === 'SHIP' ? 'Ship' : v === 'BLOCK' ? 'Block' : 'Ship with conditions'}
                </button>
              ))}
            </div>
          </div>

          <Button size="lg" className="w-full" disabled={isPending} onClick={submitChallenge}>
            Submit my review
          </Button>
        </div>
      )}

      {step === 'tools' && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold text-foreground">What did you use?</h1>
          <p className="text-sm text-muted-foreground">This earns points, not penalties.</p>
          <div className="flex flex-wrap gap-2">
            {AI_TOOL_OPTIONS.map((tool) => (
              <button
                key={tool}
                type="button"
                onClick={() => toggleTool(tool)}
                className={cn(
                  'rounded-full border-2 px-4 py-2 text-sm font-medium',
                  aiTools.includes(tool) ? 'border-brand bg-brand text-white' : 'border-border text-foreground'
                )}
              >
                {tool}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="best-move">What was your best prompt or move?</Label>
            <Textarea id="best-move" value={bestMove} onChange={(e) => setBestMove(e.target.value)} rows={3} />
          </div>
          <Button size="lg" className="w-full" disabled={isPending} onClick={submitTools}>
            Continue
          </Button>
        </div>
      )}

      {step === 'resume' && (
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-semibold text-foreground">One optional thing.</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Upload your resume — it will never touch your score. We&apos;re building the proof that degrees don&apos;t
            predict this skill. English majors, philosophy majors, self-taught: especially you.
          </p>
          <form
            className="mx-auto max-w-sm space-y-3 text-left"
            onSubmit={(e) => {
              e.preventDefault()
              const input = (e.currentTarget.elements.namedItem('file') as HTMLInputElement) ?? null
              submitResume(input?.files?.[0] ?? null)
            }}
          >
            <Input name="file" type="file" accept=".pdf,.docx" />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                Upload resume
              </Button>
              <Button type="button" variant="outline" className="flex-1" disabled={isPending} onClick={() => submitResume(null)}>
                Skip — show my results
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === 'results' && result && content && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Your score</p>
            <p className="text-5xl font-bold text-foreground">{result.score}</p>
            <p className="mt-1 text-lg font-semibold text-brand">{result.band}</p>
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">What actually broke</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.fixExplanation}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Why the distraction wasn&apos;t worth blocking on</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.herringExplanation}</p>
            </div>
          </div>

          {result.branch === 'PASS' ? (
            <div className="space-y-3 rounded-lg border-2 border-brand bg-brand/5 p-5 text-center">
              <p className="font-semibold text-foreground">You caught it. Most people don&apos;t.</p>
              <p className="text-sm text-muted-foreground">
                The full version of this is a 75-minute assessment on a real codebase, with a report you can send to
                employers as a verified work sample. It&apos;s the interview, before the interview. That&apos;s a
                day-one hire — the full assessment turns it into proof an employer can hold.
              </p>
              {!email.trim() && !skipEmail ? (
                <Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mx-auto max-w-xs" />
              ) : null}
              <Button disabled={isPending || (!email.trim() && !skipEmail)} onClick={() => submitInterest('FULL')}>
                Reserve my full assessment
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border-2 border-orange bg-orange/5 p-5 text-center">
              <p className="font-semibold text-foreground">The glitch shipped.</p>
              <p className="text-sm text-muted-foreground">
                This is learnable. We built a lesson on exactly this: how to turn a non-traditional background into
                the judgment companies are desperate for — and how to show it. Copy that prompt. It&apos;s yours. The
                lesson teaches you fifty more like it.
              </p>
              {!email.trim() && !skipEmail ? (
                <Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mx-auto max-w-xs" />
              ) : null}
              <Button disabled={isPending || (!email.trim() && !skipEmail)} onClick={() => submitInterest('LESSON')}>
                Start the lesson
              </Button>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {result.branch === 'PASS' ? (
              <button type="button" className="text-primary underline underline-offset-4" onClick={() => submitInterest('LESSON')}>
                I want the lesson too
              </button>
            ) : (
              // Gated to 24h server-side (build spec §3/§5) — within a live
              // browser session that's always still in the future, so this
              // is informational, not a live button. retryCrucibleChallenge
              // stays available for whatever surface calls it after the
              // real wait (e.g. a reminder email) has actually elapsed.
              <span className="text-muted-foreground">Retry with a new challenge in 24h</span>
            )}
            <Link href="/crucible" className="text-muted-foreground underline underline-offset-4">
              Back to Crucible
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
