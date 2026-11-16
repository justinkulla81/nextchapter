'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { posthog } from '@/lib/posthog/client'
import { analyzeJobSpec, LANES, SAMPLE_SPEC, type SpecReading } from '@/lib/workforce/program-content'

const laneLabel = (k: string) => LANES.find((l) => l.key === k)?.label ?? k

// A hiring manager pastes a job description; the tool flags tasks AI now helps
// with, suggests future skills to name, and points each one to a learning
// lane. Rule-based and local to the page: nothing is sent anywhere.
export function FutureSkillsTool({ slug, partnerNames }: { slug: string; partnerNames: string[] }) {
  const [text, setText] = useState(SAMPLE_SPEC)
  const [reading, setReading] = useState<SpecReading | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const empty = text.trim().length < 20
  const suggested = useMemo(() => (reading ? reading.adds.map((a) => `- ${a.line}`).join('\n') : ''), [reading])

  function check() {
    setBusy(true)
    const r = analyzeJobSpec(text)
    setReading(r)
    setCopied(false)
    posthog.capture('job_spec_checked', { slug, family: r.family, tasksFlagged: r.tasks.length, skillsSuggested: r.adds.length, mentionedAi: r.alreadyMentionsAi, length: text.length })
    setBusy(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(suggested)
      setCopied(true)
      posthog.capture('job_spec_skills_copied', { slug, skillsSuggested: reading?.adds.length ?? 0 })
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <Label htmlFor="spec">Job description</Label>
        <textarea
          id="spec"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
          aria-describedby="spec-help"
        />
        <p id="spec-help" className="text-xs text-muted-foreground">
          Paste any role. The check runs on this page; nothing is sent or saved.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={check} disabled={empty || busy} style={busy ? { cursor: 'wait' } : undefined}>
            {busy ? 'Checking…' : 'Check for future skills'}
          </Button>
          {empty && <span className="text-xs text-muted-foreground">Add at least a few lines of the job description to check it.</span>}
        </div>
      </div>

      <div className="space-y-4" aria-live="polite">
        {!reading ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            The result appears here: tasks AI now helps with, future skills to name in the spec, and where people can learn them locally.
          </p>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Read as: {reading.family ?? 'General professional role'}</h3>
              {reading.tasks.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-medium">Tasks AI tools already help with</p>
                  <ul className="mt-1 space-y-1">
                    {reading.tasks.map((t) => (
                      <li key={t.phrase}>
                        <span className="font-medium">{t.phrase}.</span> {t.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Future skills to name in the spec</h3>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {reading.adds.map((a) => (
                  <li key={a.skill} className="space-y-0.5 p-3 text-sm">
                    <p className="font-medium">{a.skill}</p>
                    <p className="text-muted-foreground">{a.line}</p>
                    <p className="text-xs text-muted-foreground">
                      Learn it through: <span className="font-medium text-foreground">{laneLabel(a.lane)}</span>
                      {partnerNames.length > 0 && <> · e.g. {partnerNames.slice(0, 2).join(', ')}</>}
                    </p>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? 'Copied' : 'Copy these as spec lines'}
              </Button>
            </section>
            {reading.wording.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Wording to look at</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {reading.wording.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-muted-foreground">A starting point for the hiring manager, not a ruling on the role.</p>
          </>
        )}
      </div>
    </div>
  )
}
