import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getSystemCandidateProfile } from '@/lib/community/system-account'
import { AdminStoryForm } from '@/components/admin/AdminStoryForm'
import { RemoveAdminStoryButton } from '@/components/admin/RemoveAdminStoryButton'

export default async function AdminCommunityStoriesPage() {
  await requireAdmin()
  const system = await getSystemCandidateProfile()

  const stories = await prisma.communityPost.findMany({
    where: { candidateId: system.id, isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community Stories</h1>
        <p className="mt-1 text-muted-foreground">
          Posts here go straight into the candidate-facing Community feed under &quot;NextChapter
          Team&quot; — published immediately, no moderation queue. Candidates can like a story but
          can&apos;t report or express interest on it.
        </p>
      </div>

      <AdminStoryForm />

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Posted stories</p>
        {stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {stories.map((story) => (
              <div key={story.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1">
                  {story.title && <p className="font-medium text-foreground">{story.title}</p>}
                  <p className="text-sm text-muted-foreground">{story.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {story.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <RemoveAdminStoryButton postId={story.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
