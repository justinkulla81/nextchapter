import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { buildCase } from '@/lib/review-prep/case'
import { ConversationForm, EMPTY_DRAFT } from '@/components/dashboard/ConversationForm'
import { ConversationOutcome } from '@/components/dashboard/ConversationOutcome'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { SeeAllLink } from '@/components/candidate/SeeAllLink'
import { EmptyNote, FactList, SectionBlock, SourceLine } from '@/components/candidate/Blocks'
import { CONVERSATION_KINDS } from '@/lib/review-prep/conversation'

export const metadata: Metadata = { title: 'Build your case' }

const STRENGTH_COPY = {
  STARTING: 'You are just starting your case. The gaps below are the fastest way to strengthen it.',
  BUILDING: 'Your case is taking shape. Close the gaps below and it will hold up in the room.',
  STRONG: 'Your case is strong. Practice saying it out loud, then ask.',
} as const

// Build your case: for a review, a raise or a promotion conversation. Pulls
// together what the member has already recorded, says plainly what is missing,
// and gives the three things to settle before they walk in.
export default async function ReviewPrepPage() {
  const profile = await getDashboardProfile()
  const [trackRecord, workSamples, quotes, completedReferences, learning, conversations] = await Promise.all([
    prisma.trackRecordResponse.findUnique({ where: { candidateId: profile.id } }),
    prisma.workSample.findMany({ where: { candidateId: profile.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.referenceQuote.findMany({ where: { candidateId: profile.id, approvedByCandidateAt: { not: null } }, orderBy: { approvedByCandidateAt: 'desc' }, take: 3 }),
    prisma.reference.count({ where: { candidateId: profile.id, status: 'COMPLETED' } }),
    prisma.learningBadge.findMany({ where: { candidateId: profile.id }, orderBy: { completedAt: 'desc' }, take: 10 }),
    prisma.careerConversation.findMany({ where: { candidateId: profile.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ])
  const c = buildCase({ trackRecord, workSamples, quotes, completedReferences, learning })

  const results = (
    <SectionBlock id="results" title="Results you can point to" why="Your reasons should be things you did, with a number if you can.">
      {c.results.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-base text-ink">
          {c.results.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <EmptyNote>Nothing recorded yet. Add your track record and the results you can point to appear here.</EmptyNote>
      )}
      {c.samples.length > 0 && (
        <FactList label="Work samples" items={c.samples.map((smp) => ({ key: smp.title, name: <span className="font-semibold">{smp.title}</span>, fact: smp.line }))} />
      )}
    </SectionBlock>
  )
  const settle = (
    <SectionBlock id="settle" title="Settle three things before you walk in" why="Write them down once. Everything you save here is private to you.">
      <ol className="list-decimal space-y-1 pl-5 text-base text-ink">
        <li>
          <span className="font-semibold">The ask.</span> A specific number or level, not “more”. Start from{' '}
          <Link href="/dashboard/pay" className="font-medium text-brand underline underline-offset-4">
            where your pay sits
          </Link>
          .
        </li>
        <li>
          <span className="font-semibold">Your reasons.</span> Three results from above, each with a number if you can.
        </li>
        <li>
          <span className="font-semibold">Your alternatives.</span> What you will do if the answer is no. Knowing it changes how you ask.
        </li>
      </ol>
      <ConversationForm draft={EMPTY_DRAFT} suggestions={c.results.slice(0, 3)} />
      <SourceLine>Afterward, write down what was agreed and send it the same day.</SourceLine>
    </SectionBlock>
  )
  const strengthen = c.gaps.length > 0 && (
    <SectionBlock id="gaps" title="Strengthen your case" why="Each step makes one of your reasons easier to prove.">
      <RowList
        label="Ways to strengthen your case"
        items={c.gaps.map((g) => ({
          key: g.key,
          title: g.label,
          why: g.why,
          actions: (
            <ActionLink href={g.href} event="review_prep_gap_clicked" props={{ gap: g.key }}>
              Do it now
            </ActionLink>
          ),
        }))}
      />
    </SectionBlock>
  )
  const others = (
    <SectionBlock id="others" title="What others say" why="Approved reference quotes carry more weight than your own words.">
      {c.quotes.length > 0 ? (
        <ul className="space-y-4">
          {c.quotes.map((q) => (
            <li key={q.theme + q.text.slice(0, 20)}>
              <p className="max-w-2xl font-display text-lg text-ink">&ldquo;{q.text}&rdquo;</p>
              <SourceLine>{q.theme}</SourceLine>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>No approved reference quotes yet.</EmptyNote>
      )}
      {c.learning.length > 0 && <SourceLine>Learned this year: {c.learning.join(', ')}.</SourceLine>}
    </SectionBlock>
  )
  const saved = conversations.length > 0 && (
    <SectionBlock id="saved" title="Your conversations">
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {conversations.map((cv) => (
          <li key={cv.id} className="space-y-2 p-5">
            <p className="text-base font-semibold text-ink">
              {CONVERSATION_KINDS.find((k) => k.key === cv.kind)?.label}
              {cv.askAmount ? `: $${cv.askAmount.toLocaleString('en-US')}` : ''}
              {cv.askLevel ? `${cv.askAmount ? ', ' : ': '}${cv.askLevel}` : ''}
              {cv.scheduledFor ? ` · ${cv.scheduledFor.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : ''}
            </p>
            <ConversationOutcome id={cv.id} kind={cv.kind} outcome={cv.outcome} />
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">Edit this conversation</summary>
              <div className="mt-3">
                <ConversationForm
                  suggestions={[]}
                  draft={{
                    id: cv.id,
                    kind: cv.kind,
                    scheduledFor: cv.scheduledFor ? cv.scheduledFor.toISOString().slice(0, 10) : '',
                    askAmount: cv.askAmount ? String(cv.askAmount) : '',
                    askLevel: cv.askLevel ?? '',
                    reasons: [...cv.reasons, '', '', ''].slice(0, 3),
                    walkAway: cv.walkAway ?? '',
                  }}
                />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </SectionBlock>
  )
  return (
    <div className="space-y-8">
      <PageHeader
        title="Build your case"
        intro={`${STRENGTH_COPY[c.strength]} For a review, a raise, a promotion or an offer.`}
        action={
          <ActionLink href="/dashboard/interview-prep" kind="primary" event="review_prep_practice_clicked" props={{ strength: c.strength, gaps: c.gaps.length, saved: conversations.length }}>
            Practice the conversation
          </ActionLink>
        }
      />
      {results}
      {settle}
      {strengthen}
      <ShowMore page="review_prep">
        {others}
        {saved}
        <SeeAllLink href="/dashboard/in-work">Want to log wins as they happen, or prep for each review cycle? Open Reviews and raises</SeeAllLink>
      </ShowMore>
    </div>
  )
}
