import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTalentContext, visibleConnectionsWhere } from '@/lib/recruiter/intake/access'
import { INTAKE_REPLY_KIND_LABELS, TALENT_PRODUCT_NAME } from '@/lib/recruiter/intake/constants'
import { intakeRepliesSendingEnabled } from '@/lib/recruiter/intake/replies'
import { TalentSubnav } from '@/components/recruiter/talent/TalentSubnav'
import { ReplyQueue } from '@/components/recruiter/talent/ReplyQueue'
import { approveReplies, cancelReply, editReply } from '../actions'

export default async function TalentRepliesPage() {
  const ctx = await getTalentContext()
  if (!ctx.firm) redirect('/recruiters/talent')

  const [drafts, sendingEnabled] = await Promise.all([
    prisma.intakeReply.findMany({
      where: { status: 'DRAFT', connection: visibleConnectionsWhere(ctx) },
      include: { connection: { select: { id: true, tagReasons: true, intakeCandidate: { select: { fullName: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    intakeRepliesSendingEnabled(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{TALENT_PRODUCT_NAME} · {ctx.firm.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Replies</h1>
      </div>
      <TalentSubnav active="/recruiters/talent/replies" draftCount={drafts.length} />

      {!sendingEnabled && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Sending is switched off while NextChapter finishes its legal review.</p>
          <p className="text-muted-foreground">Approve as usual. Approved replies are saved and go out once sending is on.</p>
        </div>
      )}

      <ReplyQueue
        items={drafts.map((d) => ({
          replyId: d.id,
          connectionId: d.connection.id,
          candidateName: d.connection.intakeCandidate.fullName,
          kindLabel: INTAKE_REPLY_KIND_LABELS[d.kind],
          reason: d.connection.tagReasons[0] ?? '',
          subject: d.subject,
          body: d.body,
        }))}
        sendingEnabled={sendingEnabled}
        approve={approveReplies}
        cancel={cancelReply}
        edit={editReply}
      />
    </div>
  )
}
