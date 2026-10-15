import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { NewDraftForm, DuplicateDraftForm, DeleteDraftForm } from '@/components/dashboard/resume-studio/DraftActions'

export const metadata: Metadata = { title: 'Resume studio' }

export default async function ResumeStudioPage() {
  const profile = await getDashboardProfile()
  const [drafts, workHistoryCount] = await Promise.all([
    prisma.resumeDraft.findMany({
      where: { candidateId: profile.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, templateId: true, updatedAt: true },
    }),
    prisma.workHistoryEntry.count({ where: { candidateId: profile.id } }),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Resume studio</h1>
        <p className="text-muted-foreground">
          Write and tailor your resume here, then download it as a PDF or Word file. Keep a draft for each kind of role you are going after. The layouts are built to be read by
          applicant tracking systems.
        </p>
        <p className="text-sm">
          <Link href="/dashboard/resume" className="text-primary underline-offset-4 hover:underline">
            Back to my resume
          </Link>
        </p>
      </div>

      <NewDraftForm hasProfileData={workHistoryCount > 0} />

      {drafts.length === 0 ? (
        <EmptyState icon={FileText} title="No drafts yet" description="Start from your profile to get your work history in place, then edit it line by line." />
      ) : (
        <ul className="space-y-3" aria-label="Your resume drafts">
          {drafts.map((d) => (
            <li key={d.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="font-medium text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Edited {d.updatedAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button nativeButton={false} render={<Link href={`/dashboard/resume/studio/${d.id}`} />} size="sm">
                      Open
                    </Button>
                    <DuplicateDraftForm draftId={d.id} name={d.name} />
                    <DeleteDraftForm draftId={d.id} name={d.name} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
