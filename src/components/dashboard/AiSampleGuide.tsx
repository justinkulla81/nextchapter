'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AI_SAMPLE_SPECS, aiSampleChecks, type AiSampleType } from '@/lib/evidence/ai-work-samples'

/**
 * The guided template for one AI work-sample type (ai-work-samples.ts): its fields, the
 * proof-map checks ticking off live as the member fills it in, and the résumé bullet
 * templates to copy. Rendered inside WorkSampleForm, so its inputs submit with the form.
 */
export function AiSampleGuide({ type, externalUrl }: { type: AiSampleType; externalUrl: string }) {
  const spec = AI_SAMPLE_SPECS[type]
  const [values, setValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<number | null>(null)
  const checks = aiSampleChecks({
    sampleType: type,
    aiDetails: values,
    aiToolsUsed: values.aiToolsUsed,
    beforeMetric: values.beforeMetric,
    afterMetric: values.afterMetric,
    externalUrl,
  })!

  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(i)
      posthog.capture('ai_work_sample_bullet_copied', { type, bullet: i })
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="space-y-4 rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{spec.intro}</p>
      {spec.fields.map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.long ? (
            <Textarea id={f.key} name={f.key} rows={2} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          ) : (
            <Input id={f.key} name={f.key} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          )}
        </div>
      ))}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          What employers check ({checks.passed.length} of {spec.checks.length})
        </p>
        <ul className="space-y-0.5 text-sm" aria-live="polite">
          {spec.checks.map((c) => {
            const ok = checks.passed.some((p) => p.key === c.key)
            return (
              <li key={c.key} className={ok ? 'text-foreground' : 'text-muted-foreground'}>
                {ok ? '✓' : '○'} {c.label}
                {c.metric && <span className="text-muted-foreground"> — counts most toward your evidence score</span>}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Résumé bullets to adapt</p>
        <ul className="space-y-2">
          {spec.bullets.map((b, i) => (
            <li key={b} className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
              <span>{b}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => copy(i, b)} aria-label={`Copy résumé bullet ${i + 1}`}>
                {copied === i ? 'Copied' : 'Copy'}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
