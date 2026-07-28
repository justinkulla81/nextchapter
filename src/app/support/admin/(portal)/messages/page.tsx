import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createDashboardMessage, toggleDashboardMessageActive } from './actions'
import { DashboardMessageForm } from '@/components/admin/DashboardMessageForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export const maxDuration = 30

export default async function DashboardMessagesAdminPage() {
  await requireAdmin()

  const messages = await prisma.dashboardMessage.findMany({
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Messages and Reminders</h1>
        <p className="mt-1 text-muted-foreground">
          The pinned message always shows first, to every candidate, until they dismiss it. After that, active
          messages rotate in, oldest first. New messages here are not pinned — only the original &quot;How
          NextChapter works&quot; message is.
        </p>
      </div>

      <DashboardMessageForm action={createDashboardMessage} />

      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <Card key={message.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">
                    {message.title}
                    {message.isPinned && (
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                        Pinned
                      </span>
                    )}
                    {!message.isActive && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                    {message.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                  {message.footer && <p className="mt-1 text-xs text-muted-foreground">{message.footer}</p>}
                </div>
                {!message.isPinned && (
                  <form action={toggleDashboardMessageActive.bind(null, message.id, message.isActive)}>
                    <SubmitButton variant="ghost" size="sm">
                      {message.isActive ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
