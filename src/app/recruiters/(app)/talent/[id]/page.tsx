import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { canAssign, findVisibleConnection, getTalentContext } from '@/lib/recruiter/intake/access'
import { INTAKE_CONSENT_SCOPE_LABELS, INTAKE_CONSENT_SCOPES } from '@/lib/recruiter/intake/constants'
import { TagBadge } from '@/components/recruiter/talent/TalentSubnav'
import { AssignControl, OpenResumeButton, TagButtons } from '@/components/recruiter/talent/TalentForms'
import { assignConnection, getIntakeResumeUrl, overrideTag } from '../actions'

const SOURCE_LABEL = { PAGE: 'Inbound page', NOT_FIT_LINK: '"Not a fit now" link', FORWARD: 'Forwarded email' } as const
const REPLY_LABEL = { DRAFT: 'Waiting for your OK', APPROVED: 'Approved', SENT: 'Sent', CANCELLED: 'Cancelled' } as const

export default async function TalentConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getTalentContext()
  const connection = await findVisibleConnection(ctx, id, {
    intakeCandidate: true,
    search: true,
    replies: { orderBy: { createdAt: 'desc' } },
    routingDecisions: { orderBy: { createdAt: 'desc' } },
  })
  if (!connection || !ctx.firm) notFound()

  const [resumes, recruiters] = await Promise.all([
    prisma.intakeResume.findMany({
      where: { firmId: connection.firmId, intakeCandidateId: connection.intakeCandidateId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, createdAt: true, parseStatus: true, parsedJson: true },
    }),
    prisma.recruiter.findMany({
      where: { recruiterFirmId: ctx.firm.id, firmRole: { in: ['ADMIN', 'RECRUITER'] } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ])
  const nameOf = new Map(recruiters.map((r) => [r.id, r.fullName]))
  const latest = resumes[0]
  const parsed = (latest?.parsedJson ?? null) as Record<string, unknown> | null
  const person = connection.intakeCandidate

  captureServerEvent(ctx.recruiter.id, 'talent_candidate_viewed', { connectionId: connection.id, firmId: ctx.firm.id })

  const facts: [string, unknown][] = [
    ['Current role', [parsed?.currentTitle, parsed?.currentEmployer].filter(Boolean).join(' at ')],
    ['Level', parsed?.level],
    ['Function', parsed?.primaryFunction],
    ['Industry', parsed?.industry],
    ['Location', person.location ?? parsed?.location],
    ['Experience', parsed?.yearsExperience ? `${parsed.yearsExperience} years` : null],
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/recruiters/talent" className="text-sm text-muted-foreground underline underline-offset-4">
        ← All candidates
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{person.fullName}</h1>
          <TagBadge tag={connection.tag} />
        </div>
        <p className="text-sm text-muted-foreground">
          {person.email}
          {person.linkedinUrl && (
            <>
              {' · '}
              <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">
                LinkedIn
              </a>
            </>
          )}
          {' · '}
          {SOURCE_LABEL[connection.source]} · {connection.createdAt.toLocaleDateString()}
        </p>
        {connection.possibleDuplicateOfId && (
          <p className="text-sm text-orange">Same LinkedIn profile as another candidate under a different email. Check before reaching out.</p>
        )}
      </div>

      {connection.summary && (
        <section className="rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Summary</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {connection.summary.split('\n').map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {facts
              .filter(([, v]) => !!v)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Tag</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {connection.tagReasons.length > 0 ? connection.tagReasons.map((r, i) => <li key={i}>{r}</li>) : <li>Still reading the resume.</li>}
        </ul>
        <TagButtons current={connection.tag} onChange={overrideTag.bind(null, connection.id)} />
        <p className="text-xs text-muted-foreground">
          Pre-scan sorts against your own specialties and open searches. You decide; changing the tag updates the reply.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Recruiter</h2>
        <p className="text-sm">
          {connection.recruiterId
            ? nameOf.get(connection.recruiterId)
            : connection.suggestedRecruiterId
              ? `In the general hopper; suggested for ${nameOf.get(connection.suggestedRecruiterId)}`
              : 'In the general hopper'}
        </p>
        <AssignControl
          recruiters={recruiters.map((r) => ({ id: r.id, name: r.fullName }))}
          currentId={connection.recruiterId}
          suggestedId={connection.suggestedRecruiterId}
          myId={ctx.recruiter.id}
          canAssignAnyone={canAssign(ctx)}
          onAssign={assignConnection.bind(null, connection.id)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Resume</h2>
        {latest ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {latest.fileName} · {latest.createdAt.toLocaleDateString()}
              {latest.parseStatus === 'QUEUED' && ' · queued to read (daily limit reached)'}
              {latest.parseStatus === 'FAILED' && ' · could not be read automatically'}
              {latest.parseStatus === 'NOT_A_RESUME' && ' · does not look like a resume'}
            </span>
            <OpenResumeButton getUrl={getIntakeResumeUrl.bind(null, latest.id)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No file on record.</p>
        )}
        {connection.candidateNote && (
          <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">“{connection.candidateNote}”</blockquote>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Reply</h2>
        {connection.replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {connection.tag === 'FIT' ? 'Fit candidates get no automatic reply. Reach out yourself.' : 'No reply drafted yet.'}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {connection.replies.map((r) => (
              <li key={r.id}>
                {r.subject} · <span className="text-muted-foreground">{REPLY_LABEL[r.status]}</span>
                {r.status === 'DRAFT' && (
                  <>
                    {' · '}
                    <Link href="/recruiters/talent/replies" className="underline">
                      Review
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">What they share with {ctx.firm.name}</h2>
        {connection.consentScopes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. They choose when they open their free profile.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {INTAKE_CONSENT_SCOPES.filter((s) => connection.consentScopes.includes(s)).map((s) => (
              <li key={s}>{INTAKE_CONSENT_SCOPE_LABELS[s].label}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{person.claimedAt ? 'Has a NextChapter account.' : 'Has not opened their profile yet.'}</p>
      </section>

      {connection.routingDecisions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Routing history</h2>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {connection.routingDecisions.map((d) => (
              <li key={d.id}>
                {d.createdAt.toLocaleString()} — {d.reasons.join('; ')}
                {d.decidedBy !== 'system' && ` (by ${nameOf.get(d.decidedBy) ?? 'a teammate'})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
