'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { downloadResumeExport, type ResumeExportFormat } from '@/lib/resume/download-export'
import { RESUME_TEMPLATE_META } from '@/lib/resume/export/template-meta'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'
import { resumeToPlainText } from '@/lib/resume/studio/document'
import { summarizeDocument } from '@/lib/resume/studio/writing-checks'
import { keywordCoverage, type KeywordCoverage } from '@/lib/resume/studio/keyword-coverage'
import { saveDraft } from '@/app/dashboard/resume/studio/actions'
import { Field, TextAreaField, ReorderControls, moveItem, removeAt, replaceAt, splitList } from '@/components/dashboard/resume-studio/EditorParts'
import { ExperienceEditor } from '@/components/dashboard/resume-studio/ExperienceEditor'

type SaveState = { kind: 'saved'; at: string } | { kind: 'error'; message: string } | { kind: 'idle' }

export function ResumeEditor({
  draftId,
  initialName,
  initialTemplateId,
  initialDocument,
  initialJobDescription,
  savedAt,
}: {
  draftId: string
  initialName: string
  initialTemplateId: string
  initialDocument: ResumeDocumentData
  initialJobDescription: string
  savedAt: string
}) {
  const [name, setName] = useState(initialName)
  const [templateId, setTemplateId] = useState(initialTemplateId)
  const [doc, setDoc] = useState<ResumeDocumentData>(initialDocument)
  const [skillsText, setSkillsText] = useState(initialDocument.skills.join(', '))
  const [certsText, setCertsText] = useState(initialDocument.certifications.join(', '))
  const [jobDescription, setJobDescription] = useState(initialJobDescription)
  const [coverage, setCoverage] = useState<KeywordCoverage | null>(null)
  const [saving, setSaving] = useState(false)
  const [save, setSave] = useState<SaveState>({ kind: 'saved', at: savedAt })
  const [exporting, setExporting] = useState<ResumeExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // The document as it will be saved and exported: skills and certifications come from their text boxes.
  const current = useMemo<ResumeDocumentData>(() => ({ ...doc, skills: splitList(skillsText), certifications: splitList(certsText) }), [doc, skillsText, certsText])
  const summary = useMemo(() => summarizeDocument(current), [current])

  // Unsaved changes are whatever differs from what was last saved, so editing a field back to
  // its saved value clears the warning.
  const snapshot = useMemo(() => JSON.stringify([name, templateId, current, jobDescription]), [name, templateId, current, jobDescription])
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify([initialName, initialTemplateId, { ...initialDocument, skills: splitList(initialDocument.skills.join(', ')), certifications: splitList(initialDocument.certifications.join(', ')) }, initialJobDescription])
  )
  const dirty = snapshot !== savedSnapshot

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setContact = (key: keyof ResumeDocumentData['contact'], value: string) => setDoc((d) => ({ ...d, contact: { ...d.contact, [key]: value || null } }))

  async function handleSave() {
    setSaving(true)
    const savingSnapshot = snapshot
    const result = await saveDraft(draftId, { name, templateId, document: current, jobDescription })
    setSaving(false)
    if (result.ok) {
      setSavedSnapshot(savingSnapshot)
      setSave({ kind: 'saved', at: result.savedAt })
    } else {
      setSave({ kind: 'error', message: result.error })
    }
  }

  async function handleExport(format: ResumeExportFormat) {
    setExporting(format)
    setExportError(null)
    try {
      await downloadResumeExport({ templateId, format, document: current })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Something went wrong generating your resume. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  function handleKeywordCheck() {
    const result = keywordCoverage(jobDescription, current)
    setCoverage(result)
    posthog.capture('resume_keyword_check_run', { draftId, found: result.found.length, missing: result.missing.length })
  }

  const busy = saving || exporting !== null

  return (
    <div className={cn('grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]', busy && 'cursor-progress')}>
      <div className="space-y-8">
        <section className="space-y-3" aria-labelledby="studio-header">
          <h2 id="studio-header" className="text-lg font-semibold tracking-tight">
            Your details
          </h2>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Field label="Draft name" value={name} onChange={setName} maxLength={100} placeholder="For example: Tailored for VP Finance roles" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your name" value={doc.name} onChange={(v) => setDoc((d) => ({ ...d, name: v }))} maxLength={100} />
                <Field label="Title under your name" value={doc.targetTitle ?? ''} onChange={(v) => setDoc((d) => ({ ...d, targetTitle: v || null }))} maxLength={150} />
                <Field label="Email" type="email" value={doc.contact.email ?? ''} onChange={(v) => setContact('email', v)} maxLength={200} />
                <Field label="Phone" value={doc.contact.phone ?? ''} onChange={(v) => setContact('phone', v)} maxLength={40} />
                <Field label="Location" value={doc.contact.location ?? ''} onChange={(v) => setContact('location', v)} placeholder="City, State" maxLength={120} />
                <Field label="LinkedIn address" value={doc.contact.linkedinUrl ?? ''} onChange={(v) => setContact('linkedinUrl', v)} maxLength={300} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" aria-labelledby="studio-summary">
          <h2 id="studio-summary" className="text-lg font-semibold tracking-tight">
            Summary
          </h2>
          <Card>
            <CardContent className="pt-6">
              <TextAreaField
                label="Two to four sentences on who you are and what you do best"
                value={doc.summary ?? ''}
                onChange={(v) => setDoc((d) => ({ ...d, summary: v || null }))}
                rows={4}
                maxLength={1500}
                hint={summary.summaryLength > 600 ? 'This is long for a summary. Readers skim it, so try trimming it to the strongest points.' : `${summary.summaryLength} of 1,500 characters`}
              />
            </CardContent>
          </Card>
        </section>

        <ExperienceEditor roles={doc.workHistory} onChange={(workHistory) => setDoc((d) => ({ ...d, workHistory }))} />

        <section className="space-y-3" aria-labelledby="studio-education">
          <h2 id="studio-education" className="text-lg font-semibold tracking-tight">
            Education
          </h2>
          {doc.education.map((e, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">School {i + 1}</p>
                  <ReorderControls noun="school" index={i} count={doc.education.length} onMove={(d) => setDoc((x) => ({ ...x, education: moveItem(x.education, i, d) }))} onRemove={() => setDoc((x) => ({ ...x, education: removeAt(x.education, i) }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="School" value={e.schoolName} onChange={(v) => setDoc((d) => ({ ...d, education: replaceAt(d.education, i, { ...e, schoolName: v }) }))} maxLength={150} />
                  <Field label="Degree" value={e.degreeLabel ?? ''} onChange={(v) => setDoc((d) => ({ ...d, education: replaceAt(d.education, i, { ...e, degreeLabel: v || null }) }))} placeholder="MBA, Finance" maxLength={150} />
                  <Field label="Year" value={e.dateLabel ?? ''} onChange={(v) => setDoc((d) => ({ ...d, education: replaceAt(d.education, i, { ...e, dateLabel: v || null }) }))} maxLength={30} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" variant="outline" disabled={doc.education.length >= 10} onClick={() => setDoc((d) => ({ ...d, education: [...d.education, { schoolName: '', degreeLabel: null, dateLabel: null }] }))}>
            Add a school
          </Button>
          {doc.education.length >= 10 && <p className="text-xs text-muted-foreground">That is the most schools you can list. Remove one to add another.</p>}
        </section>

        <section className="space-y-3" aria-labelledby="studio-skills">
          <h2 id="studio-skills" className="text-lg font-semibold tracking-tight">
            Skills and certifications
          </h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <TextAreaField label="Skills" value={skillsText} onChange={setSkillsText} rows={3} hint="Separate with commas. Tools and technologies read best here." />
              <TextAreaField label="Certifications" value={certsText} onChange={setCertsText} rows={2} hint="Separate with commas." />
            </CardContent>
          </Card>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Save, checks and download">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Button type="button" onClick={handleSave} disabled={saving} className={cn('w-full', saving && 'cursor-progress')}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <p role="status" className="text-xs text-muted-foreground">
              {save.kind === 'error' ? null : dirty ? 'You have unsaved changes.' : `Saved ${new Date(save.kind === 'saved' ? save.at : savedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`}
            </p>
            {save.kind === 'error' && (
              <p role="alert" className="text-xs text-destructive">
                {save.message}
              </p>
            )}
            <Link href="/dashboard/resume/studio" className="block text-sm text-primary underline-offset-4 hover:underline">
              Back to all drafts
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium text-foreground">Download</p>
            <div role="group" aria-label="Template" className="flex flex-wrap gap-2">
              {RESUME_TEMPLATE_META.map((t) => (
                <Button key={t.id} type="button" size="sm" variant={templateId === t.id ? 'default' : 'outline'} aria-pressed={templateId === t.id} onClick={() => setTemplateId(t.id)}>
                  {t.name}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={exporting !== null} className={cn(exporting && 'cursor-progress')} onClick={() => handleExport('pdf')}>
                {exporting === 'pdf' ? 'Building PDF…' : 'Download PDF'}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={exporting !== null} className={cn(exporting && 'cursor-progress')} onClick={() => handleExport('docx')}>
                {exporting === 'docx' ? 'Building Word file…' : 'Download Word'}
              </Button>
            </div>
            {exportError && (
              <p role="alert" className="text-xs text-destructive">
                {exportError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Downloads what is on screen, saved or not.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="font-medium text-foreground">Writing checks</p>
            <p className="text-muted-foreground">
              {summary.bulletCount === 0
                ? 'Add bullets to see checks.'
                : `${summary.quantifiedCount} of ${summary.bulletCount} bullets have a number in them. ${summary.notedBullets} ${summary.notedBullets === 1 ? 'has' : 'have'} a suggestion.`}
            </p>
            {summary.rolesWithoutBullets.length > 0 && <p className="text-muted-foreground">No bullets yet for: {summary.rolesWithoutBullets.join('; ')}.</p>}
            <p className="text-xs text-muted-foreground">These look at how a line is written, not whether it is true. Nothing here stops you saving or downloading.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium text-foreground">Check against a job posting</p>
            <Label>
              <span className="sr-only">Job posting text</span>
              <Textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={5} placeholder="Paste the job description here" maxLength={20000} />
            </Label>
            <Button type="button" size="sm" variant="outline" disabled={jobDescription.trim().length === 0} onClick={handleKeywordCheck}>
              Check keywords
            </Button>
            {jobDescription.trim().length === 0 && <p className="text-xs text-muted-foreground">Paste a posting above to enable this.</p>}
            {coverage && (
              <div className="space-y-2 text-sm" role="status">
                {coverage.found.length === 0 && coverage.missing.length === 0 ? (
                  <p className="text-muted-foreground">We did not find any skills or tools we recognize in that posting. We only look for a fixed list of common ones, so this is not a sign your resume is a mismatch.</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      <span className="text-foreground">Already on your resume:</span> {coverage.found.length > 0 ? coverage.found.join(', ') : 'none of them'}.
                    </p>
                    <p className="text-muted-foreground">
                      <span className="text-foreground">Named in the posting, not on your resume:</span> {coverage.missing.length > 0 ? coverage.missing.join(', ') : 'none'}.
                    </p>
                    <p className="text-xs text-muted-foreground">Only add a term if you have really used it. Mentioning a skill is not the same as having it.</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">How an applicant tracking system reads this</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{resumeToPlainText(current)}</pre>
        </details>
      </aside>
    </div>
  )
}
