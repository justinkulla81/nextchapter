'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InlineLoadingState } from '@/components/ui/spinner'
import { RESUME_TEMPLATE_META } from '@/lib/resume/export/template-meta'
import { cn } from '@/lib/utils'

type Format = 'docx' | 'pdf'

// "No control that can break parsing" (§13.2) — this picker only ever
// offers a template id and a file format. There is no free-text style
// input, no font picker, no spacing control — nothing here can
// reintroduce a banned layout element, because none of those choices are
// exposed at all. Accent color is no longer candidate-chosen — each
// template uses its own fixed default (omitting accentColor from the
// export request tells the API to use it, see route.ts's own comment).
export function ResumeExportForm() {
  const [templateId, setTemplateId] = useState(RESUME_TEMPLATE_META[0].id)
  const [format, setFormat] = useState<Format>('pdf')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/resume/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, format }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Something went wrong generating your resume. Please try again.')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `resume.${format}`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating your resume. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className={cn(pending && 'cursor-progress [&_*]:cursor-progress')}>
      <CardHeader>
        <CardTitle>Export a formatted resume</CardTitle>
        <CardDescription>
          Choose a template and download a polished, parse-safe resume built from your profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Template</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {RESUME_TEMPLATE_META.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={pending}
                onClick={() => setTemplateId(template.id)}
                aria-pressed={templateId === template.id}
                className={cn(
                  'rounded-lg border px-4 py-2 text-left text-sm transition-colors',
                  templateId === template.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="block font-medium text-foreground">{template.name}</span>
                <span className="block text-xs text-muted-foreground">{template.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Format</p>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending}
              variant={format === 'pdf' ? 'default' : 'outline'}
              onClick={() => setFormat('pdf')}
            >
              PDF
            </Button>
            <Button
              type="button"
              disabled={pending}
              variant={format === 'docx' ? 'default' : 'outline'}
              onClick={() => setFormat('docx')}
            >
              Word (.docx)
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="button" onClick={handleExport} disabled={pending} variant="success">
          {pending ? 'Generating…' : `Download ${format === 'pdf' ? 'PDF' : 'Word document'}`}
        </Button>
        {pending && <InlineLoadingState label="Building your resume — this takes a few seconds…" />}
      </CardContent>
    </Card>
  )
}
