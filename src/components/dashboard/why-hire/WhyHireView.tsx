import type { ReactNode } from 'react'
import type { Strengths, WhyHire } from '@/lib/profile/strengths-load'
import type { WhyHireExtras } from '@/lib/profile/why-hire-load'
import type { AggregatedSkillGap } from '@/lib/jobs/job-skill-gap'
import { oneIn, type Mark } from '@/lib/profile/why-hire-standing'
import { strengthPhrase } from '@/lib/profile/strengths'
import { AREAS } from '@/lib/strengths-interview/areas'
import { PageHeader } from '@/components/candidate/PageHeader'
import { SectionPills } from '@/components/candidate/SectionPills'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { EmptyNote, FactList, SectionBlock, SourceLine, VerdictPanel } from '@/components/candidate/Blocks'
import { CopyText } from './CopyText'
import { WritePitchButton } from './WritePitchButton'

// Why hire me, in three parts, each its own address:
//   edge  - why you: the statement, what you are best at with the evidence, and where you stand against top candidates
//   gaps  - what to prove, what your best-fit jobs ask for that you don't show, and roles to go into with a plan
//   pitch - the 30-second version and the lines that go with it, and how to put it to work with people this week
// The page's one primary action is the next proof mark to earn (or, on Your pitch, writing the pitch).

export type WhyHirePart = 'edge' | 'gaps' | 'pitch'
export const WHY_HIRE_PARTS: WhyHirePart[] = ['edge', 'gaps', 'pitch']
const BASE = '/dashboard/strengths'
const DISCOVER = '/dashboard/strengths/discover'
const partHref = (p: WhyHirePart) => (p === 'edge' ? BASE : `${BASE}?part=${p}`)

export function WhyHireView({ part, st, extras, statement, skills }: { part: WhyHirePart; st: Strengths; extras: WhyHireExtras; statement: ReactNode; skills: ReactNode }) {
  const next = extras.marks.find((m) => !m.done)
  const ownLeft = st.own.length < AREAS.length
  const open = extras.marks.filter((m) => !m.done).length + (ownLeft ? 1 : 0)
  const have = extras.marks.length - extras.marks.filter((m) => !m.done).length
  // The one primary action, with the reason next to it: a button alone says what, not why this one or why now.
  const action =
    part === 'pitch' && !extras.pitch ? null : st.own.length === 0 ? (
      <NextStep why="Most people can’t say what they’re best at until someone asks. A few questions in your own words, and we put it into words with you.">
        <ActionLink href={DISCOVER} kind="primary" event="why_hire_step_clicked" props={{ mark: 'discover', part, place: 'header' }}>
          Find your strengths
        </ActionLink>
      </NextStep>
    ) : next ? (
      <NextStep why={`${next.why} It takes you to ${have + 1} of ${extras.marks.length} proofs.`}>
        <ActionLink href={next.href} kind="primary" event="why_hire_step_clicked" props={{ mark: next.key, part, place: 'header' }}>
          {next.step}
        </ActionLink>
      </NextStep>
    ) : (
      <NextStep why="Every proof is in place. Put your edge where recruiters look first.">
        <ActionLink href="/dashboard/linkedin" kind="primary" event="why_hire_step_clicked" props={{ mark: 'linkedin', part, place: 'header' }}>
          Put it on LinkedIn
        </ActionLink>
      </NextStep>
    )
  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <PageHeader title="Why hire me" intro="Why an employer needs you, the proof behind it, and how to say it so people remember and pass you on." action={action} />
        <SectionPills
          label="Parts of Why hire me"
          current={part}
          items={[
            { key: 'edge', label: 'Your edge', href: partHref('edge') },
            { key: 'gaps', label: open ? `Close the gaps (${open})` : 'Close the gaps', href: partHref('gaps') },
            { key: 'pitch', label: 'Your pitch', href: partHref('pitch') },
          ]}
        />
      </div>
      {part === 'edge' && <EdgePart st={st} extras={extras} statement={statement} />}
      {part === 'gaps' && <GapsPart st={st} extras={extras} skills={skills} />}
      {part === 'pitch' && <PitchPart st={st} extras={extras} />}
    </div>
  )
}

function NextStep({ why, children }: { why: string; children: ReactNode }) {
  return (
    <div className="max-w-sm space-y-2">
      <p className="text-sm font-semibold text-ink">Your next step</p>
      {children}
      <p className="text-sm text-muted-foreground">{why}</p>
    </div>
  )
}

// ---- Your edge ------------------------------------------------------------------------------------------------------

/** The written "why hire me": the statement, the employer's problem it answers, and the proof. Streamed into Your edge. */
export function WhyHireStatement({ whyHire }: { whyHire: WhyHire }) {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl font-display text-xl leading-snug text-ink">“{whyHire.statement}”</p>
      {whyHire.employerNeed && (
        <div className="max-w-2xl space-y-1 rounded-xl bg-muted/60 p-4">
          <p className="text-sm font-semibold text-ink">Why they need you</p>
          <p className="text-base text-ink">{whyHire.employerNeed}</p>
        </div>
      )}
      {whyHire.proofPoints.length > 0 && (
        <ul aria-label="Proof" className="list-disc space-y-1 pl-5 text-base text-ink">
          {whyHire.proofPoints.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="space-y-2 pt-2">
        <p className="max-w-2xl text-base text-muted-foreground">
          Use it as the first lines of a cover note or your LinkedIn About, and as your answer when an interviewer asks why they should hire you.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <CopyText text={whyHire.statement} kind="why_hire_statement" label="Copy it" />
          <ActionLink href={partHref('pitch')} variant="text" event="why_hire_step_clicked" props={{ mark: 'pitch', part: 'edge', place: 'statement' }}>
            Turn it into a 30-second pitch
          </ActionLink>
        </div>
      </div>
    </div>
  )
}

function EdgePart({ st, extras, statement }: { st: Strengths; extras: WhyHireExtras; statement: ReactNode }) {
  const lead = st.shape === 'peaked' ? st.peaks : st.broad.slice(0, 4)
  return (
    <>
      <VerdictPanel
        id="edge-h"
        title={st.shape !== 'emerging' ? st.headline : st.own[0] ? `You stand out for ${st.own[0].strength.replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, '')}.` : 'Let’s find what you’re best at'}
        because={
          st.shape === 'emerging' && st.own.length === 0
            ? 'Most people can’t say it off the top of their head. Answer a few questions about your best work, your skills and how you work, in your own words, and we’ll put it into words with you.'
            : undefined
        }
      >
        {statement}
      </VerdictPanel>
      {(lead.length > 0 || st.own.length > 0) && (
        <SectionBlock id="best-h" title={st.shape === 'balanced' ? 'Where you are strong' : 'What you are best at'} why="What backs each one is under it. Lead with the first in every application and conversation.">
          {lead.length > 0 && <RowList
            label="Strengths"
            items={lead.map((x) => ({
              key: x.key,
              title: x.label,
              why: `${x.evidence.join('. ')}.`,
            }))}
          />}
          {st.own.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">In your own words</p>
              <FactList label="In your own words" items={st.own.map((o) => ({ key: o.area, name: <span className="font-semibold">{o.strength}</span>, fact: o.areaTitle }))} />
              {st.own.length < AREAS.length && (
                <ActionLink href={DISCOVER} variant="text" event="why_hire_step_clicked" props={{ mark: 'discover', part: 'edge', place: 'own' }}>
                  Answer the other {AREAS.length - st.own.length} areas
                </ActionLink>
              )}
            </div>
          )}
          {st.shape === 'balanced' && (
            <SourceLine>No single peak is not a weakness. Teams need people they can hand anything to; say so plainly and back it with one example for each.</SourceLine>
          )}
        </SectionBlock>
      )}
      <Standing extras={extras} />
    </>
  )
}

/** The page's one navy moment: the proofs top candidates have, how many you have, and how that compares. */
function Standing({ extras }: { extras: WhyHireExtras }) {
  const { marks, standing } = extras
  const have = marks.filter((m) => m.done).length
  const all = have === marks.length
  return (
    <section aria-labelledby="standing-h" className="space-y-5 rounded-2xl bg-ink p-8 text-white">
      <div className="space-y-2">
        <p className="text-sm font-medium text-white/80">Top-candidate proof</p>
        <h2 id="standing-h" className="font-display text-2xl font-semibold">
          {all ? 'You have all five proofs top candidates have.' : `You have ${have} of the 5 proofs top candidates have.`}
        </h2>
        {standing && (
          <p className="max-w-2xl text-base text-white/85">
            {have > 0 && standing.aheadOf > 0 ? `That puts you ahead of ${Math.round(standing.aheadOf * 100)}% of ${standing.group}. ` : ''}
            {standing.withAll === 0
              ? all
                ? 'No one else has all five yet.'
                : 'No one has all five yet. Be the first.'
              : all
                ? `Only ${oneIn(standing.withAll)} of them can say the same.`
                : `${oneIn(standing.withAll).replace(/^./, (c) => c.toUpperCase())} has all five. That is the top of the pile.`}
          </p>
        )}
      </div>
      <ul aria-label="Proofs" className="space-y-3">
        {marks.map((m) => (
          <MarkRow key={m.key} m={m} />
        ))}
      </ul>
    </section>
  )
}

function MarkRow({ m }: { m: Mark }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
      <div className="flex min-w-0 flex-1 basis-64 gap-3">
        <span aria-hidden className={m.done ? 'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-ink' : 'mt-0.5 inline-flex size-5 shrink-0 rounded-full border-2 border-white/60'}>
          {m.done ? '✓' : ''}
        </span>
        <span className="text-base">
          <span className="sr-only">{m.done ? 'Done: ' : 'Not yet: '}</span>
          {m.label}
        </span>
      </div>
      {!m.done && (
        <ActionLink href={m.href} variant="text" event="why_hire_step_clicked" props={{ mark: m.key, part: 'edge', place: 'standing' }} className="text-white">
          {m.step}
        </ActionLink>
      )}
    </li>
  )
}

// ---- Close the gaps -------------------------------------------------------------------------------------------------

function GapsPart({ st, extras, skills }: { st: Strengths; extras: WhyHireExtras; skills: ReactNode }) {
  const todo = extras.marks.filter((m) => !m.done)
  const ownLeft = AREAS.length - st.own.length
  const plan = [
    ...st.weakSpots.map((w) => ({ key: w.key, name: <span className="font-semibold">{w.label}</span>, fact: w.line })),
    ...st.own.filter((o) => o.watchOut).map((o) => ({ key: `own-${o.area}`, name: <span className="font-semibold">{o.areaTitle}</span>, fact: o.watchOut })),
  ]
  return (
    <>
      <SectionBlock id="prove-h" title="Prove what you already have" why="An employer can check each of these. Together they are what moves you from a résumé in the pile to the person they call.">
        {todo.length || ownLeft ? (
          <RowList
            label="Proofs to add"
            items={[
              ...(ownLeft
                ? [
                    {
                      key: 'discover',
                      title: st.own.length ? `Find your strengths: ${ownLeft} of ${AREAS.length} areas left` : 'Find your strengths in your own words',
                      why: 'Short questions about your best work, skills, industry, how you work, people and what drives you. It is how most people find the words, and the weaker spots to plan for.',
                      actions: (
                        <ActionLink href={DISCOVER} event="why_hire_step_clicked" props={{ mark: 'discover', part: 'gaps', place: 'gaps' }}>
                          {st.own.length ? 'Continue' : 'Start'}
                        </ActionLink>
                      ),
                    },
                  ]
                : []),
              ...todo.map((m) => ({
              key: m.key,
              title: m.step,
              why: m.why,
              actions: (
                <ActionLink href={m.href} event="why_hire_step_clicked" props={{ mark: m.key, part: 'gaps', place: 'gaps' }}>
                  Do it now
                </ActionLink>
              ),
            })),
            ]}
          />
        ) : (
          <EmptyNote>Every proof is in place. Keep your references warm and refresh your résumé numbers when you finish something new.</EmptyNote>
        )}
      </SectionBlock>
      {skills}
      {plan.length > 0 && (
        <SectionBlock id="plan-h" title="Go in with a plan (you and your coach only)" why="These are not strengths yet. Pick roles that don't start with them, or prepare one example for each before the interview.">
          <FactList label="Weaker spots to plan for" items={plan} />
        </SectionBlock>
      )}
    </>
  )
}

/** What the member's best-fit jobs ask for. Streamed into Close the gaps. */
export function BestFitSkills({ gap }: { gap: AggregatedSkillGap | null }) {
  if (!gap || gap.jobsWithSkillData === 0) {
    return (
      <SectionBlock id="skills-h" title="What your best-fit jobs ask for" why="The skills that keep coming up in the open jobs that fit you.">
        <EmptyNote>We need a few jobs that fit you to read this. Upload your résumé and set what you are looking for, and it fills in.</EmptyNote>
      </SectionBlock>
    )
  }
  const n = gap.jobsWithSkillData
  return (
    <SectionBlock id="skills-h" title="What your best-fit jobs ask for" why={`Read from the open jobs that fit you, at ${n} employer${n === 1 ? '' : 's'}. Each employer counts once.`}>
      {gap.missing.length > 0 ? (
        <RowList
          label="Skills to show or build"
          items={gap.missing.slice(0, 4).map((s) => ({
            key: s.term,
            title: s.term,
            why: `${s.jobs} of ${n} employers ask for it, and your profile does not show it.`,
            fact: 'If you have it, add it to your résumé. If not, it is the next thing to learn.',
            actions: (
              <ActionLink href="/dashboard/learning" event="why_hire_skill_clicked" props={{ skill: s.term, employers: s.jobs }}>
                Learn it
              </ActionLink>
            ),
          }))}
        />
      ) : (
        <EmptyNote>You show every skill that keeps coming up. That is rare: say so.</EmptyNote>
      )}
      {gap.have.length > 0 && (
        <SourceLine>
          You already bring {gap.have.slice(0, 4).map((h) => `${h.term} (${h.jobs} of ${n})`).join(', ')}. Name these early in every application.
        </SourceLine>
      )}
    </SectionBlock>
  )
}

// ---- Your pitch -----------------------------------------------------------------------------------------------------

const ASK = 'Is there one person you think I should talk to? A name is all I need.'

function PitchPart({ st, extras }: { st: Strengths; extras: WhyHireExtras }) {
  const p = extras.pitch
  if (!p) {
    return (
      <VerdictPanel
        id="pitch-h"
        title="Your pitch isn’t written yet"
        because="People can only pass you on if they can repeat why you. We write a 30-second version, a line to open a conversation and a note to send, from the strengths and proof on Your edge."
      >
        <WritePitchButton started={extras.pitchStarted} />
      </VerdictPanel>
    )
  }
  const lead = (st.shape === 'peaked' ? st.peaks : st.broad)[0]
  const note = [p.emailOpening, ASK].filter(Boolean).join(' ')
  const lines = [
    { key: 'conversation_opener', name: 'To open a conversation', text: p.conversationOpener },
    { key: 'linkedin_headline', name: 'Your LinkedIn headline', text: p.linkedinHeadline },
  ].filter((l) => l.text)
  return (
    <>
      <VerdictPanel id="pitch-h" title="Your 30-second pitch" because={lead ? `It leads with ${strengthPhrase(lead.key)}, your strongest proof. Say it out loud until it sounds like you.` : 'Say it out loud until it sounds like you.'}>
        <p className="max-w-2xl font-display text-xl leading-snug text-ink">“{p.verbal30s}”</p>
        <div className="flex flex-wrap items-center gap-3">
          <CopyText text={p.verbal30s} kind="verbal_30s" />
          <ActionLink href="/dashboard/interview-prep" variant="text" event="pitch_edit_clicked" props={{ from: 'pitch' }}>
            Change the words
          </ActionLink>
        </div>
      </VerdictPanel>
      <SectionBlock id="network-h" title="Put it to work this week" why="Most jobs are filled through people who know someone. Tell five people what you are looking for and ask for one name.">
        <RowList
          label="Ways to use your pitch"
          items={[
            {
              key: 'note',
              title: 'Send this to five people who know your work',
              why: <span className="text-ink">“{note}”</span>,
              fact: 'Add a first line in your own words. Send it yourself, from your own email or LinkedIn.',
              actions: (
                <>
                  <CopyText text={note} kind="network_note" label="Copy the note" />
                  <ActionLink href="/dashboard/network" event="why_hire_network_clicked" props={{ from: 'pitch' }}>
                    Pick five people
                  </ActionLink>
                </>
              ),
            },
            ...lines.map((l) => ({
              key: l.key,
              title: l.name,
              why: <span className="text-ink">“{l.text}”</span>,
              actions: <CopyText text={l.text} kind={l.key} />,
            })),
            {
              key: 'practice',
              title: 'Practice it before your next call',
              why: 'Answer “tell me about yourself” out loud and get feedback on what landed.',
              actions: (
                <ActionLink href="/dashboard/interview-prep" event="why_hire_practice_clicked" props={{ from: 'pitch' }}>
                  Practice
                </ActionLink>
              ),
            },
          ]}
        />
      </SectionBlock>
    </>
  )
}
