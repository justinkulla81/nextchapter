'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VERSION_KINDS, KIND_BADGE, type DraftKind } from '@/lib/resume/studio/versions'
import { Field } from '@/components/dashboard/resume-studio/EditorParts'
import { MakeVersionForm } from '@/components/dashboard/resume-studio/DraftActions'

export interface ImportReportView {
  ok?: boolean
  missing?: string[]
  added?: string[]
  unplacedLines?: string[]
}

// What this resume is, and what it is for. The Original is the upload as read; anything else carries a label naming
// the function, industry, company or job it is aimed at, which is what the drafts list shows.
export function VersionPanel({
  draftId,
  draftName,
  kind,
  onKind,
  targetLabel,
  onTargetLabel,
}: {
  draftId: string
  draftName: string
  kind: DraftKind
  onKind: (k: DraftKind) => void
  targetLabel: string
  onTargetLabel: (v: string) => void
}) {
  const isOriginal = kind === 'ORIGINAL'
  const chosen = VERSION_KINDS.find((k) => k.kind === kind)
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span>Version</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">{KIND_BADGE[kind]}</span>
        </p>
        {isOriginal ? (
          <>
            <p className="text-xs text-muted-foreground">This is your resume as you uploaded it. To tailor it, make a version, and this one stays as it is.</p>
            <MakeVersionForm fromDraftId={draftId} fromName={draftName} primary />
          </>
        ) : (
          <>
            <div role="group" aria-label="What this version is for" className="flex flex-wrap gap-2">
              {VERSION_KINDS.map((k) => (
                <Button key={k.kind} type="button" size="sm" variant={kind === k.kind ? 'default' : 'outline'} aria-pressed={kind === k.kind} onClick={() => onKind(k.kind)}>
                  {k.label}
                </Button>
              ))}
            </div>
            <Field label={chosen?.targetNoun ?? 'Label'} value={targetLabel} onChange={onTargetLabel} maxLength={80} placeholder={chosen ? `For example: ${chosen.example}` : 'What is this version for?'} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Shown on an imported Original when the check against the uploaded file found anything different. It says plainly
// what was not carried over or was added, and the lines of the file involved, so nothing is lost without notice.
export function ImportReportPanel({ report }: { report: ImportReportView }) {
  const missing = report.missing ?? []
  const added = report.added ?? []
  if (report.ok || (missing.length === 0 && added.length === 0)) return null
  return (
    <section aria-labelledby="studio-import-report" className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <h2 id="studio-import-report" className="text-base font-semibold tracking-tight">
        Check these against your upload
      </h2>
      <p className="text-sm text-muted-foreground">We compared this with the file you uploaded. A few things did not match, so look at them before you rely on this copy.</p>
      {missing.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">In your file, not here</p>
          <p className="text-sm text-muted-foreground">{missing.slice(0, 30).join(', ')}</p>
          {(report.unplacedLines ?? []).length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {(report.unplacedLines ?? []).slice(0, 10).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {added.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Here, not in your file</p>
          <p className="text-sm text-muted-foreground">{added.slice(0, 30).join(', ')}</p>
        </div>
      )}
    </section>
  )
}
