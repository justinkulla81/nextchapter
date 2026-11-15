import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { NewDraftForm, DuplicateDraftForm, DeleteDraftForm, ImportUploadForm, MakeVersionForm } from '@/components/dashboard/resume-studio/DraftActions'
import { Squiggle } from '@/components/ui/squiggle'
import { KIND_BADGE, isDraftKind } from '@/lib/resume/studio/versions'

export const metadata: Metadata = { title: 'Resume studio' }

// Reading an uploaded resume into the studio is a long model call; the import action runs under this page's limit.
export const maxDuration = 120

export default async function ResumeStudioPage() {
  const profile = await getDashboardProfile()
  const [drafts, workHistoryCount, upload] = await Promise.all([
    prisma.resumeDraft.findMany({
      where: { candidateId: profile.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, templateId: true, updatedAt: true, kind: true, targetLabel: true, parentDraftId: true, sourceResumeId: true, importReport: true },
    }),
    prisma.workHistoryEntry.count({ where: { candidateId: profile.id } }),
    // The resume they uploaded most recently, if it was read as a resume.
    prisma.resume.findFirst({
      where: { candidateId: profile.id, looksLikeResume: { not: false }, extractedText: { not: null } },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, fileName: true, label: true, uploadedAt: true },
    }),
  ])

  const names = new Map(drafts.map((d) => [d.id, d.name]))
  // The Original first, then everything else by when it was last edited.
  const ordered = [...drafts].sort((a, b) => Number(b.kind === 'ORIGINAL') - Number(a.kind === 'ORIGINAL'))
  const uploadHasOriginal = upload ? drafts.some((d) => d.kind === 'ORIGINAL' && d.sourceResumeId === upload.id) : false
  const original = ordered.find((d) => d.kind === 'ORIGINAL')

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">Resume studio</h1>
        <Squiggle className="mt-2" />
        <p className="text-muted-foreground">
          Your resume as you wrote it stays as the Original. Make a labelled version of it for each function, industry, company or job you are going after, then download any of them as a
          PDF or Word file. The layouts are built to be read by applicant tracking systems.
        </p>
        <p className="text-sm">
          <Link href="/dashboard/resume" className="text-primary underline-offset-4 hover:underline">
            Back to my resume
          </Link>
        </p>
      </div>

      {upload && !uploadHasOriginal ? (
        <div className="space-y-3">
          <ImportUploadForm resumeId={upload.id} fileName={upload.label || upload.fileName} />
          <NewDraftForm hasProfileData={workHistoryCount > 0} hasUpload />
        </div>
      ) : original ? (
        <div className="flex flex-wrap items-start gap-3">
          <MakeVersionForm fromDraftId={original.id} fromName={original.name} primary />
        </div>
      ) : (
        <NewDraftForm hasProfileData={workHistoryCount > 0} />
      )}

      {drafts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No drafts yet"
          description={upload ? 'Import your uploaded resume to start from exactly what you wrote.' : 'Upload your resume, or start from your profile to get your work history in place, then edit it line by line.'}
        />
      ) : (
        <ul className="space-y-3" aria-label="Your resumes and versions">
          {ordered.map((d) => {
            const kind = isDraftKind(d.kind) ? d.kind : 'GENERAL'
            const report = d.kind === 'ORIGINAL' ? (d.importReport as { ok?: boolean; missing?: string[]; added?: string[] } | null) : null
            const flagged = report ? (report.missing?.length ?? 0) + (report.added?.length ?? 0) : 0
            const parent = d.parentDraftId ? names.get(d.parentDraftId) : null
            return (
              <li key={d.id}>
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                          <span>{d.name}</span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">{KIND_BADGE[kind]}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.targetLabel ? `For ${d.targetLabel}. ` : ''}
                          {parent ? `Made from ${parent}. ` : ''}
                          Edited {d.updatedAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
                        </p>
                        {report && (
                          <p className="text-xs text-muted-foreground">
                            {flagged === 0 ? 'Read from your upload with nothing left out.' : `Read from your upload. ${flagged} ${flagged === 1 ? 'item needs' : 'items need'} a look. Open it to see which.`}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button nativeButton={false} render={<Link href={`/dashboard/resume/studio/${d.id}`} />} size="sm" variant={d.kind === 'ORIGINAL' ? 'outline' : 'default'}>
                          Open
                        </Button>
                        <DuplicateDraftForm draftId={d.id} name={d.name} />
                        <DeleteDraftForm draftId={d.id} name={d.name} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
