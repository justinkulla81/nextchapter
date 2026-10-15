import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { parseResumeDocument } from '@/lib/resume/studio/document'
import { ResumeEditor } from '@/components/dashboard/resume-studio/ResumeEditor'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText } from 'lucide-react'

export const metadata: Metadata = { title: 'Edit resume draft' }

export default async function ResumeDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getDashboardProfile()
  const draft = await prisma.resumeDraft.findFirst({ where: { id, candidateId: profile.id } })
  if (!draft) notFound()

  // Re-validated on the way out too, in case a stored draft predates a limit.
  const parsed = parseResumeDocument(draft.document)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit resume draft</h1>
      {parsed.ok ? (
        <ResumeEditor
          draftId={draft.id}
          initialName={draft.name}
          initialTemplateId={draft.templateId}
          initialDocument={parsed.data}
          initialJobDescription={draft.jobDescription ?? ''}
          savedAt={draft.updatedAt.toISOString()}
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="This draft can't be opened"
          description={`${parsed.error} Go back to your drafts and start a new one from your profile.`}
          cta={{ label: 'Back to drafts', href: '/dashboard/resume/studio' }}
        />
      )}
    </div>
  )
}
