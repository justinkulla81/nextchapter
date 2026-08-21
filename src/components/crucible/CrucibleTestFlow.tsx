'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import {
  startCrucibleSession,
  captureCrucibleEmail,
  submitCrucibleChallenge,
  submitCruciblePromptTask,
  submitCrucibleDatasetTask,
  submitCrucibleResultsTask,
  submitCrucibleAiTools,
  submitCrucibleResume,
  logCrucibleInterest,
  type CrucibleResultSummary,
} from '@/app/crucible/actions'
import { getQaContent, CRUCIBLE_PROMPT_TASK, CRUCIBLE_DATASET_TASK, CRUCIBLE_RESULTS_TASK, type CrucibleJobIntentKey, type CrucibleVariantKey } from '@/lib/crucible/variants'
import type { CrucibleTierKey, CrucibleVerdictValue } from '@/lib/crucible/scoring-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CrucibleSource } from '@prisma/client'

type Step = 'fork' | 'email' | 'intro' | 'qa' | 'prompt' | 'dataset' | 'results-task' | 'tools' | 'resume' | 'results'

const JOB_INTENT_OPTIONS: { value: CrucibleJobIntentKey; label: string }[] = [
  { value: 'TECH', label: 'Tech / Software' },
  { value: 'MARKETING', label: 'Marketing / Content' },
  { value: 'DATA', label: 'Data / Analytics' },
  { value: 'DESIGN', label: 'Design / Creative' },
  { value: 'BUSINESS', label: 'Business / Ops' },
  { value: 'UNSURE', label: 'Not sure yet' },
]

const AI_TOOL_OPTIONS = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'Copilot', 'Other', 'None, just me']

const TIER_LABEL: Record<CrucibleTierKey, string> = { EASY: 'Warm-up', MEDIUM: 'Standard', HARD: 'Hard mode' }

function TierBadge({ tier }: { tier: CrucibleTierKey }) {
  if (tier === 'EASY') return null
  return (
    <span
      className={cn(
        'ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tier === 'HARD' ? 'bg-orange/15 text-orange' : 'bg-brand/15 text-brand'
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  )
}

export function CrucibleTestFlow({ source, skipEmail: initialSkipEmail, skipResume: initialSkipResume }: { source: CrucibleSource; skipEmail: boolean; skipResume: boolean }) {
  const posthog = usePostHog()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('fork')
  const [error, setError] = useState<string | null>(null)
  const [levelUpNotice, setLevelUpNotice] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [variant, setVariant] = useState<CrucibleVariantKey | null>(null)
  const [skipEmail, setSkipEmail] = useState(initialSkipEmail)
  const [skipResume, setSkipResume] = useState(initialSkipResume)

  const [email, setEmail] = useState('')
  const [qaTier, setQaTier] = useState<CrucibleTierKey>('EASY')
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set())
  const [verdict, setVerdict] = useState<CrucibleVerdictValue | null>(null)
  const [promptTier, setPromptTier] = useState<CrucibleTierKey>('EASY')
  const [promptText, setPromptText] = useState('')
  const [datasetTier, setDatasetTier] = useState<CrucibleTierKey>('EASY')
  const [analysisText, setAnalysisText] = useState('')
  const [resultsText, setResultsText] = useState('')
  const [aiTools, setAiTools] = useState<string[]>([])
  const [bestMove, setBestMove] = useState('')
  const [resumeShareConsent, setResumeShareConsent] = useState(false)
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

  function toggleOption(id: string) {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submitChallenge() {
    if (!sessionId || !verdict) {
      setError('Give a verdict before continuing.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await submitCrucibleChallenge({ sessionId, selectedOptionIds: Array.from(selectedOptionIds), verdict })
        posthog?.capture('crucible_verdict', { verdict, flagCount: selectedOptionIds.size, tier: qaTier, advanced: result.advanced })
        if (result.advanced) {
          setQaTier(result.tier)
          setSelectedOptionIds(new Set())
          setVerdict(null)
          setLevelUpNotice(`Nice catch. Try the ${TIER_LABEL[result.tier].toLowerCase()} version.`)
        } else {
          setLevelUpNotice(null)
          setStep('prompt')
        }
      } catch {
        setError('Something went wrong submitting your review.')
      }
    })
  }

  function submitPromptTask() {
    if (!sessionId || !promptText.trim()) {
      setError('Write a prompt before continuing.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await submitCruciblePromptTask(sessionId, promptText.trim())
        posthog?.capture('crucible_prompt_task_submitted', { tier: promptTier, advanced: result.advanced })
        if (result.advanced) {
          setPromptTier(result.tier)
          setPromptText('')
          setLevelUpNotice(`Strong prompt. Try the ${TIER_LABEL[result.tier].toLowerCase()} version.`)
        } else {
          setLevelUpNotice(null)
          setStep('dataset')
        }
      } catch {
        setError('Something went wrong submitting your prompt.')
      }
    })
  }

  function submitDatasetTask() {
    if (!sessionId || !analysisText.trim()) {
      setError('Write your analysis before continuing.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await submitCrucibleDatasetTask(sessionId, analysisText.trim())
        posthog?.capture('crucible_dataset_task_submitted', { tier: datasetTier, advanced: result.advanced })
        if (result.advanced) {
          setDatasetTier(result.tier)
          setAnalysisText('')
          setLevelUpNotice(`Sharp read. Try the ${TIER_LABEL[result.tier].toLowerCase()} version.`)
        } else {
          setLevelUpNotice(null)
          setStep('results-task')
        }
      } catch {
        setError('Something went wrong submitting your analysis.')
      }
    })
  }

  function submitResultsTask() {
    if (!sessionId || !resultsText.trim()) {
      setError('Write your call before continuing.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await submitCrucibleResultsTask(sessionId, resultsText.trim())
        posthog?.capture('crucible_results_task_submitted')
        setStep('tools')
      } catch {
        setError('Something went wrong submitting your call.')
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

  function submitResume(file: File | null, shareConsent: boolean) {
    if (!sessionId) return
    setError(null)
    startTransition(async () => {
      try {
        await submitCrucibleResume(sessionId, file, shareConsent)
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

  const qaContent = variant ? getQaContent(variant, qaTier) : null
  const promptContent = CRUCIBLE_PROMPT_TASK[promptTier]
  const datasetContent = CRUCIBLE_DATASET_TASK[datasetTier]
  const resultsContent = CRUCIBLE_RESULTS_TASK

  return (
    <div className={cn('mx-auto max-w-3xl px-6 py-12', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {levelUpNotice && (step === 'qa' || step === 'prompt' || step === 'dataset') && (
        <p className="mb-4 rounded-lg bg-brand/10 p-3 text-sm font-medium text-brand">{levelUpNotice}</p>
      )}

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

      {step === 'intro' && qaContent && (
        <div className="space-y-5 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Here&apos;s the situation.</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {`Four short activities, ~15 minutes total: judge a real AI mistake, write a prompt that would fix a real page, read a real dataset, and call whether a test result actually holds up. Do well on one, and we'll give you a harder version. Use any AI you want — ChatGPT, Claude, Gemini, all of them. We're measuring your judgment, not your typing.`}
          </p>
          <Button size="lg" onClick={() => setStep('qa')}>
            Start
          </Button>
        </div>
      )}

      {step === 'qa' && qaContent && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Activity 1 of 4 — Judge the output
              <TierBadge tier={qaTier} />
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{qaContent.scenarioTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{qaContent.brief}</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-[#0D0A14] font-mono text-sm">
            {qaContent.lines.map((line) => (
              <div key={line.line} className="flex items-start gap-3 px-3 py-1">
                <span className="w-6 shrink-0 text-right text-white/30">{line.line}</span>
                <span className="flex-1 whitespace-pre text-white/90">{line.text || ' '}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{qaContent.checklistPrompt}</p>
            <div className="space-y-2 rounded-lg border border-border p-3">
              {qaContent.checklistOptions.map((opt) => (
                <label key={opt.id} className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedOptionIds.has(opt.id)}
                    onChange={() => toggleOption(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
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
            Continue
          </Button>
        </div>
      )}

      {step === 'prompt' && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Activity 2 of 4 — Write a prompt
              <TierBadge tier={promptTier} />
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{promptContent.pageTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{promptContent.instructions}</p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-off-white p-5">
            {promptContent.pageSections.map((section, i) => {
              if (section.kind === 'heading') return <p key={i} className="text-lg font-bold text-navy">{section.text}</p>
              if (section.kind === 'button')
                return (
                  <span key={i} className="inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">
                    {section.text}
                  </span>
                )
              if (section.kind === 'field')
                return (
                  <p key={i} className="rounded-md border border-border bg-white px-3 py-2 font-mono text-xs text-foreground">
                    {section.text}
                  </p>
                )
              return (
                <p key={i} className="text-sm text-muted-foreground">
                  {section.text}
                </p>
              )
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt-task">The prompt you&apos;d give an AI</Label>
            <Textarea id="prompt-task" value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={5} />
          </div>

          <Button size="lg" className="w-full" disabled={isPending} onClick={submitPromptTask}>
            Continue
          </Button>
        </div>
      )}

      {step === 'dataset' && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Activity 3 of 4 — Analyze a dataset
              <TierBadge tier={datasetTier} />
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">Make the call</h1>
            <p className="mt-2 text-sm text-muted-foreground">{datasetContent.businessContext}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{datasetContent.datasetDescription}</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-off-white">
                  <tr>
                    {datasetContent.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetContent.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset-task">{datasetContent.instructions}</Label>
            <Textarea id="dataset-task" value={analysisText} onChange={(e) => setAnalysisText(e.target.value)} rows={5} />
          </div>

          <Button size="lg" className="w-full" disabled={isPending} onClick={submitDatasetTask}>
            Continue
          </Button>
        </div>
      )}

      {step === 'results-task' && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Activity 4 of 4 — Read the results</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">Trust the result?</h1>
            <p className="mt-2 text-sm text-muted-foreground">{resultsContent.businessContext}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{resultsContent.datasetDescription}</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-off-white">
                  <tr>
                    {resultsContent.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultsContent.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="results-task">{resultsContent.instructions}</Label>
            <Textarea id="results-task" value={resultsText} onChange={(e) => setResultsText(e.target.value)} rows={5} />
          </div>

          <Button size="lg" className="w-full" disabled={isPending} onClick={submitResultsTask}>
            Continue
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
            Upload your resume if you want it shared with real employers when you do well — it never touches your
            score either way. English majors, philosophy majors, self-taught: especially you.
          </p>
          <form
            className="mx-auto max-w-sm space-y-3 text-left"
            onSubmit={(e) => {
              e.preventDefault()
              const input = (e.currentTarget.elements.namedItem('file') as HTMLInputElement) ?? null
              submitResume(input?.files?.[0] ?? null, resumeShareConsent)
            }}
          >
            <Input name="file" type="file" accept=".pdf,.docx" />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={resumeShareConsent}
                onChange={(e) => setResumeShareConsent(e.target.checked)}
              />
              Share this resume with real employers hiring on noexperienceneeded.ai
            </label>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isPending || !resumeShareConsent}>
                Upload resume
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => submitResume(null, false)}
              >
                Skip — show my results
              </Button>
            </div>
            {!resumeShareConsent && (
              <p className="text-xs text-muted-foreground">Check the box above to enable uploading.</p>
            )}
          </form>
        </div>
      )}

      {step === 'results' && result && qaContent && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Your score</p>
            <p className="text-5xl font-bold text-foreground">{result.score}</p>
            <p className="mt-1 text-lg font-semibold text-brand">{result.band}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 rounded-lg border border-border bg-off-white p-3 text-center text-xs">
            <span className="text-muted-foreground">
              Judgment: <span className="font-semibold text-foreground">{TIER_LABEL[result.tiersReached.qa]}</span>
            </span>
            <span className="text-muted-foreground">
              Prompting: <span className="font-semibold text-foreground">{TIER_LABEL[result.tiersReached.prompt]}</span>
            </span>
            <span className="text-muted-foreground">
              Data: <span className="font-semibold text-foreground">{TIER_LABEL[result.tiersReached.dataset]}</span>
            </span>
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Activity 1 — What actually broke</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.fixExplanation}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Why the distraction wasn&apos;t worth blocking on</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.herringExplanation}</p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">Activity 2 — Your prompt</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.promptFeedback}</p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">Activity 3 — Your analysis</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.datasetFeedback}</p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">Activity 4 — Your call</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.resultsFeedback}</p>
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
              Back to noexperienceneeded.ai
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
